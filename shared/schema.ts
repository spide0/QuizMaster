import { pgTable, text, serial, integer, boolean, json, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Role enum
export const roleEnum = pgEnum('role', ['admin', 'user', 'guest', 'superuser']);

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  profilePicture: text("profile_picture"),
  role: roleEnum("role").default('user').notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  verificationToken: text("verification_token"),
  resetToken: text("reset_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Quiz Categories
export const quizCategories = pgTable("quiz_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

// Quiz table
export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  categoryId: integer("category_id").notNull(),
  createdBy: integer("created_by").notNull(), // reference to users.id
  timeLimit: integer("time_limit").notNull(), // in minutes
  passingScore: integer("passing_score").notNull(), // percentage required to pass
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Questions table
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull(), // reference to quizzes.id
  questionText: text("question_text").notNull(),
  options: json("options").notNull(), // array of options
  correctAnswer: integer("correct_answer").notNull(), // index of correct option
  explanation: text("explanation"),
});

// Attempts table
export const attempts = pgTable("attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // reference to users.id
  quizId: integer("quiz_id").notNull(), // reference to quizzes.id
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  score: integer("score"),
  tabSwitches: integer("tab_switches").default(0),
  answers: json("answers"), // Object mapping questionId to selected answer index
  completed: boolean("completed").default(false),
});

// Marks table for D3.js visualization
export const marks = pgTable("marks", {
  id: serial("id").primaryKey(),
  mark: text("mark").notNull(), // e.g. "A", "B", "C", etc.
  justification: text("justification").notNull(),
  internalRoute: text("internal_route").notNull(),
  threshold: integer("threshold").notNull(), // minimum percentage required for this mark
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  profilePicture: true,
  isVerified: true,
  verificationToken: true,
  resetToken: true,
  role: true,
});

export const insertQuizSchema = createInsertSchema(quizzes).omit({
  id: true,
  createdAt: true,
  createdBy: true,
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
});

export const insertAttemptSchema = createInsertSchema(attempts).omit({
  id: true,
  startTime: true,
  endTime: true,
  score: true,
  tabSwitches: true,
  completed: true,
});

export const insertMarkSchema = createInsertSchema(marks).omit({
  id: true,
});

export const loginSchema = z.object({
  email: z.string(), // Accept either email or username
  password: z.string().min(6),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const passwordResetSchema = z.object({
  token: z.string(),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const profileUpdateSchema = z.object({
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
  confirmNewPassword: z.string().min(6),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Passwords don't match",
  path: ["confirmNewPassword"],
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Attempt = typeof attempts.$inferSelect;
export type InsertAttempt = z.infer<typeof insertAttemptSchema>;
export type Mark = typeof marks.$inferSelect;
export type InsertMark = z.infer<typeof insertMarkSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordReset = z.infer<typeof passwordResetSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type PasswordChange = z.infer<typeof passwordChangeSchema>;
