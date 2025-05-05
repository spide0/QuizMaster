import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { 
  InsertUser, 
  insertUserSchema,
  loginSchema, 
  passwordResetRequestSchema, 
  passwordResetSchema, 
  passwordChangeSchema,
  profileUpdateSchema,
  User
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

declare global {
  namespace Express {
    // Extend Express.User with our custom User type properties
    interface User {
      id: number;
      username: string;
      email: string;
      password: string;
      profilePicture?: string | null;
      role: string;
      isVerified: boolean;
      verificationToken?: string | null;
      resetToken?: string | null;
      createdAt: Date;
    }
  }
}

const scryptAsync = promisify(scrypt);

// Export this function to be used elsewhere
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  if (!salt || !hashed) {
    console.error("Invalid stored password format", stored);
    return false;
  }
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Generate email verification token
function generateToken() {
  return randomBytes(32).toString("hex");
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'quizmasterappsecret',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Use either email or username for login
  passport.use(
    new LocalStrategy(
      { usernameField: 'email' },
      async (emailOrUsername, password, done) => {
        try {
          // First try to find by email
          let user = await storage.getUserByEmail(emailOrUsername);
          
          // If not found by email, try by username
          if (!user) {
            user = await storage.getUserByUsername(emailOrUsername);
          }
          
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false);
          } else {
            return done(null, user);
          }
        } catch (error) {
          return done(error);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Registration endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      // Validate input
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUserByEmail = await storage.getUserByEmail(userData.email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: "Email is already registered" });
      }
      
      const existingUserByUsername = await storage.getUserByUsername(userData.username);
      if (existingUserByUsername) {
        return res.status(400).json({ message: "Username is already taken" });
      }

      // Create verification token
      const verificationToken = generateToken();
      
      // Hash password and create user
      const hashedPassword = await hashPassword(userData.password);
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        verificationToken,
      });

      // In a real application, send email with verification link
      // For this example, we'll just mark the user as verified automatically
      await storage.verifyUser(user.id);

      // Log the user in
      req.login(user, (err) => {
        if (err) return next(err);
        // Don't send password in response
        const { password, verificationToken, resetToken, ...userWithoutSensitiveData } = user;
        res.status(201).json(userWithoutSensitiveData);
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      next(error);
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    try {
      // Validate input
      loginSchema.parse(req.body);
      
      passport.authenticate("local", (err: Error, user: User) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          return res.status(401).json({ message: "Invalid email or password" });
        }
        
        req.login(user, (loginErr) => {
          if (loginErr) {
            return next(loginErr);
          }
          // Don't send password in response
          const { password, verificationToken, resetToken, ...userWithoutSensitiveData } = user;
          return res.json(userWithoutSensitiveData);
        });
      })(req, res, next);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      next(error);
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Get current user info
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Don't send password in response
    const { password, verificationToken, resetToken, ...userWithoutSensitiveData } = req.user;
    res.json(userWithoutSensitiveData);
  });

  // Request password reset
  app.post("/api/request-password-reset", async (req, res, next) => {
    try {
      const { email } = passwordResetRequestSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal that the email doesn't exist
        return res.status(200).json({ message: "If your email is registered, you will receive a password reset link" });
      }
      
      const resetToken = generateToken();
      await storage.setResetToken(user.id, resetToken);
      
      // In a real application, send email with reset link
      // For this example, we'll just return a success message
      
      res.status(200).json({ message: "If your email is registered, you will receive a password reset link" });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      next(error);
    }
  });

  // Reset password with token
  app.post("/api/reset-password", async (req, res, next) => {
    try {
      const { token, password } = passwordResetSchema.parse(req.body);
      
      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      const hashedPassword = await hashPassword(password);
      await storage.updatePassword(user.id, hashedPassword);
      await storage.clearResetToken(user.id);
      
      res.status(200).json({ message: "Password has been reset successfully" });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      next(error);
    }
  });

  // Update user profile
  app.patch("/api/user/profile", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const updateData = profileUpdateSchema.parse(req.body);
      
      // Check if username is taken (if being updated)
      if (updateData.username) {
        const existingUser = await storage.getUserByUsername(updateData.username);
        if (existingUser && existingUser.id !== req.user.id) {
          return res.status(400).json({ message: "Username is already taken" });
        }
      }
      
      // Check if email is taken (if being updated)
      if (updateData.email) {
        const existingUser = await storage.getUserByEmail(updateData.email);
        if (existingUser && existingUser.id !== req.user.id) {
          return res.status(400).json({ message: "Email is already registered" });
        }
      }
      
      const updatedUser = await storage.updateUserProfile(req.user.id, updateData);
      
      // Don't send password in response
      const { password, verificationToken, resetToken, ...userWithoutSensitiveData } = updatedUser;
      res.json(userWithoutSensitiveData);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      next(error);
    }
  });

  // Change password
  app.post("/api/user/change-password", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { currentPassword, newPassword } = passwordChangeSchema.parse(req.body);
      
      // Verify current password
      const isCurrentPasswordValid = await comparePasswords(currentPassword, req.user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      const hashedPassword = await hashPassword(newPassword);
      await storage.updatePassword(req.user.id, hashedPassword);
      
      res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      next(error);
    }
  });

  // Upload profile picture
  app.post("/api/user/profile-picture", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // In a real application, we would use multer to handle file uploads
      // For this example, we'll just accept a base64 encoded image in the request body
      const { profilePicture } = req.body;
      
      if (!profilePicture) {
        return res.status(400).json({ message: "No profile picture provided" });
      }
      
      const updatedUser = await storage.updateProfilePicture(req.user.id, profilePicture);
      
      // Don't send password in response
      const { password, verificationToken, resetToken, ...userWithoutSensitiveData } = updatedUser;
      res.json(userWithoutSensitiveData);
    } catch (error) {
      next(error);
    }
  });

  // Delete account
  app.delete("/api/user/account", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      await storage.deleteUser(req.user.id);
      
      req.logout((err) => {
        if (err) return next(err);
        res.status(200).json({ message: "Account deleted successfully" });
      });
    } catch (error) {
      next(error);
    }
  });

  // Email verification endpoint (for a real application)
  app.get("/api/verify-email/:token", async (req, res, next) => {
    try {
      const { token } = req.params;
      
      const user = await storage.getUserByVerificationToken(token);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired verification token" });
      }
      
      await storage.verifyUser(user.id);
      
      res.status(200).json({ message: "Email verified successfully" });
    } catch (error) {
      next(error);
    }
  });
}
