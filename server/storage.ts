import { IStorage } from "./storage";
import session from "express-session";
import createMemoryStore from "memorystore";
import { 
  User, 
  InsertUser, 
  Quiz, 
  Question, 
  Attempt, 
  InsertQuestion,
  InsertAttempt,
  Mark,
  InsertMark,
  ProfileUpdate
} from "@shared/schema";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser & { verificationToken?: string }): Promise<User>;
  updateUserProfile(userId: number, profileData: ProfileUpdate): Promise<User>;
  updateProfilePicture(userId: number, profilePicture: string): Promise<User>;
  updatePassword(userId: number, password: string): Promise<void>;
  verifyUser(userId: number): Promise<void>;
  setResetToken(userId: number, token: string): Promise<void>;
  clearResetToken(userId: number): Promise<void>;
  deleteUser(userId: number): Promise<void>;
  
  // Quiz management
  getAllQuizzes(): Promise<Quiz[]>;
  getQuizById(id: number): Promise<Quiz | undefined>;
  createQuiz(quiz: any): Promise<Quiz>;
  
  // Questions management
  getQuizQuestions(quizId: number): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  
  // Attempt management
  getAttemptById(id: number): Promise<Attempt | undefined>;
  getOngoingAttempt(userId: number, quizId: number): Promise<Attempt | undefined>;
  createAttempt(attempt: InsertAttempt): Promise<Attempt>;
  updateAttemptAnswers(attemptId: number, answers: Record<string, number>): Promise<Attempt>;
  incrementTabSwitches(attemptId: number): Promise<Attempt>;
  completeAttempt(attemptId: number, score: number): Promise<Attempt>;
  getUserAttempts(userId: number): Promise<Attempt[]>;
  getActiveAttempts(): Promise<Attempt[]>;
  
  // Mark management
  getAllMarks(): Promise<Mark[]>;
  createMark(mark: InsertMark): Promise<Mark>;
  
  // Category management
  getAllCategories(): Promise<{ id: number, name: string }[]>;
  
  // Session store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private quizzes: Map<number, Quiz>;
  private questions: Map<number, Question>;
  private attempts: Map<number, Attempt>;
  private marks: Map<number, Mark>;
  private categories: Map<number, { id: number, name: string }>;
  private userIdCounter: number;
  private quizIdCounter: number;
  private questionIdCounter: number;
  private attemptIdCounter: number;
  private markIdCounter: number;
  private categoryIdCounter: number;
  sessionStore: session.SessionStore;

  constructor() {
    this.users = new Map();
    this.quizzes = new Map();
    this.questions = new Map();
    this.attempts = new Map();
    this.marks = new Map();
    this.categories = new Map();
    this.userIdCounter = 1;
    this.quizIdCounter = 1;
    this.questionIdCounter = 1;
    this.attemptIdCounter = 1;
    this.markIdCounter = 1;
    this.categoryIdCounter = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
    
    // Initialize with default categories
    this.initializeDefaultCategories();
  }

  // Initialize default categories
  private async initializeDefaultCategories() {
    const defaultCategories = [
      "Mathematics",
      "Science",
      "Language",
      "History",
      "Geography",
      "Computer Science",
      "Other"
    ];
    
    for (const category of defaultCategories) {
      const id = this.categoryIdCounter++;
      this.categories.set(id, { id, name: category });
    }
  }

  // User management
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.verificationToken === token,
    );
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.resetToken === token,
    );
  }

  async createUser(userData: InsertUser & { verificationToken?: string }): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    
    const user: User = {
      id,
      username: userData.username,
      email: userData.email,
      password: userData.password,
      profilePicture: null,
      role: 'user', // Default role
      isVerified: false,
      verificationToken: userData.verificationToken || null,
      resetToken: null,
      createdAt: now
    };
    
    this.users.set(id, user);
    return user;
  }

  async updateUserProfile(userId: number, profileData: ProfileUpdate): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = {
      ...user,
      ...(profileData.username && { username: profileData.username }),
      ...(profileData.email && { email: profileData.email })
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateProfilePicture(userId: number, profilePicture: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = {
      ...user,
      profilePicture
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updatePassword(userId: number, password: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    this.users.set(userId, { ...user, password });
  }

  async verifyUser(userId: number): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    this.users.set(userId, { 
      ...user, 
      isVerified: true,
      verificationToken: null 
    });
  }

  async setResetToken(userId: number, token: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    this.users.set(userId, { ...user, resetToken: token });
  }

  async clearResetToken(userId: number): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    this.users.set(userId, { ...user, resetToken: null });
  }

  async deleteUser(userId: number): Promise<void> {
    // Delete the user
    this.users.delete(userId);
    
    // Delete user's attempts
    const userAttempts = Array.from(this.attempts.values())
      .filter(attempt => attempt.userId === userId);
    
    for (const attempt of userAttempts) {
      this.attempts.delete(attempt.id);
    }
    
    // If user created quizzes, optionally delete them here
    // For this example, we'll keep the quizzes for data integrity
  }

  // Quiz management
  async getAllQuizzes(): Promise<Quiz[]> {
    return Array.from(this.quizzes.values());
  }

  async getQuizById(id: number): Promise<Quiz | undefined> {
    return this.quizzes.get(id);
  }

  async createQuiz(quizData: any): Promise<Quiz> {
    const id = this.quizIdCounter++;
    const now = new Date();
    
    const quiz: Quiz = {
      id,
      title: quizData.title,
      description: quizData.description || null,
      categoryId: quizData.categoryId,
      createdBy: quizData.createdBy,
      timeLimit: quizData.timeLimit,
      passingScore: quizData.passingScore,
      createdAt: now
    };
    
    this.quizzes.set(id, quiz);
    return quiz;
  }

  // Questions management
  async getQuizQuestions(quizId: number): Promise<Question[]> {
    return Array.from(this.questions.values())
      .filter(question => question.quizId === quizId);
  }

  async createQuestion(questionData: InsertQuestion): Promise<Question> {
    const id = this.questionIdCounter++;
    
    const question: Question = {
      id,
      quizId: questionData.quizId,
      questionText: questionData.questionText,
      options: questionData.options,
      correctAnswer: questionData.correctAnswer,
      explanation: questionData.explanation || null
    };
    
    this.questions.set(id, question);
    return question;
  }

  // Attempt management
  async getAttemptById(id: number): Promise<Attempt | undefined> {
    return this.attempts.get(id);
  }

  async getOngoingAttempt(userId: number, quizId: number): Promise<Attempt | undefined> {
    return Array.from(this.attempts.values()).find(
      (attempt) => attempt.userId === userId && 
                 attempt.quizId === quizId && 
                 !attempt.completed
    );
  }

  async createAttempt(attemptData: InsertAttempt): Promise<Attempt> {
    const id = this.attemptIdCounter++;
    const now = new Date();
    
    const attempt: Attempt = {
      id,
      userId: attemptData.userId,
      quizId: attemptData.quizId,
      startTime: now,
      endTime: null,
      score: null,
      tabSwitches: 0,
      answers: {},
      completed: false
    };
    
    this.attempts.set(id, attempt);
    return attempt;
  }

  async updateAttemptAnswers(attemptId: number, answers: Record<string, number>): Promise<Attempt> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) {
      throw new Error("Attempt not found");
    }
    
    const updatedAttempt = {
      ...attempt,
      answers: { ...attempt.answers, ...answers }
    };
    
    this.attempts.set(attemptId, updatedAttempt);
    return updatedAttempt;
  }

  async incrementTabSwitches(attemptId: number): Promise<Attempt> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) {
      throw new Error("Attempt not found");
    }
    
    const updatedAttempt = {
      ...attempt,
      tabSwitches: attempt.tabSwitches + 1
    };
    
    this.attempts.set(attemptId, updatedAttempt);
    return updatedAttempt;
  }

  async completeAttempt(attemptId: number, score: number): Promise<Attempt> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) {
      throw new Error("Attempt not found");
    }
    
    const now = new Date();
    
    const updatedAttempt = {
      ...attempt,
      endTime: now,
      score,
      completed: true
    };
    
    this.attempts.set(attemptId, updatedAttempt);
    return updatedAttempt;
  }

  async getUserAttempts(userId: number): Promise<Attempt[]> {
    return Array.from(this.attempts.values())
      .filter(attempt => attempt.userId === userId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime()); // Sort by start time, newest first
  }

  async getActiveAttempts(): Promise<Attempt[]> {
    return Array.from(this.attempts.values())
      .filter(attempt => !attempt.completed);
  }

  // Mark management
  async getAllMarks(): Promise<Mark[]> {
    return Array.from(this.marks.values())
      .sort((a, b) => b.threshold - a.threshold); // Sort by threshold, highest first
  }

  async createMark(markData: InsertMark): Promise<Mark> {
    const id = this.markIdCounter++;
    
    const mark: Mark = {
      id,
      mark: markData.mark,
      justification: markData.justification,
      internalRoute: markData.internalRoute,
      threshold: markData.threshold
    };
    
    this.marks.set(id, mark);
    return mark;
  }

  // Category management
  async getAllCategories(): Promise<{ id: number, name: string }[]> {
    return Array.from(this.categories.values());
  }
}

export const storage = new MemStorage();
