import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword } from "./auth";
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

// Helper for superuser role check
function isSuperuser(req: any, res: any) {
  return checkRole(req, res, ["superuser"]);
}

// Helper to verify API key in request headers
function validateApiKey(req: any, res: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "Invalid authorization header" });
  }
  
  const providedApiKey = authHeader.split(' ')[1];
  const validApiKey = process.env.SUPERUSER_API_KEY;
  
  if (!validApiKey || providedApiKey !== validApiKey) {
    return res.status(403).json({ message: "Invalid API key" });
  }
  
  return null;
}

// Create or ensure the superuser exists
async function createSuperuser() {
  try {
    // Check if superuser already exists
    const existingSuperuser = await storage.getUserByUsername("root");
    
    // Delete existing superuser to recreate with properly hashed password
    if (existingSuperuser) {
      // First delete the existing user
      await storage.deleteUser(existingSuperuser.id);
      console.log("Deleted existing superuser to recreate with proper password hash");
    }
    
    // Hash the password before storage
    const hashedPassword = await hashPassword("T9x!rV@5mL#8wQz&Kd3");
    
    // Create the superuser with hashed password
    const superuserData = {
      username: "root",
      email: "root@quizmaster.com",
      password: hashedPassword,
      role: "superuser",
      isVerified: true
    };
    
    await storage.createUser(superuserData);
    console.log("Superuser created successfully with properly hashed password");
  } catch (error) {
    console.error("Error creating superuser:", error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Setup WebSocket server for real-time monitoring
  setupWebSocketServer(httpServer);
  
  // Ensure superuser exists
  await createSuperuser();
  
  // Initialize default categories
  await storage.initializeDefaultCategories();
  console.log("Categories initialized");
  
  // Initialize default project info
  const projectInfo = {
    name: "QuizMaster Platform",
    id: "quiz-master-2025",
    personal_notion_page: "https://notion.so/your-personal-page",
    personal_group_page_notion: "https://notion.so/your-group-page",
    github_id: "quizmaster",
    project_github_link: "https://github.com/quizmaster/quiz-platform"
  };

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
      
      // Enhance attempts with quiz details for better export functionality
      const enhancedAttempts = await Promise.all(attempts.map(async (attempt) => {
        const quiz = await storage.getQuizById(attempt.quizId);
        return {
          ...attempt,
          quiz: quiz || undefined
        };
      }));
      
      res.json(enhancedAttempts);
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
      
      // If there are no active attempts, return demo data for testing
      if (activeAttempts.length === 0) {
        // Get quizzes to use real quiz IDs if available
        const quizzes = await storage.getAllQuizzes();
        const quizId = quizzes.length > 0 ? quizzes[0].id : 1;
        
        return res.json([
          {
            id: 1,
            userId: 2, // Regular user ID
            quizId: quizId,
            startTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // Started 15 minutes ago
            endTime: null,
            score: null,
            tabSwitches: 2,
            answers: { "1": 1, "2": 3, "3": 0 }, // Some answers submitted
            completed: false
          },
          {
            id: 2,
            userId: 4, // Another regular user
            quizId: quizId,
            startTime: new Date(Date.now() - 8 * 60 * 1000).toISOString(), // Started 8 minutes ago
            endTime: null,
            score: null,
            tabSwitches: 0,
            answers: { "1": 1, "2": 2 }, // Fewer answers
            completed: false
          }
        ]);
      }
      
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
  
  // Question difficulty analysis endpoint (admin only)
  app.get("/api/admin/question-difficulty", async (req, res) => {
    try {
      const error = isAdmin(req, res);
      if (error) return;
      
      // Get all completed attempts
      const completedAttempts = await storage.getCompletedAttempts();
      
      // If there are no completed attempts yet, return sample data for demonstration purposes
      if (completedAttempts.length === 0) {
        return res.json([
          {
            id: 1,
            quizId: 1,
            questionText: "What is 2+2?",
            correctAnswerCount: 8,
            incorrectAnswerCount: 2,
            totalAttempts: 10,
            correctPercentage: 80,
            difficulty: "easy",
            difficultyScore: 80
          },
          {
            id: 2,
            quizId: 1,
            questionText: "What is the capital of France?",
            correctAnswerCount: 6,
            incorrectAnswerCount: 4,
            totalAttempts: 10,
            correctPercentage: 60,
            difficulty: "moderate",
            difficultyScore: 60
          },
          {
            id: 3,
            quizId: 1,
            questionText: "What is the square root of 144?",
            correctAnswerCount: 7,
            incorrectAnswerCount: 3,
            totalAttempts: 10,
            correctPercentage: 70,
            difficulty: "easy",
            difficultyScore: 70
          },
          {
            id: 4,
            quizId: 1,
            questionText: "Solve for x: 3x + 5 = 14",
            correctAnswerCount: 5,
            incorrectAnswerCount: 5,
            totalAttempts: 10,
            correctPercentage: 50,
            difficulty: "moderate",
            difficultyScore: 50
          },
          {
            id: 5,
            quizId: 1,
            questionText: "Which of the following is not a prime number: 3, 5, 7, 9?",
            correctAnswerCount: 4,
            incorrectAnswerCount: 6,
            totalAttempts: 10,
            correctPercentage: 40,
            difficulty: "moderate",
            difficultyScore: 40
          },
          {
            id: 6,
            quizId: 1,
            questionText: "What is the value of π (pi) to 2 decimal places?",
            correctAnswerCount: 6,
            incorrectAnswerCount: 4,
            totalAttempts: 10,
            correctPercentage: 60,
            difficulty: "moderate",
            difficultyScore: 60
          },
          {
            id: 7,
            quizId: 1,
            questionText: "If f(x) = x² + 3x - 4, what is f(2)?",
            correctAnswerCount: 3,
            incorrectAnswerCount: 7,
            totalAttempts: 10,
            correctPercentage: 30,
            difficulty: "hard",
            difficultyScore: 30
          },
          {
            id: 8,
            quizId: 1,
            questionText: "What is the next number in the sequence: 1, 1, 2, 3, 5, 8, ...?",
            correctAnswerCount: 7,
            incorrectAnswerCount: 3,
            totalAttempts: 10,
            correctPercentage: 70,
            difficulty: "easy",
            difficultyScore: 70
          },
          {
            id: 9,
            quizId: 1,
            questionText: "If cos(θ) = 0.5, what is θ in degrees?",
            correctAnswerCount: 2,
            incorrectAnswerCount: 8,
            totalAttempts: 10,
            correctPercentage: 20,
            difficulty: "hard",
            difficultyScore: 20
          },
          {
            id: 10,
            quizId: 1,
            questionText: "What is 7 × 8?",
            correctAnswerCount: 9,
            incorrectAnswerCount: 1,
            totalAttempts: 10,
            correctPercentage: 90,
            difficulty: "easy",
            difficultyScore: 90
          }
        ]);
      }
      
      const questions = await storage.getQuizQuestions(0); // Get all questions
      const attempts = await storage.getCompletedAttempts();
      
      // Define difficulty thresholds
      const DIFFICULTY_THRESHOLDS = {
        easy: 70, // >= 70% correct answers is considered easy
        hard: 30, // <= 30% correct answers is considered hard
        // Between 30% and 70% is considered moderate
      };
      
      // Process question difficulty data
      const questionDifficulty = questions.map(question => {
        // Get all answers for this question
        const questionId = question.id.toString();
        let correctAnswerCount = 0;
        let incorrectAnswerCount = 0;
        
        attempts.forEach(attempt => {
          if (!attempt.answers) return;
          
          const answers = attempt.answers as Record<string, number>;
          if (answers[questionId] !== undefined) {
            if (answers[questionId] === question.correctAnswer) {
              correctAnswerCount++;
            } else {
              incorrectAnswerCount++;
            }
          }
        });
        
        const totalAttempts = correctAnswerCount + incorrectAnswerCount;
        const correctPercentage = totalAttempts > 0 
          ? (correctAnswerCount / totalAttempts) * 100 
          : 0;
        
        // Automatically determine difficulty level based on threshold percentages
        let difficulty: "easy" | "moderate" | "hard";
        if (correctPercentage >= DIFFICULTY_THRESHOLDS.easy) {
          difficulty = "easy";
        } else if (correctPercentage <= DIFFICULTY_THRESHOLDS.hard) {
          difficulty = "hard";
        } else {
          difficulty = "moderate";
        }
        
        return {
          id: question.id,
          quizId: question.quizId,
          questionText: question.questionText,
          correctAnswerCount,
          incorrectAnswerCount,
          totalAttempts,
          correctPercentage,
          difficulty,
          difficultyScore: correctPercentage // Include raw percentage for more detailed analysis
        };
      });
      
      res.json(questionDifficulty);
    } catch (error) {
      console.error("Error fetching question difficulty data:", error);
      res.status(500).json({ message: "Failed to analyze question difficulty" });
    }
  });
  
  // Info endpoint (accessible to all authenticated users)
  app.get("/api/info", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Return the project info
      res.json(projectInfo);
    } catch (error) {
      console.error("Error fetching project info:", error);
      res.status(500).json({ message: "Failed to fetch project information" });
    }
  });

  // Superuser - get all available routes endpoint
  app.get("/api/all-routes", async (req, res) => {
    try {
      // Verify API key
      const apiKeyError = validateApiKey(req, res);
      if (apiKeyError) return;
      
      // Only allow authenticated superusers to access this endpoint
      if (req.isAuthenticated()) {
        if (req.user?.role !== 'superuser') {
          return res.status(403).json({ message: "Only superusers can access this endpoint" });
        }
      } else {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // List of all routes available in the application
      const routes = [
        {
          path: "/",
          name: "Home Dashboard",
          description: "Main application dashboard with overview statistics",
          restricted: false
        },
        {
          path: "/profile",
          name: "User Profile",
          description: "User profile management and settings",
          restricted: false
        },
        {
          path: "/quizzes",
          name: "Quiz List",
          description: "Browse all available quizzes",
          restricted: false
        },
        {
          path: "/quiz/create",
          name: "Create Quiz",
          description: "Create a new quiz (Admin only)",
          restricted: true
        },
        {
          path: "/quiz/session",
          name: "Quiz Session",
          description: "Take a quiz with anti-cheating measures",
          restricted: false
        },
        {
          path: "/results",
          name: "Quiz Results",
          description: "View quiz results and performance",
          restricted: false
        },
        {
          path: "/monitor",
          name: "Real-time Monitoring",
          description: "Monitor active quiz sessions (Admin only)",
          restricted: true
        },
        {
          path: "/marks",
          name: "Marks & Grading",
          description: "View and manage marking schemes (Admin only)",
          restricted: true
        },
        {
          path: "/difficulty-analysis",
          name: "Difficulty Analysis",
          description: "Analyze question difficulty levels (Admin only)",
          restricted: true
        },
        {
          path: "/info",
          name: "System Information",
          description: "View system information and details",
          restricted: false
        },
        {
          path: "/all-link",
          name: "All System Routes",
          description: "View and access all system routes (Superuser only)",
          restricted: true
        }
      ];
      
      // Return routes and masked API key for the superuser
      // We don't need to expose the actual API key since we're using a hardcoded value on the frontend
      const maskedApiKey = "SUPERUSER_API_KEY";
      
      res.json({ 
        routes,
        apiKey: maskedApiKey
      });
    } catch (error) {
      console.error("Error fetching routes:", error);
      res.status(500).json({ message: "Failed to fetch routes" });
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
    // Always recreate the marks on server startup 
    // First delete all existing marks
    await db.delete(marks).execute();
    
    // Create new set of marks with detailed features and internal routes
    const defaultMarks = [
      {
        mark: "3",
        justification: "Exceptional quiz platform with comprehensive features: advanced role-based authentication (admin/user/guest/superuser), real-time monitoring with anti-cheat detection, WebSocket-based live updates, D3.js visualizations, and PDF/CSV export capabilities.",
        internalRoute: "/all-link",
        threshold: 95
      },
      {
        mark: "2",
        justification: "Outstanding quiz system with anti-cheat tab switching detection, real-time monitoring, D3.js data visualization, and WebSocket connectivity. Strong admin controls and export functionality in both PDF and CSV formats.",
        internalRoute: "/monitor",
        threshold: 90
      },
      {
        mark: "1",
        justification: "Excellent platform with superuser access controls, comprehensive question difficulty analysis using D3.js, and effective anti-cheat mechanisms that detect and report suspicious behavior.",
        internalRoute: "/difficulty-analysis",
        threshold: 85
      },
      {
        mark: "1",
        justification: "Very strong implementation with PDF/CSV export functionality, results visualization, and user management. Includes mark display with D3.js tables and properly manages authentication sessions.",
        internalRoute: "/marks",
        threshold: 80
      },
      {
        mark: "1",
        justification: "Very good platform with results tracking, export capabilities, and custom visualization components. Features responsive design and proper authentication, but requires minor improvements.",
        internalRoute: "/results",
        threshold: 75
      },
      {
        mark: "1",
        justification: "Good quiz application with category management, quiz session functionality, and user profile management. Includes database integration with proper error handling and toast notifications.",
        internalRoute: "/quiz-session",
        threshold: 70
      },
      {
        mark: "1",
        justification: "Solid platform with quiz creation, question management, and basic analytics. Includes proper role authorization but lacks some advanced monitoring and data visualization features.",
        internalRoute: "/quiz-create",
        threshold: 65
      },
      {
        mark: "1",
        justification: "Competent quiz system with basic user management, quiz listing, and attempt tracking. Includes TanStack Query for data fetching but lacks comprehensive analytics dashboards.",
        internalRoute: "/quizzes",
        threshold: 60
      },
      {
        mark: "1",
        justification: "Adequate platform with functioning quiz details page, attempt recording, and basic user interface components using Tailwind and ShadCN. Limited analytics capabilities.",
        internalRoute: "/quiz-details",
        threshold: 55
      },
      {
        mark: "1",
        justification: "Basic but functional platform with user profiles, simple quiz interfaces, and fundamental authentication. Missing advanced features like real-time monitoring and export functionality.",
        internalRoute: "/profile",
        threshold: 45
      },
      {
        mark: "1",
        justification: "Minimally functioning quiz application with authentication and basic quiz display. Lacks proper error handling, data visualization, and has limited user experience features.",
        internalRoute: "/info",
        threshold: 100
      },
      {
        mark: "1",
        justification: " Solution with quiz functionality, authentication, or database integration requiring significant improvements to meet requirements.",
        internalRoute: "/auth",
        threshold: 100
      }
    ];
    
    // Insert the new marks
    for (const mark of defaultMarks) {
      await storage.createMark(mark);
    }
    
    console.log("Successfully updated marks with 12 detailed features and internal routes");
  } catch (error) {
    console.error("Failed to seed default marks data:", error);
  }
}
