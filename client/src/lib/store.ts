import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '@/lib/ids';

// User types
export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  avatar?: string;
  joinDate: string;
  role?: 'user' | 'admin';
}

// Recipe types
interface Recipe {
  id: string;
  title: string;
  description: string;
  image?: string;
  cookTime: number;
  prepTime: number;
  servings: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  rating: number;
  reviewCount: number;
  tags: string[];
  ingredients: Array<{
    id: string;
    name: string;
    amount: number;
    unit: string;
  }>;
  instructions: Array<{
    step: number;
    description: string;
    time_min?: number;
  }>;
}

// Pantry types
interface PantryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expiryDate: string;
  category: string;
  thumbnail?: string;
  daysLeft?: number;
}

// Shopping list types
interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  isPurchased: boolean;
  addedDate: string;
}


// Store interface
interface AppStore {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;


  // Favorites state
  favoriteRecipes: string[];
  addToFavorites: (recipeId: string) => void;
  removeFromFavorites: (recipeId: string) => void;
  isFavorite: (recipeId: string) => boolean;

  // Pantry state
  pantryItems: PantryItem[];
  addPantryItem: (item: Omit<PantryItem, 'id' | 'addedDate'>) => void;
  updatePantryItem: (id: string, updates: Partial<PantryItem>) => void;
  removePantryItem: (id: string) => void;
  getExpiringItems: () => PantryItem[];

  // Shopping list state
  shoppingList: ShoppingListItem[];
  addToShoppingList: (item: Omit<ShoppingListItem, 'id' | 'addedDate'>) => void;
  updateShoppingListItem: (id: string, updates: Partial<ShoppingListItem>) => void;
  removeFromShoppingList: (id: string) => void;
  togglePurchased: (id: string) => void;
  clearPurchased: () => void;


  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Search state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchFilters: {
    diet: string;
    allergies: string[];
    maxCookTime: number;
    cuisine?: string;
    difficulty: string;
    allowSubstitutions: boolean;
    servings: number;
  };
  setSearchFilters: (filters: Partial<AppStore['searchFilters']>) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // User state
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false }),


      // Favorites state
      favoriteRecipes: [],
      addToFavorites: (recipeId) =>
        set((state) => ({
          favoriteRecipes: [...state.favoriteRecipes, recipeId],
        })),
      removeFromFavorites: (recipeId) =>
        set((state) => ({
          favoriteRecipes: state.favoriteRecipes.filter((id) => id !== recipeId),
        })),
      isFavorite: (recipeId) => get().favoriteRecipes.includes(recipeId),

      // Pantry state
      pantryItems: [],
      addPantryItem: (item) =>
        set((state) => ({
          pantryItems: [
            ...state.pantryItems,
            {
              ...item,
              id: generateId(),
              addedDate: new Date().toISOString(),
            },
          ],
        })),
      updatePantryItem: (id, updates) =>
        set((state) => ({
          pantryItems: state.pantryItems.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        })),
      removePantryItem: (id) =>
        set((state) => ({
          pantryItems: state.pantryItems.filter((item) => item.id !== id),
        })),
      getExpiringItems: () => {
        const now = new Date();
        const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        
        return get().pantryItems.filter((item) => {
          const expiryDate = new Date(item.expiryDate);
          return expiryDate <= threeDaysFromNow && expiryDate >= now;
        });
      },

      // Shopping list state
      shoppingList: [],
      addToShoppingList: (item) =>
        set((state) => ({
          shoppingList: [
            ...state.shoppingList,
            {
              ...item,
              id: generateId(),
              addedDate: new Date().toISOString(),
            },
          ],
        })),
      updateShoppingListItem: (id, updates) =>
        set((state) => ({
          shoppingList: state.shoppingList.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        })),
      removeFromShoppingList: (id) =>
        set((state) => ({
          shoppingList: state.shoppingList.filter((item) => item.id !== id),
        })),
      togglePurchased: (id) =>
        set((state) => ({
          shoppingList: state.shoppingList.map((item) =>
            item.id === id ? { ...item, isPurchased: !item.isPurchased } : item
          ),
        })),
      clearPurchased: () =>
        set((state) => ({
          shoppingList: state.shoppingList.filter((item) => !item.isPurchased),
        })),


      // UI state
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      // Search state
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      searchFilters: {
        diet: 'any',
        allergies: [],
        maxCookTime: 60,
        cuisine: undefined,
        difficulty: 'any',
        allowSubstitutions: true,
        servings: 4,
      },
      setSearchFilters: (filters) =>
        set((state) => ({
          searchFilters: { ...state.searchFilters, ...filters },
        })),
    }),
    {
      name: 'ingredo-store',
      partialize: (state) => ({
        favoriteRecipes: state.favoriteRecipes,
        pantryItems: state.pantryItems,
        shoppingList: state.shoppingList,
        searchFilters: state.searchFilters,
      }),
    }
  )
);

// Selectors for better performance
export const useUser = () => useAppStore((state) => state.user);
export const useIsAuthenticated = () => useAppStore((state) => state.isAuthenticated);
export const useFavorites = () => useAppStore((state) => state.favoriteRecipes);
export const usePantry = () => useAppStore((state) => state.pantryItems);
export const useShoppingList = () => useAppStore((state) => state.shoppingList);
export const useSidebar = () => useAppStore((state) => state.sidebarOpen);
