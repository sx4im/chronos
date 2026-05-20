import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").unique(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
}).extend({
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dots, underscores, and hyphens"),
  password: z.string().min(8)
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// IngredientChip type for the IngredientInput component
export const ingredientChipSchema = z.object({
  id: z.string(),
  name: z.string(),
  qty: z.string().optional(),
  unit: z.string().optional(),
  imageId: z.string().optional(),
});

export type IngredientChip = z.infer<typeof ingredientChipSchema>;

// UploadedImage type for image upload functionality
export const uploadedImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  thumbnailUrl: z.string().optional(),
  recognized: z.array(z.object({
    name: z.string(),
    normalized: z.string(),
    confidence: z.number(),
  })).optional(),
});

export type UploadedImage = z.infer<typeof uploadedImageSchema>;

// Search filter preferences
export const searchFiltersSchema = z.object({
  diet: z.enum(["any", "vegan", "vegetarian", "pescatarian", "omnivore"]).default("any"),
  allergies: z.array(z.enum(["peanut", "dairy", "gluten", "shellfish", "tree-nuts", "soy", "eggs", "fish"])).default([]),
  maxCookTime: z.number().min(5).max(240).default(60), // minutes
  cuisine: z.string().optional(),
  difficulty: z.enum(["any", "easy", "medium", "hard"]).default("any"),
  allowSubstitutions: z.boolean().default(true),
  servings: z.number().min(1).max(12).default(4),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;
