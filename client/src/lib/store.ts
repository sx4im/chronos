import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// User types
export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  avatar?: string;
  joinDate: string;
  role?: 'user' | 'admin';
  bio?: string;
  location?: string;
  website?: string;
}

// Store interface
interface AppStore {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;

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
    (set) => ({
      // User state
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false }),

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
        searchFilters: state.searchFilters,
      }),
    }
  )
);

// Selectors for better performance
export const useUser = () => useAppStore((state) => state.user);
export const useIsAuthenticated = () => useAppStore((state) => state.isAuthenticated);
export const useSidebar = () => useAppStore((state) => state.sidebarOpen);
