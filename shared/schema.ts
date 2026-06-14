import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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

export const userProfiles = pgTable("user_profiles", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  bio: text("bio"),
  location: text("location"),
  website: text("website"),
  avatarUrl: text("avatar_url"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UserProfile = typeof userProfiles.$inferSelect;

export const userSettings = pgTable("user_settings", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  notifications: jsonb("notifications"),
  privacy: jsonb("privacy"),
  cookingPreferences: jsonb("cooking_preferences"),
  accessibility: jsonb("accessibility"),
  dataSync: jsonb("data_sync"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UserSettings = typeof userSettings.$inferSelect;

export const favorites = pgTable(
  "favorites",
  {
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    recipeId: text("recipe_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.recipeId] }),
  }),
);

export type Favorite = typeof favorites.$inferSelect;

export const pantryItems = pgTable("pantry_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: text("quantity").notNull(),
  unit: text("unit").notNull(),
  category: text("category").notNull(),
  expiryDate: timestamp("expiry_date"),
  thumbnail: text("thumbnail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PantryItem = typeof pantryItems.$inferSelect;

export const shoppingLists = pgTable("shopping_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  recipeIds: jsonb("recipe_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ShoppingList = typeof shoppingLists.$inferSelect;

export const shoppingListItems = pgTable("shopping_list_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listId: varchar("list_id").notNull().references(() => shoppingLists.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: text("amount").notNull().default(""),
  unit: text("unit").notNull().default(""),
  category: text("category").notNull().default("other"),
  isPurchased: boolean("is_purchased").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ShoppingListItemRow = typeof shoppingListItems.$inferSelect;

export const collections = pgTable("collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  isPublic: boolean("is_public").notNull().default(false),
  coverImage: text("cover_image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Collection = typeof collections.$inferSelect;

export const collectionRecipes = pgTable(
  "collection_recipes",
  {
    collectionId: varchar("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
    recipeId: text("recipe_id").notNull(),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.collectionId, table.recipeId] }),
  }),
);

export type CollectionRecipe = typeof collectionRecipes.$inferSelect;

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

// Validation schemas for new resources

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  bio: z.string().trim().max(500).optional(),
  location: z.string().trim().max(120).optional(),
  website: z.string().trim().max(255).optional().refine(
    (value) => !value || /^https?:\/\//.test(value),
    { message: "Website must start with http:// or https://" },
  ),
  avatarUrl: z.string().trim().max(2048).optional().refine(
    (value) => !value || /^https?:\/\//.test(value),
    { message: "Avatar URL must start with http:// or https://" },
  ),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export const pantryItemInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  quantity: z.union([z.string().trim().min(1).max(20), z.number()]).transform((v) => String(v)),
  unit: z.string().trim().min(1).max(20),
  category: z.string().trim().min(1).max(30),
  expiryDate: z.string().datetime().optional().nullable(),
  thumbnail: z.string().trim().max(2048).optional().nullable(),
});

export type PantryItemInput = z.infer<typeof pantryItemInputSchema>;

export const shoppingListInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  recipeIds: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
});

export const shoppingListItemInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  amount: z.union([z.string().trim().max(20), z.number()]).optional().transform((v) => v === undefined ? "" : String(v)),
  unit: z.string().trim().max(20).default(""),
  category: z.string().trim().max(30).default("other"),
  isPurchased: z.boolean().default(false),
});

export const shoppingListItemUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  amount: z.union([z.string().trim().max(20), z.number()]).optional().transform((v) => v === undefined ? undefined : String(v)),
  unit: z.string().trim().max(20).optional(),
  category: z.string().trim().max(30).optional(),
  isPurchased: z.boolean().optional(),
});

export const collectionInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
  isPublic: z.boolean().default(false),
  coverImage: z.string().trim().max(2048).optional().nullable(),
});

export const collectionUpdateSchema = collectionInputSchema.partial();

export const settingsUpdateSchema = z.object({
  notifications: z.record(z.unknown()).optional(),
  privacy: z.record(z.unknown()).optional(),
  cookingPreferences: z.record(z.unknown()).optional(),
  accessibility: z.record(z.unknown()).optional(),
  dataSync: z.record(z.unknown()).optional(),
});

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
