import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { setupWebSocketServer } from "./socket";
import { storage } from "./storage";
import { 
  insertQuizSchema, 
  insertQuestionSchema, 
  insertAttemptSchema,
  marks,
  insertMarkSchema
} from "@shared/schema";
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

  // Start a quiz attempt
  app.post("/api/attempts", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
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

  // Update quiz attempt (submit answers, record tab switches)
  app.patch("/api/attempts/:id", async (req, res) => {
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

  // Get user's quiz attempts
  app.get("/api/user/attempts", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
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
