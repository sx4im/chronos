import {
  users,
  userProfiles,
  userSettings,
  favorites,
  pantryItems,
  shoppingLists,
  shoppingListItems,
  collections,
  collectionRecipes,
  generatedRecipes,
  type User,
  type InsertUser,
  type UserProfile,
  type UserSettings,
  type Favorite,
  type PantryItem,
  type ShoppingList,
  type ShoppingListItemRow,
  type Collection,
} from "../shared/schema";
import { db } from "./db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

export interface PantryItemInputData {
  name: string;
  quantity: string;
  unit: string;
  category: string;
  expiryDate: Date | null;
  thumbnail: string | null;
}

export interface ShoppingListItemInputData {
  name: string;
  amount: string;
  unit: string;
  category: string;
  isPurchased: boolean;
}

export interface CollectionInputData {
  name: string;
  description: string;
  isPublic: boolean;
  coverImage: string | null;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<Pick<User, "name" | "email">>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;

  getProfile(userId: string): Promise<UserProfile | undefined>;
  upsertProfile(userId: string, updates: Partial<Omit<UserProfile, "userId" | "updatedAt">>): Promise<UserProfile>;

  getSettings(userId: string): Promise<UserSettings | undefined>;
  upsertSettings(userId: string, updates: Partial<Omit<UserSettings, "userId" | "updatedAt">>): Promise<UserSettings>;

  listFavorites(userId: string): Promise<Favorite[]>;
  addFavorite(userId: string, recipeId: string): Promise<Favorite>;
  removeFavorite(userId: string, recipeId: string): Promise<void>;
  isFavorite(userId: string, recipeId: string): Promise<boolean>;

  listPantryItems(userId: string): Promise<PantryItem[]>;
  createPantryItem(userId: string, input: PantryItemInputData): Promise<PantryItem>;
  updatePantryItem(userId: string, id: string, updates: Partial<PantryItemInputData>): Promise<PantryItem | undefined>;
  deletePantryItem(userId: string, id: string): Promise<boolean>;

  listShoppingLists(userId: string): Promise<ShoppingList[]>;
  getShoppingList(userId: string, id: string): Promise<ShoppingList | undefined>;
  createShoppingList(userId: string, name: string, recipeIds: string[]): Promise<ShoppingList>;
  updateShoppingList(userId: string, id: string, updates: { name?: string; recipeIds?: string[] }): Promise<ShoppingList | undefined>;
  deleteShoppingList(userId: string, id: string): Promise<boolean>;

  listShoppingListItems(listId: string): Promise<ShoppingListItemRow[]>;
  createShoppingListItem(listId: string, input: ShoppingListItemInputData): Promise<ShoppingListItemRow>;
  updateShoppingListItem(listId: string, itemId: string, updates: Partial<ShoppingListItemInputData>): Promise<ShoppingListItemRow | undefined>;
  deleteShoppingListItem(listId: string, itemId: string): Promise<boolean>;

  listCollections(userId: string): Promise<Collection[]>;
  getCollection(userId: string, id: string): Promise<Collection | undefined>;
  createCollection(userId: string, input: CollectionInputData): Promise<Collection>;
  updateCollection(userId: string, id: string, updates: Partial<CollectionInputData>): Promise<Collection | undefined>;
  deleteCollection(userId: string, id: string): Promise<boolean>;
  listCollectionRecipes(collectionId: string): Promise<string[]>;
  addCollectionRecipe(collectionId: string, recipeId: string): Promise<void>;
  removeCollectionRecipe(collectionId: string, recipeId: string): Promise<boolean>;

  saveGeneratedRecipe(id: string, data: unknown): Promise<void>;
  getGeneratedRecipe(id: string): Promise<unknown | undefined>;
  getGeneratedRecipesByIds(ids: string[]): Promise<Array<{ id: string; data: unknown }>>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<Pick<User, "name" | "email">>): Promise<User | undefined> {
    if (Object.keys(updates).length === 0) {
      return this.getUser(id);
    }
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile;
  }

  async upsertProfile(userId: string, updates: Partial<Omit<UserProfile, "userId" | "updatedAt">>): Promise<UserProfile> {
    const [profile] = await db
      .insert(userProfiles)
      .values({ userId, ...updates, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { ...updates, updatedAt: new Date() },
      })
      .returning();
    return profile;
  }

  async getSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings;
  }

  async upsertSettings(userId: string, updates: Partial<Omit<UserSettings, "userId" | "updatedAt">>): Promise<UserSettings> {
    const [settings] = await db
      .insert(userSettings)
      .values({ userId, ...updates, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { ...updates, updatedAt: new Date() },
      })
      .returning();
    return settings;
  }

  async listFavorites(userId: string): Promise<Favorite[]> {
    return db.select().from(favorites).where(eq(favorites.userId, userId)).orderBy(desc(favorites.createdAt));
  }

  async addFavorite(userId: string, recipeId: string): Promise<Favorite> {
    const [favorite] = await db
      .insert(favorites)
      .values({ userId, recipeId })
      .onConflictDoNothing()
      .returning();
    if (favorite) return favorite;
    const [existing] = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.recipeId, recipeId)));
    return existing;
  }

  async removeFavorite(userId: string, recipeId: string): Promise<void> {
    await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.recipeId, recipeId)));
  }

  async isFavorite(userId: string, recipeId: string): Promise<boolean> {
    const [row] = await db
      .select({ recipeId: favorites.recipeId })
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.recipeId, recipeId)));
    return !!row;
  }

  async listPantryItems(userId: string): Promise<PantryItem[]> {
    return db
      .select()
      .from(pantryItems)
      .where(eq(pantryItems.userId, userId))
      .orderBy(asc(pantryItems.expiryDate));
  }

  async createPantryItem(userId: string, input: PantryItemInputData): Promise<PantryItem> {
    const [item] = await db
      .insert(pantryItems)
      .values({
        userId,
        name: input.name,
        quantity: input.quantity,
        unit: input.unit,
        category: input.category,
        expiryDate: input.expiryDate,
        thumbnail: input.thumbnail,
      })
      .returning();
    return item;
  }

  async updatePantryItem(userId: string, id: string, updates: Partial<PantryItemInputData>): Promise<PantryItem | undefined> {
    const [item] = await db
      .update(pantryItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(pantryItems.userId, userId), eq(pantryItems.id, id)))
      .returning();
    return item;
  }

  async deletePantryItem(userId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(pantryItems)
      .where(and(eq(pantryItems.userId, userId), eq(pantryItems.id, id)))
      .returning({ id: pantryItems.id });
    return result.length > 0;
  }

  async listShoppingLists(userId: string): Promise<ShoppingList[]> {
    return db
      .select()
      .from(shoppingLists)
      .where(eq(shoppingLists.userId, userId))
      .orderBy(desc(shoppingLists.createdAt));
  }

  async getShoppingList(userId: string, id: string): Promise<ShoppingList | undefined> {
    const [list] = await db
      .select()
      .from(shoppingLists)
      .where(and(eq(shoppingLists.userId, userId), eq(shoppingLists.id, id)));
    return list;
  }

  async createShoppingList(userId: string, name: string, recipeIds: string[]): Promise<ShoppingList> {
    const [list] = await db
      .insert(shoppingLists)
      .values({ userId, name, recipeIds })
      .returning();
    return list;
  }

  async updateShoppingList(userId: string, id: string, updates: { name?: string; recipeIds?: string[] }): Promise<ShoppingList | undefined> {
    if (Object.keys(updates).length === 0) {
      return this.getShoppingList(userId, id);
    }
    const [list] = await db
      .update(shoppingLists)
      .set(updates)
      .where(and(eq(shoppingLists.userId, userId), eq(shoppingLists.id, id)))
      .returning();
    return list;
  }

  async deleteShoppingList(userId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(shoppingLists)
      .where(and(eq(shoppingLists.userId, userId), eq(shoppingLists.id, id)))
      .returning({ id: shoppingLists.id });
    return result.length > 0;
  }

  async listShoppingListItems(listId: string): Promise<ShoppingListItemRow[]> {
    return db
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.listId, listId))
      .orderBy(asc(shoppingListItems.createdAt));
  }

  async createShoppingListItem(listId: string, input: ShoppingListItemInputData): Promise<ShoppingListItemRow> {
    const [item] = await db.insert(shoppingListItems).values({ listId, ...input }).returning();
    return item;
  }

  async updateShoppingListItem(listId: string, itemId: string, updates: Partial<ShoppingListItemInputData>): Promise<ShoppingListItemRow | undefined> {
    if (Object.keys(updates).length === 0) {
      const [item] = await db
        .select()
        .from(shoppingListItems)
        .where(and(eq(shoppingListItems.listId, listId), eq(shoppingListItems.id, itemId)));
      return item;
    }
    const [item] = await db
      .update(shoppingListItems)
      .set(updates)
      .where(and(eq(shoppingListItems.listId, listId), eq(shoppingListItems.id, itemId)))
      .returning();
    return item;
  }

  async deleteShoppingListItem(listId: string, itemId: string): Promise<boolean> {
    const result = await db
      .delete(shoppingListItems)
      .where(and(eq(shoppingListItems.listId, listId), eq(shoppingListItems.id, itemId)))
      .returning({ id: shoppingListItems.id });
    return result.length > 0;
  }

  async listCollections(userId: string): Promise<Collection[]> {
    return db
      .select()
      .from(collections)
      .where(eq(collections.userId, userId))
      .orderBy(desc(collections.createdAt));
  }

  async getCollection(userId: string, id: string): Promise<Collection | undefined> {
    const [collection] = await db
      .select()
      .from(collections)
      .where(and(eq(collections.userId, userId), eq(collections.id, id)));
    return collection;
  }

  async createCollection(userId: string, input: CollectionInputData): Promise<Collection> {
    const [collection] = await db.insert(collections).values({ userId, ...input }).returning();
    return collection;
  }

  async updateCollection(userId: string, id: string, updates: Partial<CollectionInputData>): Promise<Collection | undefined> {
    if (Object.keys(updates).length === 0) {
      return this.getCollection(userId, id);
    }
    const [collection] = await db
      .update(collections)
      .set(updates)
      .where(and(eq(collections.userId, userId), eq(collections.id, id)))
      .returning();
    return collection;
  }

  async deleteCollection(userId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(collections)
      .where(and(eq(collections.userId, userId), eq(collections.id, id)))
      .returning({ id: collections.id });
    return result.length > 0;
  }

  async listCollectionRecipes(collectionId: string): Promise<string[]> {
    const rows = await db
      .select({ recipeId: collectionRecipes.recipeId })
      .from(collectionRecipes)
      .where(eq(collectionRecipes.collectionId, collectionId))
      .orderBy(desc(collectionRecipes.addedAt));
    return rows.map((row) => row.recipeId);
  }

  async addCollectionRecipe(collectionId: string, recipeId: string): Promise<void> {
    await db.insert(collectionRecipes).values({ collectionId, recipeId }).onConflictDoNothing();
  }

  async removeCollectionRecipe(collectionId: string, recipeId: string): Promise<boolean> {
    const result = await db
      .delete(collectionRecipes)
      .where(and(eq(collectionRecipes.collectionId, collectionId), eq(collectionRecipes.recipeId, recipeId)))
      .returning({ recipeId: collectionRecipes.recipeId });
    return result.length > 0;
  }

  async saveGeneratedRecipe(id: string, data: unknown): Promise<void> {
    await db
      .insert(generatedRecipes)
      .values({ id, data })
      .onConflictDoUpdate({ target: generatedRecipes.id, set: { data } });
  }

  async getGeneratedRecipe(id: string): Promise<unknown | undefined> {
    const [row] = await db.select().from(generatedRecipes).where(eq(generatedRecipes.id, id));
    return row?.data;
  }

  async getGeneratedRecipesByIds(ids: string[]): Promise<Array<{ id: string; data: unknown }>> {
    if (ids.length === 0) return [];
    const rows = await db
      .select()
      .from(generatedRecipes)
      .where(inArray(generatedRecipes.id, ids));
    return rows.map((row) => ({ id: row.id, data: row.data }));
  }
}

export const storage = new DatabaseStorage();
