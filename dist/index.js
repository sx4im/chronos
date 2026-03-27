// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";
import { randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";
var ingredientsDatabase = [
  { name: "Tomato", score: 0.95 },
  { name: "Basil", score: 0.92 },
  { name: "Mozzarella", score: 0.9 },
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
  { name: "Bell Pepper", score: 0.8 },
  { name: "Carrot", score: 0.83 },
  { name: "Potato", score: 0.87 },
  { name: "Egg", score: 0.91 }
];
var recipesDatabase = [
  {
    id: "caprese-salad",
    slug: "caprese-salad",
    title: "Fresh Caprese Salad",
    description: "A classic Italian salad with fresh tomatoes, mozzarella, and basil.",
    image: "https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?ixlib=rb-4.0.3&w=600&h=400&fit=crop",
    cookTime: 15,
    prepTime: 10,
    servings: 4,
    difficulty: "Easy",
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
    difficulty: "Medium",
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
    difficulty: "Easy",
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
      { step: 2, description: "Heat olive oil in a large saucepan and saut\xE9 onion until soft.", time_min: 5 },
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
var userProfiles = [
  {
    id: "user1",
    name: "Alex Johnson",
    email: "alex@example.com",
    joinDate: "2024-01-15",
    stats: {
      savedRecipes: 24,
      cookedRecipes: 18,
      collections: 3,
      followers: 45
    }
  }
];
var ingredientsQuerySchema = z.object({
  q: z.string().min(1).optional()
});
var recipeParamsSchema = z.object({
  slug: z.string().min(1)
});
var uploadSignRequestSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  size: z.number()
});
var uploadCompleteSchema = z.object({
  image_id: z.string(),
  url: z.string(),
  metadata: z.object({}).optional()
});
var recognizeImageSchema = z.object({
  image_id: z.string(),
  mode: z.literal("vision"),
  max_suggestions: z.number().default(5)
});
var MAX_QUERY_ITEMS = 50;
var MAX_QUERY_VALUE_LENGTH = 100;
function parseDelimitedQueryList(value) {
  if (typeof value !== "string") return [];
  return value.slice(0, MAX_QUERY_ITEMS * MAX_QUERY_VALUE_LENGTH).split(",").map((item) => item.trim().toLowerCase().slice(0, MAX_QUERY_VALUE_LENGTH)).filter(Boolean).slice(0, MAX_QUERY_ITEMS);
}
function safeCompare(secret, provided) {
  const secretBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(provided);
  if (secretBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(secretBuffer, providedBuffer);
}
function requireAdmin(req, res, next) {
  const adminApiKey = process.env.ADMIN_API_KEY;
  const providedKey = req.header("x-admin-key");
  if (adminApiKey) {
    if (!providedKey || !safeCompare(adminApiKey, providedKey)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  }
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ message: "Forbidden" });
  }
  return next();
}
async function registerRoutes(app2) {
  app2.get("/api/health", (req, res) => {
    res.json({ ok: true, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app2.get("/api/ingredients", (req, res) => {
    try {
      const { q } = ingredientsQuerySchema.parse(req.query);
      if (!q) {
        return res.json({
          suggestions: [],
          popular: ingredientsDatabase.slice(0, 8)
        });
      }
      const query = q.toLowerCase();
      const suggestions = ingredientsDatabase.filter(
        (ingredient) => ingredient.name.toLowerCase().includes(query)
      ).sort((a, b) => b.score - a.score).slice(0, 10);
      res.json({
        suggestions,
        popular: ingredientsDatabase.slice(0, 8)
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid query parameters" });
    }
  });
  app2.get("/api/recipes", (req, res) => {
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
      if (!ingredients) {
        return res.json({ recipes: recipesDatabase, total: recipesDatabase.length });
      }
      const ingredientList = parseDelimitedQueryList(ingredients);
      let matchingRecipes = recipesDatabase.filter(
        (recipe) => recipe.ingredients.some(
          (ingredient) => ingredientList.some(
            (reqIngredient) => ingredient.name.toLowerCase().includes(reqIngredient)
          )
        )
      );
      if (diet && diet !== "any") {
        matchingRecipes = matchingRecipes.filter(
          (recipe) => recipe.tags.some((tag) => tag.toLowerCase().includes(diet))
        );
      }
      if (allergies) {
        const allergyList = parseDelimitedQueryList(allergies);
        matchingRecipes = matchingRecipes.filter(
          (recipe) => !allergyList.some(
            (allergy) => recipe.ingredients.some(
              (ingredient) => ingredient.name.toLowerCase().includes(allergy) || recipe.tags.some((tag) => tag.toLowerCase().includes(allergy))
            )
          )
        );
      }
      if (maxCookTime) {
        const maxTime = parseInt(maxCookTime, 10);
        if (!isNaN(maxTime) && maxTime > 0) {
          matchingRecipes = matchingRecipes.filter((recipe) => recipe.cookTime <= maxTime);
        }
      }
      if (cuisine) {
        matchingRecipes = matchingRecipes.filter(
          (recipe) => recipe.tags.some((tag) => tag.toLowerCase().includes(cuisine.toLowerCase()))
        );
      }
      if (difficulty && difficulty !== "any") {
        matchingRecipes = matchingRecipes.filter(
          (recipe) => recipe.difficulty.toLowerCase() === difficulty.toLowerCase()
        );
      }
      res.json({
        recipes: matchingRecipes,
        total: matchingRecipes.length
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid query parameters" });
    }
  });
  app2.get("/api/recipe/:slug", (req, res) => {
    try {
      const { slug } = recipeParamsSchema.parse(req.params);
      const recipe = recipesDatabase.find((r) => r.slug === slug || r.id === slug);
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      res.status(400).json({ message: "Invalid recipe ID" });
    }
  });
  app2.get("/api/recipe/:id/similar", (req, res) => {
    try {
      const { id } = req.params;
      const recipe = recipesDatabase.find((r) => r.id === id);
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      const similar = recipesDatabase.filter((r) => r.id !== id).filter(
        (r) => r.difficulty === recipe.difficulty || r.tags.some((tag) => recipe.tags.includes(tag))
      ).slice(0, 3).map((r) => ({
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
  app2.post("/api/recipe/:id/save", (req, res) => {
    try {
      const { id } = req.params;
      const recipe = recipesDatabase.find((r) => r.id === id);
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      res.json({ message: "Recipe saved successfully", recipeId: id });
    } catch (error) {
      res.status(400).json({ message: "Invalid recipe ID" });
    }
  });
  app2.post("/api/recipe/:id/progress", (req, res) => {
    try {
      const { id } = req.params;
      const { type, itemId } = req.body;
      const recipe = recipesDatabase.find((r) => r.id === id);
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
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
  app2.get("/api/profile", (req, res) => {
    const profile = userProfiles[0];
    res.json(profile);
  });
  app2.get("/api/profile/saved-recipes", (req, res) => {
    const savedRecipes = recipesDatabase.slice(0, 2).map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      image: recipe.image,
      cookTime: recipe.cookTime,
      rating: recipe.rating,
      reviewCount: recipe.reviewCount,
      tags: recipe.tags
    }));
    res.json(savedRecipes);
  });
  app2.get("/api/profile/recent-recipes", (req, res) => {
    const recentRecipes = recipesDatabase.slice(0, 3).map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      image: recipe.image,
      cookTime: recipe.cookTime,
      rating: recipe.rating,
      reviewCount: recipe.reviewCount,
      tags: recipe.tags,
      lastCooked: "2 days ago"
    }));
    res.json(recentRecipes);
  });
  app2.get("/api/profile/collections", (req, res) => {
    const collections = [
      {
        id: "quick-meals",
        name: "Quick Weeknight Meals",
        description: "Fast and easy recipes for busy weeknights",
        recipeCount: 12,
        isPublic: true
      },
      {
        id: "healthy-options",
        name: "Healthy Options",
        description: "Nutritious recipes for a balanced diet",
        recipeCount: 8,
        isPublic: false
      }
    ];
    res.json(collections);
  });
  app2.get("/api/admin/stats", requireAdmin, (req, res) => {
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
  app2.get("/api/admin/users", requireAdmin, (req, res) => {
    const users = [
      {
        id: "user1",
        name: "Alex Johnson",
        email: "alex@example.com",
        role: "user",
        status: "active",
        joinDate: "2024-01-15",
        lastActive: "2024-01-20"
      },
      {
        id: "admin1",
        name: "Admin User",
        email: "admin@ingredo.com",
        role: "admin",
        status: "active",
        joinDate: "2023-12-01",
        lastActive: "2024-01-21"
      }
    ];
    res.json(users);
  });
  app2.get("/api/admin/recipes", requireAdmin, (req, res) => {
    const adminRecipes = recipesDatabase.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      author: "Alex Johnson",
      status: "published",
      createdAt: "2024-01-10",
      rating: recipe.rating,
      views: recipe.reviewCount * 20 + recipe.cookTime * 10
    }));
    res.json(adminRecipes);
  });
  app2.post("/api/uploads/sign", (req, res) => {
    try {
      const { filename, contentType, size } = uploadSignRequestSchema.parse(req.body);
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(contentType)) {
        return res.status(400).json({ message: "Invalid file type. Only JPEG, PNG, and WebP are allowed." });
      }
      if (size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "File too large. Maximum size is 5MB." });
      }
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
  app2.post("/api/uploads/complete", (req, res) => {
    try {
      const { image_id, url } = uploadCompleteSchema.parse(req.body);
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
  app2.post("/api/recognize-image", (req, res) => {
    try {
      const { image_id, max_suggestions } = recognizeImageSchema.parse(req.body);
      const mockRecognitions = [
        { name: "Tomato", normalized: "tomato", confidence: 0.95 },
        { name: "Onion", normalized: "onion", confidence: 0.88 },
        { name: "Bell Pepper", normalized: "bell pepper", confidence: 0.82 },
        { name: "Garlic", normalized: "garlic", confidence: 0.76 },
        { name: "Basil", normalized: "basil", confidence: 0.71 }
      ];
      const suggestions = mockRecognitions.slice(0, max_suggestions);
      res.json({
        image_id,
        recognized: suggestions
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid recognition request" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
    minify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "wouter"],
          ui: ["lucide-react", "framer-motion", "clsx", "tailwind-merge"],
          query: ["@tanstack/react-query"]
        }
      }
    }
  },
  optimizeDeps: {
    include: ["react", "react-dom", "wouter", "lucide-react", "framer-motion", "zustand"]
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "..", "dist", "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const isSensitivePath = path3.startsWith("/api/admin/") || path3.startsWith("/api/profile") || path3.startsWith("/api/uploads/");
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && !isSensitivePath) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = status >= 500 && process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message || "Internal Server Error";
    res.status(status).json({ message });
    if (process.env.NODE_ENV !== "production") {
      console.error("Error:", err);
    } else {
      console.error("Error:", { status, message: err?.message || "Internal Server Error" });
    }
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
