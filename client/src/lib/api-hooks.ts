import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

export interface PantryItem {
  id: string;
  userId: string;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  expiryDate: string | null;
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PantryItemInput {
  name: string;
  quantity: string | number;
  unit: string;
  category: string;
  expiryDate?: string | null;
  thumbnail?: string | null;
}

export interface ShoppingListSummary {
  id: string;
  name: string;
  recipeCount: number;
  itemCount: number;
  createdAt: string;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  amount: string;
  unit: string;
  category: string;
  isPurchased: boolean;
  createdAt: string;
}

export interface ShoppingListItemInput {
  name: string;
  amount?: string | number;
  unit?: string;
  category?: string;
  isPurchased?: boolean;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  coverImage: string | null;
  recipeCount: number;
  createdAt: string;
}

export interface CollectionInput {
  name: string;
  description?: string;
  isPublic?: boolean;
  coverImage?: string | null;
}

export interface FavoriteEntry {
  recipeId: string;
  savedAt: string;
}

export interface SavedRecipeSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: string;
  cookTime: number;
  prepTime: number;
  servings: number;
  difficulty: string;
  rating: number;
  reviewCount: number;
  tags: string[];
  savedAt?: string;
}

// Favorites

export function useFavorites() {
  return useQuery<FavoriteEntry[]>({
    queryKey: ["/api/favorites"],
    queryFn: () => apiClient.get<FavoriteEntry[]>("/api/favorites"),
  });
}

export function useSavedRecipes() {
  return useQuery<SavedRecipeSummary[]>({
    queryKey: ["/api/profile/saved-recipes"],
    queryFn: () => apiClient.get<SavedRecipeSummary[]>("/api/profile/saved-recipes"),
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recipeId, save }: { recipeId: string; save: boolean }) =>
      apiClient.post(save ? `/api/recipe/${recipeId}/save` : `/api/recipe/${recipeId}/unsave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/saved-recipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
  });
}

// Pantry

export function usePantryItems(enabled = true) {
  return useQuery<PantryItem[]>({
    queryKey: ["/api/pantry"],
    queryFn: () => apiClient.get<PantryItem[]>("/api/pantry"),
    enabled,
  });
}

export function useCreatePantryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PantryItemInput) =>
      apiClient.post<PantryItem>("/api/pantry", { ...input, quantity: String(input.quantity) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/pantry"] }),
  });
}

export function useUpdatePantryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<PantryItemInput> }) =>
      apiClient.patch<PantryItem>(`/api/pantry/${id}`, {
        ...updates,
        quantity: updates.quantity !== undefined ? String(updates.quantity) : undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/pantry"] }),
  });
}

export function useDeletePantryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/pantry/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/pantry"] }),
  });
}

// Shopping lists

export function useShoppingLists() {
  return useQuery<ShoppingListSummary[]>({
    queryKey: ["/api/shopping-lists"],
    queryFn: () => apiClient.get<ShoppingListSummary[]>("/api/shopping-lists"),
  });
}

export function useCreateShoppingList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; recipeIds?: string[] }) =>
      apiClient.post("/api/shopping-lists", { recipeIds: [], ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists"] }),
  });
}

export function useDeleteShoppingList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/shopping-lists/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists"] }),
  });
}

export function useShoppingListItems(listId: string | null) {
  return useQuery({
    queryKey: ["/api/shopping-lists", listId, "items"],
    queryFn: () => apiClient.get<{ items: ShoppingListItem[] }>(`/api/shopping-lists/${listId}`),
    enabled: !!listId,
  });
}

export function useAddShoppingListItem(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ShoppingListItemInput) =>
      apiClient.post(`/api/shopping-lists/${listId}/items`, {
        ...input,
        amount: input.amount !== undefined ? String(input.amount) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists", listId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists"] });
    },
  });
}

export function useUpdateShoppingListItem(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, updates }: { itemId: string; updates: Partial<ShoppingListItemInput> }) =>
      apiClient.patch(`/api/shopping-lists/${listId}/items/${itemId}`, {
        ...updates,
        amount: updates.amount !== undefined ? String(updates.amount) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists", listId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists"] });
    },
  });
}

export function useDeleteShoppingListItem(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => apiClient.delete(`/api/shopping-lists/${listId}/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists", listId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists"] });
    },
  });
}

// Collections

export function useCollections() {
  return useQuery<CollectionSummary[]>({
    queryKey: ["/api/profile/collections"],
    queryFn: () => apiClient.get<CollectionSummary[]>("/api/profile/collections"),
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CollectionInput) => apiClient.post<CollectionSummary>("/api/profile/collections", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/profile/collections"] }),
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/profile/collections/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/profile/collections"] }),
  });
}

export function useAddRecipeToCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, recipeId }: { collectionId: string; recipeId: string }) =>
      apiClient.post(`/api/profile/collections/${collectionId}/recipes`, { recipeId }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/collections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile/collections", variables.collectionId, "recipes"] });
    },
  });
}

// Profile / settings

export interface SettingsPayload {
  notifications: Record<string, unknown>;
  privacy: Record<string, unknown>;
  cookingPreferences: Record<string, unknown>;
  accessibility: Record<string, unknown>;
  dataSync: Record<string, unknown>;
  updatedAt: string | null;
}

export function useSettings() {
  return useQuery<SettingsPayload>({
    queryKey: ["/api/settings"],
    queryFn: () => apiClient.get<SettingsPayload>("/api/settings"),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<Omit<SettingsPayload, "updatedAt">>) =>
      apiClient.put<SettingsPayload>("/api/settings", updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/settings"] }),
  });
}

export interface ProfileUpdateInput {
  name?: string;
  email?: string;
  bio?: string;
  location?: string;
  website?: string;
  avatarUrl?: string;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: ProfileUpdateInput) => apiClient.put("/api/profile", updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => apiClient.delete("/api/auth/account"),
  });
}
