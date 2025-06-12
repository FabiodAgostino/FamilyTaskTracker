import { z } from "zod";

// User schema
export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
  role: z.enum(["admin", "user"]),
});

export const insertUserSchema = userSchema.omit({ id: true });

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Shopping item schema
export const shoppingItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Product name is required"),
  link: z.string().url().optional().or(z.literal("")),
  category: z.string().min(1, "Category is required"),
  createdBy: z.string(),
  createdAt: z.date(),
  completed: z.boolean().default(false),
});

export const insertShoppingItemSchema = shoppingItemSchema.omit({ 
  id: true, 
  createdAt: true 
});

export type ShoppingItem = z.infer<typeof shoppingItemSchema>;
export type InsertShoppingItem = z.infer<typeof insertShoppingItemSchema>;

// Category schema
export const categorySchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Category name is required"),
  createdBy: z.string(),
  createdAt: z.date(),
});

export const insertCategorySchema = categorySchema.omit({ 
  id: true, 
  createdAt: true 
});

export type Category = z.infer<typeof categorySchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

// Note schema
export const noteSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  isPublic: z.boolean().default(false),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  tags: z.array(z.string()).default([]),
});

export const insertNoteSchema = noteSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type Note = z.infer<typeof noteSchema>;
export type InsertNote = z.infer<typeof insertNoteSchema>;

// Calendar event schema
export const calendarEventSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDate: z.date(),
  endDate: z.date(),
  isPublic: z.boolean().default(false),
  createdBy: z.string(),
  eventType: z.enum(["personal", "family", "work"]).default("personal"),
  color: z.string().default("#E07A5F"),
});

export const insertCalendarEventSchema = calendarEventSchema.omit({ id: true });

export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
