import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { randomBytes, timingSafeEqual } from "crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import {
  collectionInputSchema,
  collectionUpdateSchema,
  insertUserSchema,
  pantryItemInputSchema,
  profileUpdateSchema,
  settingsUpdateSchema,
  shoppingListInputSchema,
  shoppingListItemInputSchema,
  shoppingListItemUpdateSchema,
  type User,
} from "../shared/schema";
import { extractIngredientsFromImage, recommendRecipes } from "./lib/ai";

const authRegisterSchema = insertUserSchema.pick({
  name: true,
  username: true,
  password: true,
}).extend({
  name: z.string().trim().min(2).max(80),
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dots, underscores, and hyphens").transform((value) => value.toLowerCase()),
});

const authLoginSchema = z.object({
  username: z.string().trim().min(1).transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

function toClientUser(user: User, profile?: { bio?: string | null; location?: string | null; website?: string | null; avatarUrl?: string | null }) {
  const { password: _, ...userWithoutPassword } = user;
  return {
    ...userWithoutPassword,
    email: user.email ?? "",
    role: "user" as const,
    joinDate: new Date().toISOString(),
    bio: profile?.bio ?? "",
    location: profile?.location ?? "",
    website: profile?.website ?? "",
    avatar: profile?.avatarUrl ?? undefined,
  };
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authenticated = typeof req.isAuthenticated === "function" && req.isAuthenticated();
  if (!authenticated || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
}

function getAuthUserId(req: Request): string {
  return (req.user as User).id;
}

// Passport configuration
passport.use(
  new LocalStrategy(
    {
      usernameField: 'username',
      passwordField: 'password',
    },
    async (username, password, done) => {
      try {
        const parsed = authLoginSchema.safeParse({ username, password });
        if (!parsed.success) {
          return done(null, false, { message: 'Incorrect username or password.' });
        }
        const user = await storage.getUserByUsername(parsed.data.username);
        if (!user) {
          return done(null, false, { message: 'Incorrect username or password.' });
        }
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return done(null, false, { message: 'Incorrect username or password.' });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, (user as User).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Simple in-memory data for ingredients and recipes
const ingredientsDatabase = [
  { name: "Tomato", score: 0.95 },
  { name: "Basil", score: 0.92 },
  { name: "Mozzarella", score: 0.90 },
  { name: "Chicken", score: 0.98 },
  { name: "Onion", score: 0.96 },
  { name: "Garlic", score: 0.94 },
  { name: "Pasta", score: 0.88 },
  { name: "Rice", score: 0.86 },
  { name: "Cheese", score: 0.89 },
  { name: "Beef", score: 0.93 },
  { name: "Olive Oil", score: 0.85 },
  { name: "Salt", score: 0.99 },
  { name: "Pepper", score: 0.97 },
  { name: "Lemon", score: 0.84 },
  { name: "Spinach", score: 0.82 },
  { name: "Mushroom", score: 0.81 },
  { name: "Bell Pepper", score: 0.80 },
  { name: "Carrot", score: 0.83 },
  { name: "Potato", score: 0.87 },
  { name: "Egg", score: 0.91 }
];

const recipesDatabase = [
  {
    id: "caprese-salad",
    slug: "caprese-salad",
    title: "Fresh Caprese Salad",
    description: "A classic Italian salad with fresh tomatoes, mozzarella, and basil.",
    image: "https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?ixlib=rb-4.0.3&w=600&h=400&fit=crop",
    cookTime: 15,
    prepTime: 10,
    servings: 4,
    difficulty: "Easy" as const,
    rating: 4.8,
    reviewCount: 124,
    author: {
      name: "Chef Maria",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?ixlib=rb-4.0.3&w=100&h=100&fit=crop&crop=face"
    },
    ingredients: [
      { 
        id: "tomato-1",
        name: "Tomato", 
        amount: 4, 
        unit: "large",
        thumbnail: "https://images.unsplash.com/photo-1592924357228-91b4e4a8b5f3?ixlib=rb-4.0.3&w=50&h=50&fit=crop",
        substitutes: [
          { name: "Cherry Tomatoes", confidence: 0.9, ratio: "1 cup" },
          { name: "Roma Tomatoes", confidence: 0.8, ratio: "3 medium" }
        ]
      },
      { 
        id: "mozzarella-1",
        name: "Mozzarella", 
        amount: 200, 
        unit: "g",
        thumbnail: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?ixlib=rb-4.0.3&w=50&h=50&fit=crop",
        substitutes: [
          { name: "Burrata", confidence: 0.95, ratio: "200g" },
          { name: "Fresh Mozzarella", confidence: 0.9, ratio: "200g" }
        ]
      },
      { 
        id: "basil-1",
        name: "Basil", 
        amount: 10, 
        unit: "leaves",
        thumbnail: "https://images.unsplash.com/photo-1615485925544-4c8b2a8a8b8b?ixlib=rb-4.0.3&w=50&h=50&fit=crop"
      },
      { 
        id: "olive-oil-1",
        name: "Olive Oil", 
        amount: 3, 
        unit: "tbsp",
        thumbnail: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?ixlib=rb-4.0.3&w=50&h=50&fit=crop"
      },
      { 
        id: "salt-1",
        name: "Salt", 
        amount: 1, 
        unit: "tsp"
      },
      { 
        id: "pepper-1",
        name: "Pepper", 
        amount: 0.5, 
        unit: "tsp"
      }
    ],
    instructions: [
      { step: 1, description: "Slice the tomatoes and mozzarella into 1/4-inch thick rounds.", time_min: 5 },
      { step: 2, description: "Arrange alternating slices of tomato and mozzarella on a serving platter.", time_min: 3 },
      { step: 3, description: "Tuck fresh basil leaves between the slices.", time_min: 2 },
      { step: 4, description: "Drizzle with olive oil and season with salt and pepper.", time_min: 1 },
      { step: 5, description: "Let stand for 10 minutes before serving to allow flavors to meld.", time_min: 10 }
    ],
    tags: ["Quick", "Fresh", "Italian", "Vegetarian"],
    nutrition: {
      calories: 180,
      protein: "12g",
      carbs: "8g",
      fat: "14g",
      fiber: "2g",
      sugar: "6g"
    }
  },
  {
    id: "chicken-stir-fry",
    slug: "chicken-stir-fry",
    title: "Garden Vegetable Stir Fry",
    description: "Quick and nutritious stir fry with seasonal vegetables and aromatic spices.",
    image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?ixlib=rb-4.0.3&w=600&h=400&fit=crop",
    cookTime: 25,
    prepTime: 15,
    servings: 3,
    difficulty: "Medium" as const,
    rating: 4.6,
    reviewCount: 89,
    author: {
      name: "Chef Alex",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&w=100&h=100&fit=crop&crop=face"
    },
    ingredients: [
      { 
        id: "chicken-1",
        name: "Chicken", 
        amount: 300, 
        unit: "g",
        thumbnail: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?ixlib=rb-4.0.3&w=50&h=50&fit=crop"
      },
      { 
        id: "bell-pepper-1",
        name: "Bell Pepper", 
        amount: 2, 
        unit: "medium",
        thumbnail: "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?ixlib=rb-4.0.3&w=50&h=50&fit=crop"
      },
      { 
        id: "onion-1",
        name: "Onion", 
        amount: 1, 
        unit: "large",
        thumbnail: "https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?ixlib=rb-4.0.3&w=50&h=50&fit=crop"
      },
      { 
        id: "garlic-1",
        name: "Garlic", 
        amount: 3, 
        unit: "cloves",
        thumbnail: "https://images.unsplash.com/photo-1583394838336-acd977736f90?ixlib=rb-4.0.3&w=50&h=50&fit=crop"
      },
      { 
        id: "olive-oil-2",
        name: "Olive Oil", 
        amount: 2, 
        unit: "tbsp",
        thumbnail: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?ixlib=rb-4.0.3&w=50&h=50&fit=crop"
      },
      { 
        id: "salt-2",
        name: "Salt", 
        amount: 1, 
        unit: "tsp"
      },
      { 
        id: "pepper-2",
        name: "Pepper", 
        amount: 0.5, 
        unit: "tsp"
      }
    ],
    instructions: [
      { step: 1, description: "Cut chicken into bite-sized pieces and season with salt and pepper.", time_min: 5 },
      { step: 2, description: "Heat oil in a large skillet or wok over medium-high heat.", time_min: 2 },
      { step: 3, description: "Add chicken and cook until golden brown, about 5-6 minutes.", time_min: 6 },
      { step: 4, description: "Add vegetables and garlic, stir-fry for 8-10 minutes until tender-crisp.", time_min: 10 },
      { step: 5, description: "Season with additional salt and pepper to taste. Serve immediately.", time_min: 2 }
    ],
    tags: ["Healthy", "Quick", "High Protein"],
    nutrition: {
      calories: 220,
      protein: "25g",
      carbs: "12g",
      fat: "8g",
      fiber: "3g",
      sugar: "8g"
    }
  },
  {
    id: "pasta-marinara",
    slug: "pasta-marinara",
    title: "Classic Pasta Marinara",
    description: "Authentic Italian pasta with homemade marinara sauce and fresh herbs.",
    image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?ixlib=rb-4.0.3&w=600&h=400&fit=crop",
    cookTime: 45,
    prepTime: 15,
    servings: 4,
    difficulty: "Easy" as const,
    rating: 4.9,
    reviewCount: 203,
    author: {
      name: "Chef Marco",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&w=100&h=100&fit=crop&crop=face"
    },
    ingredients: [
      { 
        id: "pasta-1",
        name: "Pasta", 
        amount: 400, 
        unit: "g",
        thumbnail: "https://images.unsplash.com/photo-1551892374-ecf8754cf8b0?ixlib=rb-4.0.3&w=50&h=50&fit=crop"
      },
      { 
        id: "tomato-2",
        name: "Tomato", 
        amount: 6, 
        unit: "large",
        thumbnail: "https://images.unsplash.com/photo-1592924357228-91b4e4a8b5f3?ixlib=rb-4.0.3&w=50&h=50&fit=crop"
      },
      { 
        id: "garlic-2",
        name: "Garlic", 
        amount: 4, 
        unit: "cloves",
        thumbnail: "https://images.unsplash.com/photo-1583394838336-acd977736f90?ixlib=rb-4.0.3&w=50&h=50&fit=crop"
      },
      { 
        id: "onion-2",
        name: "Onion", 
        amount: 1, 
        unit: "medium",
        thumbnail: "https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?ixlib=rb-4.0.3&w=50&h=50&fit=crop"
      },
      { 
        id: "olive-oil-3",
        name: "Olive Oil", 
        amount: 3, 
        unit: "tbsp",
        thumbnail: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?ixlib=rb-4.0.3&w=50&h=50&fit=crop"
      },
      { 
        id: "basil-2",
        name: "Basil", 
        amount: 15, 
        unit: "leaves",
        thumbnail: "https://images.unsplash.com/photo-1615485925544-4c8b2a8a8b8b?ixlib=rb-4.0.3&w=50&h=50&fit=crop"
      },
      { 
        id: "salt-3",
        name: "Salt", 
        amount: 1, 
        unit: "tsp"
      },
      { 
        id: "pepper-3",
        name: "Pepper", 
        amount: 0.5, 
        unit: "tsp"
      }
    ],
    instructions: [
      { step: 1, description: "Bring a large pot of salted water to boil for pasta.", time_min: 10 },
      { step: 2, description: "Heat olive oil in a large saucepan and sauté onion until soft.", time_min: 5 },
      { step: 3, description: "Add garlic and cook for 1 minute until fragrant.", time_min: 1 },
      { step: 4, description: "Add chopped tomatoes and simmer for 20 minutes until thick.", time_min: 20 },
      { step: 5, description: "Cook pasta according to package directions, drain and toss with sauce.", time_min: 12 },
      { step: 6, description: "Garnish with fresh basil and serve immediately.", time_min: 2 }
    ],
    tags: ["Comfort", "Italian", "Classic"],
    nutrition: {
      calories: 380,
      protein: "14g",
      carbs: "72g",
      fat: "6g",
      fiber: "4g",
      sugar: "12g"
    }
  }
];

function findRecipeSummary(recipeId: string) {
  const recipe = recipesDatabase.find((r) => r.id === recipeId || r.slug === recipeId);
  if (!recipe) return null;
  return {
    id: recipe.id,
    slug: recipe.slug,
    title: recipe.title,
    description: recipe.description,
    image: recipe.image,
    cookTime: recipe.cookTime,
    prepTime: recipe.prepTime,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    rating: recipe.rating,
    reviewCount: recipe.reviewCount,
    tags: recipe.tags,
  };
}

const ingredientsQuerySchema = z.object({
  q: z.string().min(1).optional()
});

const recipeParamsSchema = z.object({
  slug: z.string().min(1)
});

const uploadSignRequestSchema = z.object({
  filename: z.string().min(1).max(255).regex(/^[A-Za-z0-9._-]+$/),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z.number().int().positive().max(5 * 1024 * 1024)
});

const uploadCompleteSchema = z.object({
  image_id: z.string(),
  url: z.string().url().refine(
    (url) => {
      try {
        const u = new URL(url);
        return u.protocol === 'https:' && ['mock-storage.example.com'].includes(u.hostname);
      } catch {
        return false;
      }
    },
    { message: 'Invalid URL' }
  ),
  metadata: z.object({}).optional()
});

const recognizeImageSchema = z.object({
  image_id: z.string(),
  mode: z.literal('vision'),
  max_suggestions: z.number().int().min(1).max(20).default(5)
});

const extractIngredientsSchema = z.object({
  image: z.string().min(1).max(7 * 1024 * 1024).refine(
    (value) => isSupportedImageSource(value),
    { message: "Image must be a data URI or HTTPS URL" }
  ),
});

const recommendRecipesSchema = z.object({
  ingredients: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
});

const MAX_QUERY_ITEMS = 50;
const MAX_QUERY_VALUE_LENGTH = 100;

function isSupportedImageSource(value: string): boolean {
  if (/^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseDelimitedQueryList(value: unknown): string[] {
  if (typeof value !== "string") return [];

  return value
    .slice(0, MAX_QUERY_ITEMS * MAX_QUERY_VALUE_LENGTH)
    .split(",")
    .map((item) => item.trim().toLowerCase().slice(0, MAX_QUERY_VALUE_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_QUERY_ITEMS);
}

function csvEscape(value: unknown): string {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function safeCompare(secret: string, provided: string): boolean {
  const secretBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(provided);

  if (secretBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(secretBuffer, providedBuffer);
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const currentAdminKey = process.env.ADMIN_API_KEY;
  const providedKey = req.header("x-admin-key");
  if (!currentAdminKey || !providedKey || !safeCompare(currentAdminKey, providedKey)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  return next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  const imageExtractionJsonParser = express.json({ limit: "7mb" });

  const externalApiRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 429,
      message: "Too many requests. Please try again in a minute.",
    },
  });

  // Additional rate limiters
  const uploadRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 429,
      message: "Too many upload requests. Please try again later."
    }
  });

  const adminRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 429,
      message: "Too many admin requests. Please try again later."
    }
  });

  const aiRecipeRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const user = req.user as User | undefined;
      if (req.isAuthenticated() && user?.id) {
        return `user:${user.id}`;
      }
      return `ip:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`;
    },
    message: {
      status: 429,
      message: "Too many AI recipe requests. Please try again later."
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Ingredients search endpoint
  app.get("/api/ingredients", externalApiRateLimit, (req, res) => {
    try {
      const { q } = ingredientsQuerySchema.parse(req.query);
      
      if (!q) {
        return res.json({
          suggestions: [],
          popular: ingredientsDatabase.slice(0, 8)
        });
      }

      const query = q.toLowerCase();
      const suggestions = ingredientsDatabase
        .filter(ingredient => 
          ingredient.name.toLowerCase().includes(query)
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      res.json({
        suggestions,
        popular: ingredientsDatabase.slice(0, 8)
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid query parameters" });
    }
  });

  // Recipes search endpoint
  app.get("/api/recipes", externalApiRateLimit, (req, res) => {
    try {
      const {
        ingredients,
        diet,
        allergies,
        maxCookTime,
        cuisine,
        difficulty,
        allowSubstitutions,
        servings
      } = req.query;
      
      // If no ingredients specified, return all recipes
      if (!ingredients) {
        return res.json({ recipes: recipesDatabase, total: recipesDatabase.length });
      }

      const ingredientList = parseDelimitedQueryList(ingredients);
      
      // Start with ingredient-based filtering
      let matchingRecipes = recipesDatabase.filter(recipe => 
        recipe.ingredients.some(ingredient => 
          ingredientList.some(reqIngredient => 
            ingredient.name.toLowerCase().includes(reqIngredient)
          )
        )
      );

      // Apply additional filters
      if (diet && diet !== 'any') {
        matchingRecipes = matchingRecipes.filter(recipe => 
          recipe.tags.some(tag => tag.toLowerCase().includes(diet as string))
        );
      }

      if (allergies) {
        const allergyList = parseDelimitedQueryList(allergies);
        matchingRecipes = matchingRecipes.filter(recipe => 
          !allergyList.some(allergy => 
            recipe.ingredients.some(ingredient => 
              ingredient.name.toLowerCase().includes(allergy) ||
              recipe.tags.some(tag => tag.toLowerCase().includes(allergy))
            )
          )
        );
      }

      if (maxCookTime) {
        const maxTime = parseInt(maxCookTime as string, 10);
        if (!isNaN(maxTime) && maxTime > 0) {
          matchingRecipes = matchingRecipes.filter(recipe => recipe.cookTime <= maxTime);
        }
      }

      if (cuisine) {
        matchingRecipes = matchingRecipes.filter(recipe => 
          recipe.tags.some(tag => tag.toLowerCase().includes((cuisine as string).toLowerCase()))
        );
      }

      if (difficulty && difficulty !== 'any') {
        matchingRecipes = matchingRecipes.filter(recipe => 
          recipe.difficulty.toLowerCase() === (difficulty as string).toLowerCase()
        );
      }

      // Note: allowSubstitutions and servings would be used in recipe recommendation logic
      // For now, we'll just acknowledge them in the filtering

      res.json({
        recipes: matchingRecipes,
        total: matchingRecipes.length
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid query parameters" });
    }
  });

  app.post("/api/recipes/recommend", aiRecipeRateLimit, async (req, res, next) => {
    const abortController = new AbortController();
    req.on("close", () => abortController.abort());

    try {
      const { ingredients } = recommendRecipesSchema.parse(req.body);

      res.status(200);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      for await (const chunk of recommendRecipes(ingredients, { signal: abortController.signal })) {
        if (res.destroyed) break;
        if (!res.write(chunk)) {
          await new Promise<void>((resolve) => res.once("drain", resolve));
        }
      }

      res.end();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid recipe recommendation request", errors: error.errors });
      }
      if (res.headersSent) {
        res.destroy(error instanceof Error ? error : undefined);
        return;
      }
      next(error);
    }
  });

  // Single recipe endpoint
  app.get("/api/recipe/:slug", externalApiRateLimit, (req, res) => {
    try {
      const { slug } = recipeParamsSchema.parse(req.params);
      
      const recipe = recipesDatabase.find(r => r.slug === slug || r.id === slug);
      
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      
      res.json(recipe);
    } catch (error) {
      res.status(400).json({ message: "Invalid recipe ID" });
    }
  });

  // Similar recipes endpoint
  app.get("/api/recipe/:id/similar", externalApiRateLimit, (req, res) => {
    try {
      const { id } = req.params;
      const recipe = recipesDatabase.find(r => r.id === id);
      
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      
      // Find similar recipes based on tags and difficulty
      const similar = recipesDatabase
        .filter(r => r.id !== id)
        .filter(r => 
          r.difficulty === recipe.difficulty || 
          r.tags.some(tag => recipe.tags.includes(tag))
        )
        .slice(0, 3)
        .map(r => ({
          id: r.id,
          slug: r.slug,
          title: r.title,
          image: r.image,
          cookTime: r.cookTime,
          rating: r.rating
        }));
      
      res.json(similar);
    } catch (error) {
      res.status(400).json({ message: "Invalid recipe ID" });
    }
  });

  // Save recipe endpoint
  app.post("/api/recipe/:id/save", externalApiRateLimit, requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const { id } = req.params;
      const recipe = recipesDatabase.find((r) => r.id === id || r.slug === id);
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      await storage.addFavorite(userId, recipe.id);
      res.json({ success: true, recipeId: recipe.id, saved: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/recipe/:id/unsave", externalApiRateLimit, requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const { id } = req.params;
      const recipe = recipesDatabase.find((r) => r.id === id || r.slug === id);
      const recipeId = recipe?.id ?? id;
      await storage.removeFavorite(userId, recipeId);
      res.json({ success: true, recipeId, saved: false });
    } catch (error) {
      next(error);
    }
  });

  // Recipe progress tracking endpoint
  app.post("/api/recipe/:id/progress", externalApiRateLimit, (req, res) => {
    try {
      const { id } = req.params;
      const { type, itemId } = req.body;
      
      const recipe = recipesDatabase.find(r => r.id === id);
      
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      
      // In a real app, this would save progress to database
      res.json({ 
        message: "Progress updated successfully", 
        recipeId: id, 
        type, 
        itemId 
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Profile endpoint
  app.get("/api/profile", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const profile = await storage.getProfile(userId);
      const [favoriteRows, collectionRows] = await Promise.all([
        storage.listFavorites(userId),
        storage.listCollections(userId),
      ]);
      res.json({
        ...toClientUser(user, profile),
        stats: {
          savedRecipes: favoriteRows.length,
          cookedRecipes: 0,
          collections: collectionRows.length,
          followers: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/profile", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const updates = profileUpdateSchema.parse(req.body);

      const userPatch: { name?: string; email?: string | null } = {};
      if (updates.name !== undefined) userPatch.name = updates.name;
      if (updates.email !== undefined) userPatch.email = updates.email === "" ? null : updates.email;

      const updatedUser = await storage.updateUser(userId, userPatch);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const profilePatch = {
        bio: updates.bio,
        location: updates.location,
        website: updates.website,
        avatarUrl: updates.avatarUrl,
      };
      const profile = await storage.upsertProfile(userId, profilePatch);

      res.json(toClientUser(updatedUser, profile));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
      }
      next(error);
    }
  });

  // User's saved recipes (favorites)
  app.get("/api/profile/saved-recipes", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const rows = await storage.listFavorites(userId);
      const recipes = rows
        .map((row) => {
          const summary = findRecipeSummary(row.recipeId);
          if (!summary) return null;
          return { ...summary, savedAt: row.createdAt };
        })
        .filter((value): value is NonNullable<typeof value> => value !== null);
      res.json(recipes);
    } catch (error) {
      next(error);
    }
  });

  // User's recent recipes — currently returns last saved recipes ordered by save time
  app.get("/api/profile/recent-recipes", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const rows = await storage.listFavorites(userId);
      const recipes = rows
        .slice(0, 5)
        .map((row) => {
          const summary = findRecipeSummary(row.recipeId);
          if (!summary) return null;
          return { ...summary, lastCooked: row.createdAt };
        })
        .filter((value): value is NonNullable<typeof value> => value !== null);
      res.json(recipes);
    } catch (error) {
      next(error);
    }
  });

  // User's collections
  app.get("/api/profile/collections", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const rows = await storage.listCollections(userId);
      const withCounts = await Promise.all(
        rows.map(async (collection) => {
          const recipeIds = await storage.listCollectionRecipes(collection.id);
          return {
            id: collection.id,
            name: collection.name,
            description: collection.description,
            isPublic: collection.isPublic,
            coverImage: collection.coverImage,
            recipeCount: recipeIds.length,
            createdAt: collection.createdAt,
          };
        }),
      );
      res.json(withCounts);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/profile/collections", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const input = collectionInputSchema.parse(req.body);
      const collection = await storage.createCollection(userId, {
        name: input.name,
        description: input.description,
        isPublic: input.isPublic,
        coverImage: input.coverImage ?? null,
      });
      res.status(201).json({ ...collection, recipeCount: 0 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid collection data", errors: error.errors });
      }
      next(error);
    }
  });

  app.patch("/api/profile/collections/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const input = collectionUpdateSchema.parse(req.body);
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.description !== undefined) patch.description = input.description;
      if (input.isPublic !== undefined) patch.isPublic = input.isPublic;
      if (input.coverImage !== undefined) patch.coverImage = input.coverImage ?? null;

      const collection = await storage.updateCollection(userId, req.params.id, patch);
      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }
      const recipeIds = await storage.listCollectionRecipes(collection.id);
      res.json({ ...collection, recipeCount: recipeIds.length });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid collection data", errors: error.errors });
      }
      next(error);
    }
  });

  app.delete("/api/profile/collections/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const removed = await storage.deleteCollection(userId, req.params.id);
      if (!removed) {
        return res.status(404).json({ message: "Collection not found" });
      }
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/profile/collections/:id/recipes", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const collection = await storage.getCollection(userId, req.params.id);
      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }
      const recipeIds = await storage.listCollectionRecipes(collection.id);
      const recipes = recipeIds
        .map((id) => findRecipeSummary(id))
        .filter((value): value is NonNullable<typeof value> => value !== null);
      res.json({ collection, recipes });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/profile/collections/:id/recipes", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const collection = await storage.getCollection(userId, req.params.id);
      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }
      const body = z.object({ recipeId: z.string().trim().min(1).max(200) }).parse(req.body);
      await storage.addCollectionRecipe(collection.id, body.recipeId);
      res.status(201).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      next(error);
    }
  });

  app.delete("/api/profile/collections/:id/recipes/:recipeId", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const collection = await storage.getCollection(userId, req.params.id);
      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }
      const removed = await storage.removeCollectionRecipe(collection.id, req.params.recipeId);
      if (!removed) {
        return res.status(404).json({ message: "Recipe not in collection" });
      }
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Favorites
  app.get("/api/favorites", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const rows = await storage.listFavorites(userId);
      res.json(rows.map((row) => ({ recipeId: row.recipeId, savedAt: row.createdAt })));
    } catch (error) {
      next(error);
    }
  });

  // Settings
  app.get("/api/settings", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const settings = await storage.getSettings(userId);
      if (!settings) {
        return res.json({
          notifications: {},
          privacy: {},
          cookingPreferences: {},
          accessibility: {},
          dataSync: {},
          updatedAt: null,
        });
      }
      res.json({
        notifications: settings.notifications ?? {},
        privacy: settings.privacy ?? {},
        cookingPreferences: settings.cookingPreferences ?? {},
        accessibility: settings.accessibility ?? {},
        dataSync: settings.dataSync ?? {},
        updatedAt: settings.updatedAt,
      });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/settings", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const input = settingsUpdateSchema.parse(req.body);
      const settings = await storage.upsertSettings(userId, input);
      res.json({
        notifications: settings.notifications ?? {},
        privacy: settings.privacy ?? {},
        cookingPreferences: settings.cookingPreferences ?? {},
        accessibility: settings.accessibility ?? {},
        dataSync: settings.dataSync ?? {},
        updatedAt: settings.updatedAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid settings data", errors: error.errors });
      }
      next(error);
    }
  });

  // Pantry
  app.get("/api/pantry", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const items = await storage.listPantryItems(userId);
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/pantry", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const input = pantryItemInputSchema.parse(req.body);
      const item = await storage.createPantryItem(userId, {
        name: input.name,
        quantity: input.quantity,
        unit: input.unit,
        category: input.category,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        thumbnail: input.thumbnail ?? null,
      });
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid pantry item", errors: error.errors });
      }
      next(error);
    }
  });

  app.patch("/api/pantry/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const input = pantryItemInputSchema.partial().parse(req.body);
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.quantity !== undefined) patch.quantity = input.quantity;
      if (input.unit !== undefined) patch.unit = input.unit;
      if (input.category !== undefined) patch.category = input.category;
      if (input.expiryDate !== undefined) patch.expiryDate = input.expiryDate ? new Date(input.expiryDate) : null;
      if (input.thumbnail !== undefined) patch.thumbnail = input.thumbnail ?? null;

      const item = await storage.updatePantryItem(userId, req.params.id, patch);
      if (!item) {
        return res.status(404).json({ message: "Pantry item not found" });
      }
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid pantry item", errors: error.errors });
      }
      next(error);
    }
  });

  app.delete("/api/pantry/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const removed = await storage.deletePantryItem(userId, req.params.id);
      if (!removed) {
        return res.status(404).json({ message: "Pantry item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Shopping Lists
  app.get("/api/shopping-lists", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const lists = await storage.listShoppingLists(userId);
      const withCounts = await Promise.all(
        lists.map(async (list) => {
          const items = await storage.listShoppingListItems(list.id);
          return {
            id: list.id,
            name: list.name,
            recipeCount: (list.recipeIds ?? []).length,
            itemCount: items.length,
            createdAt: list.createdAt,
          };
        }),
      );
      res.json(withCounts);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/shopping-lists", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const input = shoppingListInputSchema.parse(req.body);
      const list = await storage.createShoppingList(userId, input.name, input.recipeIds);
      res.status(201).json({ ...list, items: [] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid shopping list", errors: error.errors });
      }
      next(error);
    }
  });

  app.get("/api/shopping-lists/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const list = await storage.getShoppingList(userId, req.params.id);
      if (!list) {
        return res.status(404).json({ message: "Shopping list not found" });
      }
      const items = await storage.listShoppingListItems(list.id);
      const recipes = (list.recipeIds ?? [])
        .map((id) => {
          const summary = findRecipeSummary(id);
          if (summary) return { id: summary.id, title: summary.title };
          return { id, title: "Unknown Recipe" };
        });
      const formattedItems = items.map((item) => ({
        id: item.id,
        name: item.name,
        normalizedName: item.name.toLowerCase(),
        totalAmount: item.amount,
        unit: item.unit,
        category: item.category,
        isPurchased: item.isPurchased,
        recipes: [],
        conversions: [],
      }));
      res.json({
        id: list.id,
        name: list.name,
        recipes,
        items: formattedItems,
        createdAt: list.createdAt,
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/shopping-lists/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const input = shoppingListInputSchema.partial().parse(req.body);
      const list = await storage.updateShoppingList(userId, req.params.id, input);
      if (!list) {
        return res.status(404).json({ message: "Shopping list not found" });
      }
      res.json(list);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid shopping list", errors: error.errors });
      }
      next(error);
    }
  });

  app.delete("/api/shopping-lists/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const removed = await storage.deleteShoppingList(userId, req.params.id);
      if (!removed) {
        return res.status(404).json({ message: "Shopping list not found" });
      }
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/shopping-lists/:id/items", requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const list = await storage.getShoppingList(userId, req.params.id);
      if (!list) {
        return res.status(404).json({ message: "Shopping list not found" });
      }
      const input = shoppingListItemInputSchema.parse(req.body);
      const item = await storage.createShoppingListItem(list.id, {
        name: input.name,
        amount: input.amount ?? "",
        unit: input.unit,
        category: input.category,
        isPurchased: input.isPurchased,
      });
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid shopping list item", errors: error.errors });
      }
      next(error);
    }
  });

  // Accept both /api/shopping-lists/:id/items/:itemId and the legacy
  // singular /api/shopping-list/:id/items/:itemId (used by existing
  // shopping-list components / tests).
  const shoppingItemUpdate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthUserId(req);
      const list = await storage.getShoppingList(userId, req.params.id);
      if (!list) {
        return res.status(404).json({ message: "Shopping list not found" });
      }
      const input = shoppingListItemUpdateSchema.parse(req.body);
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.amount !== undefined) patch.amount = input.amount ?? "";
      if (input.unit !== undefined) patch.unit = input.unit;
      if (input.category !== undefined) patch.category = input.category;
      if (input.isPurchased !== undefined) patch.isPurchased = input.isPurchased;

      const item = await storage.updateShoppingListItem(list.id, req.params.itemId, patch);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid shopping list item", errors: error.errors });
      }
      next(error);
    }
  };
  app.patch("/api/shopping-lists/:id/items/:itemId", requireAuth, shoppingItemUpdate);
  app.patch("/api/shopping-list/:id/items/:itemId", requireAuth, shoppingItemUpdate);

  const shoppingItemDelete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthUserId(req);
      const list = await storage.getShoppingList(userId, req.params.id);
      if (!list) {
        return res.status(404).json({ message: "Shopping list not found" });
      }
      const removed = await storage.deleteShoppingListItem(list.id, req.params.itemId);
      if (!removed) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };
  app.delete("/api/shopping-lists/:id/items/:itemId", requireAuth, shoppingItemDelete);
  app.delete("/api/shopping-list/:id/items/:itemId", requireAuth, shoppingItemDelete);

  const shoppingListExport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthUserId(req);
      const list = await storage.getShoppingList(userId, req.params.id);
      if (!list) {
        return res.status(404).json({ message: "Shopping list not found" });
      }
      const format = z.object({ format: z.enum(["csv", "email"]).default("csv") }).parse(req.body).format;
      const items = await storage.listShoppingListItems(list.id);
      if (format === "csv") {
        const csv = ["name,amount,unit,category,purchased"]
          .concat(items.map((item) => [item.name, item.amount, item.unit, item.category, item.isPurchased].map(csvEscape).join(",")))
          .join("\n");
        res.json({ success: true, format: "csv", filename: `shopping-list-${list.id}.csv`, content: csv });
        return;
      }
      res.json({ success: true, format: "email", message: "Shopping list will be emailed to your account." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid export request", errors: error.errors });
      }
      next(error);
    }
  };
  app.post("/api/shopping-lists/:id/export", requireAuth, shoppingListExport);
  app.post("/api/shopping-list/:id/export", requireAuth, shoppingListExport);

  // Admin endpoints
  app.get("/api/admin/stats", adminRateLimit, requireAdmin, (req, res) => {
    const stats = {
      users: {
        total: 1247,
        active: 892,
        newThisMonth: 134
      },
      recipes: {
        total: 1856,
        published: 1823,
        pending: 33
      },
      system: {
        uptime: "99.8%",
        apiCalls: 25847,
        errors: 12
      }
    };
    
    res.json(stats);
  });

  app.get("/api/admin/users", adminRateLimit, requireAdmin, (req, res) => {
    const users = [
      {
        id: "user1",
        name: "Alex Johnson",
        email: "alex@example.com",
        role: "user" as const,
        status: "active" as const,
        joinDate: "2024-01-15",
        lastActive: "2024-01-20"
      },
      {
        id: "admin1",
        name: "Admin User",
        email: "admin@ingredo.com",
        role: "admin" as const,
        status: "active" as const,
        joinDate: "2023-12-01",
        lastActive: "2024-01-21"
      }
    ];
    
    res.json(users);
  });

  app.get("/api/admin/recipes", adminRateLimit, requireAdmin, (req, res) => {
    const adminRecipes = recipesDatabase.map(recipe => ({
      id: recipe.id,
      title: recipe.title,
      author: "Alex Johnson",
      status: "published" as const,
      createdAt: "2024-01-10",
      rating: recipe.rating,
      views: recipe.reviewCount * 20 + recipe.cookTime * 10
    }));
    
    res.json(adminRecipes);
  });

  // Upload endpoints
  app.post("/api/uploads/sign", uploadRateLimit, externalApiRateLimit, (req, res) => {
    try {
      const { filename, contentType, size } = uploadSignRequestSchema.parse(req.body);
      
      const imageId = `img_${randomBytes(8).toString("hex")}`;
      const mockUploadUrl = `https://mock-storage.example.com/upload/${imageId}`;
      
      res.json({
        image_id: imageId,
        uploadUrl: mockUploadUrl
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid upload request" });
    }
  });

  app.post("/api/uploads/complete", uploadRateLimit, externalApiRateLimit, (req, res) => {
    try {
      const { image_id, url } = uploadCompleteSchema.parse(req.body);
      
      // In a real app, you'd store this in a database
      console.log(`Upload completed for ${image_id}: ${url}`);
      
      res.json({ 
        success: true,
        image_id,
        thumbnailUrl: `https://mock-storage.example.com/thumbnails/${image_id}.jpg`
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid completion request" });
    }
  });

  app.post("/api/ingredients/extract", uploadRateLimit, externalApiRateLimit, imageExtractionJsonParser, async (req, res, next) => {
    try {
      const { image } = extractIngredientsSchema.parse(req.body);
      const extraction = await extractIngredientsFromImage(image);
      res.json(extraction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid image extraction request", errors: error.errors });
      }
      next(error);
    }
  });

  app.post("/api/recognize-image", externalApiRateLimit, (req, res) => {
    try {
      const { image_id, max_suggestions } = recognizeImageSchema.parse(req.body);

      // Mock ingredient recognition results
      const mockRecognitions = [
        { name: "Tomato", normalized: "tomato", confidence: 0.95 },
        { name: "Onion", normalized: "onion", confidence: 0.88 },
        { name: "Bell Pepper", normalized: "bell pepper", confidence: 0.82 },
        { name: "Garlic", normalized: "garlic", confidence: 0.76 },
        { name: "Basil", normalized: "basil", confidence: 0.71 }
      ];

      // Return up to max_suggestions items
      const suggestions = mockRecognitions.slice(0, max_suggestions);

      res.json({
        image_id,
        recognized: suggestions
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid recognition request" });
    }
  });

  // Rate limiters for auth endpoints
  const loginRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,              // 5 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 429,
      message: "Too many login attempts. Please try again later."
    }
  });

  const registerRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 3,              // 3 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 429,
      message: "Too many registration attempts. Please try again later."
    }
  });

  // Authentication endpoints
  app.post('/api/auth/register', registerRateLimiter, async (req, res) => {
    try {
      const { name, username, password } = authRegisterSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        name,
      });

      // Automatically log in the user after registration
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: 'Login failed after registration' });
        }
        return res.status(201).json(toClientUser(user));
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/login', loginRateLimiter, (req, res, next) => {
    passport.authenticate('local', (err: unknown, user: User | false) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        return res.json(toClientUser(user));
      });
    })(req, res, next);
  });

  app.post('/api/auth/logout', (req, res, next) => {
    req.logout((err) => {
      if (err) {
        return next(err);
      }
      res.json({ message: 'Logged out successfully' });
    });
  });

  app.get('/api/auth/me', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const user = req.user as User;
      const profile = await storage.getProfile(user.id);
      res.json(toClientUser(user, profile));
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/auth/account', requireAuth, async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      await storage.deleteUser(userId);
      req.logout((err) => {
        if (err) {
          return next(err);
        }
        req.session.destroy((destroyErr) => {
          if (destroyErr) {
            return next(destroyErr);
          }
          res.json({ success: true });
        });
      });
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
