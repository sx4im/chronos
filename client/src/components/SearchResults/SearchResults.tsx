import * as React from "react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { RecipeCard, type RecipeCardData } from "@/components/RecipeCard";
import { RecipeCardGridSkeleton } from "@/components/RecipeCard/RecipeCardSkeleton";
import { motion } from "framer-motion";
import { csrfFetch } from "@/lib/apiClient";
import { type SearchFilters } from "@shared/schema";
import { 
  Search, 
  Sparkles, 
  Clock, 
  Star, 
  TrendingUp,
  RefreshCw
} from "lucide-react";

interface SearchResultsProps {
  ingredients: string[];
  filters: SearchFilters;
  onRecipeSave?: (recipeId: string) => void;
  onUseSuggestion?: (recipeId: string) => void;
  className?: string;
}

type SortOption = "relevance" | "time" | "rating" | "popularity";

const SORT_OPTIONS = [
  { value: "relevance", label: "Best Match", icon: Search },
  { value: "time", label: "Quickest", icon: Clock },
  { value: "rating", label: "Highest Rated", icon: Star },
  { value: "popularity", label: "Most Popular", icon: TrendingUp },
] as const;

export const SearchResults = React.memo(function SearchResults({ 
  ingredients, 
  filters, 
  onRecipeSave, 
  onUseSuggestion,
  className 
}: SearchResultsProps) {
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const [isGeneratingCreative, setIsGeneratingCreative] = useState(false);
  const [creativeRecipes, setCreativeRecipes] = useState<RecipeCardData[]>([]);
  const [creativeStreamError, setCreativeStreamError] = useState<Error | null>(null);
  const streamAbortRef = React.useRef<AbortController | null>(null);
  const ingredientsKey = useMemo(() => ingredients.join("\u0000"), [ingredients]);

  React.useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  React.useEffect(() => {
    streamAbortRef.current?.abort();
    setCreativeRecipes([]);
    setCreativeStreamError(null);
  }, [ingredientsKey]);

  const streamCreativeRecipes = React.useCallback(async () => {
    const streamIngredients = ingredientsKey.split("\u0000").filter(Boolean);
    if (streamIngredients.length < 5) return;

    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    setCreativeRecipes([]);
    setCreativeStreamError(null);
    setIsGeneratingCreative(true);

    try {
      const response = await csrfFetch('/api/recipes/recommend', {
        method: 'POST',
        body: JSON.stringify({ ingredients: streamIngredients }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error((await response.text()) || response.statusText);
      }

      const data = await response.json();
      setCreativeRecipes(data.recipes || []);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      setCreativeStreamError(error instanceof Error ? error : new Error("Recipe generation failed"));
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
        setIsGeneratingCreative(false);
      }
    }
  }, [ingredientsKey]);

  const handleGenerateCreative = async () => {
    await streamCreativeRecipes();
  };

  const handleSortChange = (value: string) => {
    setSortBy(value as SortOption);
  };

  // Sort recipes based on selected option
  const sortedRecipes = useMemo(() => {
    const recipes = creativeRecipes;
    
    switch (sortBy) {
      case 'time':
        return [...recipes].sort((a, b) => (a.prepTime + a.cookTime) - (b.prepTime + b.cookTime));
      case 'rating':
        return [...recipes].sort((a, b) => b.rating - a.rating);
      case 'popularity':
        return [...recipes].sort((a, b) => b.reviewCount - a.reviewCount);
      case 'relevance':
      default:
        return recipes;
    }
  }, [creativeRecipes, sortBy]);

  const isLoading = isGeneratingCreative && creativeRecipes.length === 0;
  const error = creativeStreamError;

  // Empty state suggestions
  const getEmptyStateSuggestions = () => {
    const suggestions = [
      "Try adding eggs or cheese",
      "Add some fresh vegetables",
      "Include protein like chicken or tofu",
      "Add herbs and spices",
      "Try adding pasta or rice"
    ];
    return suggestions[Math.floor(Math.random() * suggestions.length)];
  };

  if (ingredients.length === 0) {
    return (
      <EmptyState
        icon={<Search className="size-7" />}
        title="No ingredients yet"
        description="Add at least 5 ingredients to start generating recipes from our AI model."
        action={{
          label: "Enter ingredients above",
          onClick: () => {}
        }}
        className={className}
      />
    );
  }

  if (ingredients.length < 5) {
    return (
      <EmptyState
        icon={<Sparkles className="size-7" />}
        title={`${5 - ingredients.length} more ingredient${5 - ingredients.length === 1 ? '' : 's'} needed`}
        description={`You need at least 5 ingredients to generate recipes from our AI model. You currently have ${ingredients.length}.`}
        action={{
          label: "Keep adding ingredients",
          onClick: () => {}
        }}
        className={className}
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<RefreshCw className="size-7" />}
        title="We couldn't reach the recipe service"
        description="Please check your connection and try the search again."
        action={{
          label: "Retry search",
          onClick: handleGenerateCreative,
        }}
        className={className}
      />
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="display-sm">
            AI Recipe Discoveries
          </h2>
          {creativeRecipes.length > 0 && (
            <Badge variant="secondary" className="text-sm">
              {creativeRecipes.length} recipes created
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Sort dropdown */}
          {creativeRecipes.length > 0 && (
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="size-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <RecipeCardGridSkeleton count={3} />
      ) : sortedRecipes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedRecipes.map((recipe, index) => (
            <motion.div
              key={`${recipe.id}-creative`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2, duration: 0.8, ease: "easeOut" }}
            >
              <RecipeCard
                recipe={recipe}
                onSave={onRecipeSave}
                onUseSuggestion={onUseSuggestion}
                priority={index < 3}
              />
            </motion.div>
          ))}
        </div>
      ) : !isGeneratingCreative && (
        <EmptyState
          icon={<Sparkles className="size-7" />}
          title="Create Custom AI Recipes"
          description="Type at least 5 ingredients in your pantry above, then click below to let our AI craft custom recipes tailored exactly to your ingredients."
          action={{
            label: "Generate AI Recipes",
            onClick: handleGenerateCreative,
            disabled: ingredients.length < 5
          }}
        />
      )}

      {/* Creative generation loading */}
      {isGeneratingCreative && creativeRecipes.length === 0 && (
        <Card className="bg-surface-soft">
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center gap-3">
              <RefreshCw className="size-5 animate-spin text-brand-teal" />
              <span className="text-lg font-semibold text-ink">Crafting your custom recipes...</span>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Our AI chef is curating unique combinations from your ingredients!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Load more button for creative mode */}
      {creativeRecipes.length > 0 && !isGeneratingCreative && (
        <div className="text-center mt-8">
          <Button
            variant="outline"
            onClick={handleGenerateCreative}
            disabled={isGeneratingCreative}
          >
            <Sparkles className="mr-2 size-4" />
            Regenerate Custom Recipes
          </Button>
        </div>
      )}
    </div>
  );
});
