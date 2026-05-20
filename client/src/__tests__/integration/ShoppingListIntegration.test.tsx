import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShoppingListManager } from '../../components/ShoppingList/ShoppingListManager';
import { ShoppingList } from '../../components/ShoppingList/ShoppingList';
import { RecipeCard } from '../../components/RecipeCard/RecipeCard';

// Mock the API client
const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../lib/apiClient', () => ({
  apiClient: mockApiClient,
}));

// Mock toast
vi.mock('../../hooks/use-toast', () => ({
  toast: vi.fn(),
}));

describe('ShoppingList Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          queryFn: ({ queryKey }) => mockApiClient.get(queryKey[0] as string),
        },
      },
    });
    vi.clearAllMocks();
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('ShoppingListManager', () => {
    it('should display empty state when no shopping lists exist', async () => {
      mockApiClient.get.mockResolvedValue([]);

      renderWithQueryClient(<ShoppingListManager />);

      await waitFor(() => {
        expect(screen.getByText('No shopping lists yet')).toBeInTheDocument();
        expect(screen.getByText('Create Your First List')).toBeInTheDocument();
      });
    });

    it('should display shopping lists when they exist', async () => {
      const mockLists = [
        {
          id: 'list_1',
          name: 'Weekly Groceries',
          recipeCount: 3,
          itemCount: 12,
          createdAt: '2024-09-01T10:00:00Z'
        }
      ];

      mockApiClient.get.mockResolvedValue(mockLists);

      renderWithQueryClient(<ShoppingListManager />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Groceries')).toBeInTheDocument();
        expect(screen.getByText('12 items')).toBeInTheDocument();
        expect(screen.getByText('3 recipes')).toBeInTheDocument();
      });
    });

    it('should create new shopping list', async () => {
      mockApiClient.get.mockResolvedValue([]);
      mockApiClient.post.mockResolvedValue({
        id: 'new_list',
        name: 'Test List',
        recipeIds: []
      });

      renderWithQueryClient(<ShoppingListManager />);

      // Click create button
      await waitFor(() => {
        expect(screen.getByText('Create Your First List')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Create Your First List'));

      // Fill in form
      const nameInput = screen.getByPlaceholderText('e.g., Weekly Groceries');
      fireEvent.change(nameInput, { target: { value: 'Test List' } });

      // Submit form
      fireEvent.click(screen.getByText('Create List'));

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/api/shopping-lists', {
          name: 'Test List',
          recipeIds: []
        });
      });
    });
  });

  describe('ShoppingList', () => {
    const mockShoppingList = {
      id: 'list_1',
      name: 'Weekly Groceries',
      recipes: [
        { id: '1', title: 'Fresh Caprese Salad' },
        { id: '2', title: 'Garden Vegetable Stir Fry' }
      ],
      items: [
        {
          id: 'item_1',
          name: 'Tomatoes',
          normalizedName: 'tomato',
          totalAmount: '6',
          unit: 'large',
          recipes: ['1', '2'],
          conversions: [
            { from: 'large', to: 'cups', amount: '3', factor: 0.5 }
          ]
        }
      ],
      createdAt: '2024-09-01T10:00:00Z'
    };

    it('should display shopping list items', async () => {
      mockApiClient.get.mockResolvedValue(mockShoppingList);

      renderWithQueryClient(<ShoppingList listId="list_1" />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Groceries')).toBeInTheDocument();
        expect(screen.getByText('Tomatoes')).toBeInTheDocument();
        expect(screen.getByText('6 large')).toBeInTheDocument();
        expect(screen.getByText('Used in 2 recipes')).toBeInTheDocument();
      });
    });

    it('should allow editing items', async () => {
      mockApiClient.get.mockResolvedValue(mockShoppingList);
      mockApiClient.patch.mockResolvedValue({ success: true });

      renderWithQueryClient(<ShoppingList listId="list_1" />);

      await waitFor(() => {
        expect(screen.getByText('Tomatoes')).toBeInTheDocument();
      });

      // Click edit button
      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      // Should show edit inputs
      expect(screen.getByDisplayValue('6')).toBeInTheDocument();
      expect(screen.getByDisplayValue('large')).toBeInTheDocument();

      // Change values
      fireEvent.change(screen.getByDisplayValue('6'), { target: { value: '8' } });
      fireEvent.change(screen.getByDisplayValue('large'), { target: { value: 'medium' } });

      // Save changes
      const saveButton = screen.getByRole('button', { name: /check/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockApiClient.patch).toHaveBeenCalledWith(
          '/api/shopping-list/list_1/items/item_1',
          { amount: '8', unit: 'medium' }
        );
      });
    });

    it('should allow deleting items', async () => {
      mockApiClient.get.mockResolvedValue(mockShoppingList);
      mockApiClient.delete.mockResolvedValue({ success: true });

      renderWithQueryClient(<ShoppingList listId="list_1" />);

      await waitFor(() => {
        expect(screen.getByText('Tomatoes')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: /trash/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockApiClient.delete).toHaveBeenCalledWith(
          '/api/shopping-list/list_1/items/item_1'
        );
      });
    });

    it('should handle export actions', async () => {
      mockApiClient.get.mockResolvedValue(mockShoppingList);
      mockApiClient.post.mockResolvedValue({ success: true });

      renderWithQueryClient(<ShoppingList listId="list_1" />);

      await waitFor(() => {
        expect(screen.getByText('Tomatoes')).toBeInTheDocument();
      });

      // Test copy to clipboard
      const copyButton = screen.getByText('Copy List');
      fireEvent.click(copyButton);

      // Test CSV export
      const csvButton = screen.getByText('Export CSV');
      fireEvent.click(csvButton);

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith(
          '/api/shopping-list/list_1/export',
          { format: 'csv' }
        );
      });

      // Test email export
      const emailButton = screen.getByText('Email List');
      fireEvent.click(emailButton);

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith(
          '/api/shopping-list/list_1/export',
          { format: 'email' }
        );
      });
    });
  });

  describe('RecipeCard Favorites', () => {
    const mockRecipe = {
      id: 'recipe_1',
      title: 'Test Recipe',
      description: 'A test recipe',
      image: 'test.jpg',
      cookTime: 30,
      prepTime: 15,
      servings: 4,
      difficulty: 'Easy' as const,
      rating: 4.5,
      reviewCount: 10,
      tags: ['test'],
    };

    it('should handle favorite toggle', async () => {
      mockApiClient.post.mockResolvedValue({ success: true });

      renderWithQueryClient(
        <RecipeCard recipe={mockRecipe} isFavorited={false} />
      );

      // Click favorite button
      const favoriteButton = screen.getByTestId('favorite-recipe-recipe_1');
      fireEvent.click(favoriteButton);

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith(
          '/api/recipe/recipe_1/save'
        );
      });
    });

    it('should handle unfavorite action', async () => {
      mockApiClient.post.mockResolvedValue({ success: true });

      renderWithQueryClient(
        <RecipeCard recipe={mockRecipe} isFavorited={true} />
      );

      // Click favorite button (should unfavorite)
      const favoriteButton = screen.getByTestId('favorite-recipe-recipe_1');
      fireEvent.click(favoriteButton);

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith(
          '/api/recipe/recipe_1/unsave'
        );
      });
    });
  });
});
