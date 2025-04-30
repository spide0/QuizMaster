import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { setupWebSocketServer } from "./socket";
import { storage } from "./storage";
import { db } from "./db";
import { 
  insertQuizSchema, 
  insertQuestionSchema, 
  insertAttemptSchema,
  marks,
  insertMarkSchema,
  users
} from "@shared/schema";
import { eq, ne } from "drizzle-orm";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

// Helper to check if the user is authenticated and has the required role
function checkRole(req: any, res: any, roles: string[]) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  
  return null;
}

// Helper for admin role check
function isAdmin(req: any, res: any) {
  return checkRole(req, res, ["admin"]);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Setup WebSocket server for real-time monitoring
  setupWebSocketServer(httpServer);

  // Quiz related routes
  // Get all quizzes
  app.get("/api/quizzes", async (req, res) => {
    try {
      const quizzes = await storage.getAllQuizzes();
      res.json(quizzes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quizzes" });
    }
  });
  
  // Get quiz statistics for admin dashboard
  app.get("/api/admin/quiz-stats", async (req, res) => {
    try {
      const error = isAdmin(req, res);
      if (error) return;
      
      const quizzes = await storage.getAllQuizzes();
      const allAttempts = await storage.getCompletedAttempts();
      
      // Calculate statistics for each quiz
      const quizStats = await Promise.all(quizzes.map(async (quiz) => {
        // Get attempts for this quiz
        const quizAttempts = allAttempts.filter(a => a.quizId === quiz.id);
        
        // Count unique users who took this quiz
        const uniqueUsers = new Set(quizAttempts.map(a => a.userId)).size;
        
        // Calculate average score
        const totalScore = quizAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0);
        const averageScore = quizAttempts.length > 0 ? totalScore / quizAttempts.length : 0;
        
        // Get pass rate
        const passingScore = quiz.passingScore || 70;
        const passedAttempts = quizAttempts.filter(a => (a.score || 0) >= passingScore).length;
        const passRate = quizAttempts.length > 0 ? (passedAttempts / quizAttempts.length) * 100 : 0;
        
        return {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          timeLimit: quiz.timeLimit,
          passingScore,
          totalAttempts: quizAttempts.length,
          uniqueUsers,
          averageScore,
          passRate,
          recentAttempt: quizAttempts.length > 0 ? 
            new Date(Math.max(...quizAttempts.map(a => new Date(a.endTime || a.startTime).getTime()))) : 
            null
        };
      }));
      
      // Sort by recent activity
      quizStats.sort((a, b) => {
        if (!a.recentAttempt) return 1;
        if (!b.recentAttempt) return -1;
        return b.recentAttempt.getTime() - a.recentAttempt.getTime();
      });
      
      res.json(quizStats);
    } catch (error) {
      console.error("Error fetching quiz statistics:", error);
      res.status(500).json({ message: "Failed to fetch quiz statistics" });
    }
  });

  // Get quiz by ID
  app.get("/api/quizzes/:id", async (req, res) => {
    try {
      const quiz = await storage.getQuizById(parseInt(req.params.id));
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      res.json(quiz);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quiz" });
    }
  });

  // Create a new quiz (admin only)
  app.post("/api/quizzes", async (req, res) => {
    try {
      const error = isAdmin(req, res);
      if (error) return;
      
      const quizData = insertQuizSchema.parse(req.body);
      
      const quiz = await storage.createQuiz({
        ...quizData,
        createdBy: req.user.id
      });
      
      res.status(201).json(quiz);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Failed to create quiz" });
    }
  });

  // Get questions for a quiz
  app.get("/api/quizzes/:id/questions", async (req, res) => {
    try {
      const questions = await storage.getQuizQuestions(parseInt(req.params.id));
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  // Add questions to a quiz (admin only)
  app.post("/api/quizzes/:id/questions", async (req, res) => {
    try {
      const error = isAdmin(req, res);
      if (error) return;
      
      const quizId = parseInt(req.params.id);
      
      // Validate quiz existence
      const quiz = await storage.getQuizById(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      
      // Check if user is the creator of the quiz
      if (quiz.createdBy !== req.user.id) {
        return res.status(403).json({ message: "You are not authorized to add questions to this quiz" });
      }
      
      const questionData = insertQuestionSchema.parse({
        ...req.body,
        quizId
      });
      
      const question = await storage.createQuestion(questionData);
      
      res.status(201).json(question);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Failed to add question" });
    }
  });

  // Start a quiz attempt (only for regular users, not admins)
  app.post("/api/attempts", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Prevent admin users from attempting quizzes
      if (req.user.role === 'admin') {
        return res.status(403).json({ 
          message: "Admin users cannot attempt quizzes. Please use a regular user account to take quizzes."
        });
      }
      
      const attemptData = insertAttemptSchema.parse({
        ...req.body,
        userId: req.user.id
      });
      
      // Check if the quiz exists
      const quiz = await storage.getQuizById(attemptData.quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      
      // Check if the user has ongoing attempts for this quiz
      const ongoingAttempt = await storage.getOngoingAttempt(req.user.id, attemptData.quizId);
      if (ongoingAttempt) {
        return res.json(ongoingAttempt);
      }
      
      const attempt = await storage.createAttempt(attemptData);
      
      res.status(201).json(attempt);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Failed to start quiz attempt" });
    }
  });

  // Update quiz attempt (submit answers, record tab switches) - only for regular users
  app.patch("/api/attempts/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Prevent admin users from updating attempts
      if (req.user.role === 'admin') {
        return res.status(403).json({ 
          message: "Admin users cannot participate in quizzes. Please use a regular user account." 
        });
      }
      
      const attemptId = parseInt(req.params.id);
      
      // Check if the attempt exists and belongs to the user
      const attempt = await storage.getAttemptById(attemptId);
      if (!attempt) {
        return res.status(404).json({ message: "Attempt not found" });
      }
      
      if (attempt.userId !== req.user.id) {
        return res.status(403).json({ message: "You are not authorized to update this attempt" });
      }
      
      // Handle different update types
      const { answers, tabSwitch, complete } = req.body;
      
      let updatedAttempt = attempt;
      
      if (answers) {
        updatedAttempt = await storage.updateAttemptAnswers(attemptId, answers);
      }
      
      if (tabSwitch === true) {
        updatedAttempt = await storage.incrementTabSwitches(attemptId);
      }
      
      if (complete === true) {
        // Calculate the score
        const questions = await storage.getQuizQuestions(attempt.quizId);
        let score = 0;
        
        if (updatedAttempt.answers) {
          const answersObj = updatedAttempt.answers as Record<string, number>;
          
          questions.forEach(question => {
            const questionId = question.id.toString();
            if (answersObj[questionId] === question.correctAnswer) {
              score += 1;
            }
          });
        }
        
        // Convert to percentage
        const percentageScore = questions.length > 0 
          ? Math.round((score / questions.length) * 100) 
          : 0;
        
        updatedAttempt = await storage.completeAttempt(attemptId, percentageScore);
      }
      
      res.json(updatedAttempt);
    } catch (error) {
      res.status(500).json({ message: "Failed to update attempt" });
    }
  });
  
  // Dedicated endpoint for tab switching to improve real-time monitoring - only for regular users
  app.patch("/api/attempts/:id/tab-switch", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Prevent admin users from attempt tab switching
      if (req.user.role === 'admin') {
        return res.status(403).json({ 
          message: "Admin users cannot participate in quizzes. Please use a regular user account." 
        });
      }
      
      const attemptId = parseInt(req.params.id);
      
      // Check if the attempt exists and belongs to the user
      const attempt = await storage.getAttemptById(attemptId);
      if (!attempt) {
        return res.status(404).json({ message: "Attempt not found" });
      }
      
      if (attempt.userId !== req.user.id) {
        return res.status(403).json({ message: "You are not authorized to update this attempt" });
      }
      
      // Increment tab switches
      const updatedAttempt = await storage.incrementTabSwitches(attemptId);
      
      // If tab switches exceed a threshold, you might want to flag this attempt
      const TAB_SWITCH_THRESHOLD = 5;
      if (updatedAttempt.tabSwitches > TAB_SWITCH_THRESHOLD) {
        console.log(`ALERT: User ${req.user.id} has exceeded tab switch threshold (${updatedAttempt.tabSwitches}) for attempt ${attemptId}`);
        // You could add additional logic here for flagging in the database
      }
      
      res.json(updatedAttempt);
    } catch (error) {
      console.error("Tab switch recording error:", error);
      res.status(500).json({ message: "Failed to record tab switch" });
    }
  });

  // Get user's quiz attempts (filter for role)
  app.get("/api/user/attempts", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // For admin users, return an empty array as they cannot attempt quizzes
      if (req.user.role === 'admin') {
        return res.json([]);
      }
      
      const attempts = await storage.getUserAttempts(req.user.id);
      res.json(attempts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch attempts" });
    }
  });

  // Get results for a specific attempt
  app.get("/api/attempts/:id/results", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const attemptId = parseInt(req.params.id);
      
      // Check if the attempt exists and belongs to the user
      const attempt = await storage.getAttemptById(attemptId);
      if (!attempt) {
        return res.status(404).json({ message: "Attempt not found" });
      }
      
      // Admin can view any results, users can only view their own
      if (req.user.role !== 'admin' && attempt.userId !== req.user.id) {
        return res.status(403).json({ message: "You are not authorized to view these results" });
      }
      
      // Get the quiz and questions
      const quiz = await storage.getQuizById(attempt.quizId);
      const questions = await storage.getQuizQuestions(attempt.quizId);
      
      // Combine all data for comprehensive results
      const results = {
        attempt,
        quiz,
        questions,
        user: req.user.role === 'admin' && attempt.userId !== req.user.id 
          ? await storage.getUser(attempt.userId)
          : undefined
      };
      
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch results" });
    }
  });

  // Get all active quiz attempts (for admin monitoring)
  app.get("/api/admin/active-attempts", async (req, res) => {
    try {
      const error = isAdmin(req, res);
      if (error) return;
      
      const activeAttempts = await storage.getActiveAttempts();
      res.json(activeAttempts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active attempts" });
    }
  });
  
  // Get all completed attempts (for admin results view)
  app.get("/api/admin/attempts", async (req, res) => {
    try {
      const error = isAdmin(req, res);
      if (error) return;
      
      const completedAttempts = await storage.getCompletedAttempts();
      
      // For each attempt, fetch the associated quiz data
      const attemptsWithDetails = await Promise.all(completedAttempts.map(async (attempt) => {
        const quiz = await storage.getQuizById(attempt.quizId);
        return {
          ...attempt,
          quiz: quiz || undefined
        };
      }));
      
      res.json(attemptsWithDetails);
    } catch (error) {
      console.error("Error fetching all attempts:", error);
      res.status(500).json({ message: "Failed to fetch completed attempts" });
    }
  });
  
  // Get all users (for admin results view)
  app.get("/api/admin/users", async (req, res) => {
    try {
      const error = isAdmin(req, res);
      if (error) return;
      
      // Get all users from the database
      const allUsers = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        profilePicture: users.profilePicture
      })
      .from(users)
      .where(
        ne(users.id, req.user?.id as number) // Exclude current admin
      );
      
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Marks related routes (for D3.js visualization)
  // Get all marks
  app.get("/api/marks", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const allMarks = await storage.getAllMarks();
      res.json(allMarks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch marks" });
    }
  });
  
  // Get user quiz performance data for marks analysis
  app.get("/api/user-performance", async (req, res) => {
    try {
      const error = isAdmin(req, res);
      if (error) return;
      
      // Get all completed attempts
      const allAttempts = await storage.getCompletedAttempts();
      
      // Get marks thresholds
      const marks = await storage.getAllMarks();
      
      // Count quiz scores by mark categories
      const performanceData = marks.map(mark => {
        // Find all attempts that fall within this mark's threshold
        const minThreshold = mark.threshold;
        const maxThreshold = marks.find(m => m.threshold > mark.threshold && m.threshold < 100)?.threshold || 101;
        
        // Count attempts with scores in this range
        const attemptsInRange = allAttempts.filter(attempt => 
          attempt.score !== null && 
          attempt.score >= minThreshold && 
          attempt.score < maxThreshold
        );
        
        return {
          mark: mark.mark,
          count: attemptsInRange.length,
          attempts: attemptsInRange.map(a => ({
            id: a.id,
            userId: a.userId,
            quizId: a.quizId,
            score: a.score,
            tabSwitches: a.tabSwitches,
            startTime: a.startTime,
            endTime: a.endTime
          }))
        };
      });
      
      res.json(performanceData);
    } catch (error) {
      console.error("Error fetching user performance data:", error);
      res.status(500).json({ message: "Failed to fetch user performance data" });
    }
  });

  // Create a new mark (admin only)
  app.post("/api/marks", async (req, res) => {
    try {
      const error = isAdmin(req, res);
      if (error) return;
      
      const markData = insertMarkSchema.parse(req.body);
      const mark = await storage.createMark(markData);
      
      res.status(201).json(mark);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Failed to create mark" });
    }
  });

  // Get quiz categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Seed default marks data if it doesn't exist
  await seedDefaultMarks();

  // Return the HTTP server instance
  return httpServer;
}

// Helper function to seed default marks data
async function seedDefaultMarks() {
  try {
    const existingMarks = await storage.getAllMarks();
    
    if (existingMarks.length === 0) {
      const defaultMarks = [
        {
          mark: "A (90-100%)",
          justification: "Exceptional understanding of all concepts. Demonstrates perfect or near-perfect knowledge.",
          internalRoute: "/api/grades/a-grade",
          threshold: 90
        },
        {
          mark: "B (80-89%)",
          justification: "Strong grasp of material with minor errors. Shows comprehensive knowledge of most concepts.",
          internalRoute: "/api/grades/b-grade",
          threshold: 80
        },
        {
          mark: "C (70-79%)",
          justification: "Satisfactory understanding with some gaps in knowledge. Demonstrates basic competency.",
          internalRoute: "/api/grades/c-grade",
          threshold: 70
        },
        {
          mark: "D (60-69%)",
          justification: "Limited understanding with significant knowledge gaps. Meets minimum requirements.",
          internalRoute: "/api/grades/d-grade",
          threshold: 60
        },
        {
          mark: "F (Below 60%)",
          justification: "Insufficient knowledge of core concepts. Does not meet minimum requirements.",
          internalRoute: "/api/grades/f-grade",
          threshold: 0
        }
      ];
      
      for (const mark of defaultMarks) {
        await storage.createMark(mark);
      }
    }
  } catch (error) {
    console.error("Failed to seed default marks data:", error);
  }
}
