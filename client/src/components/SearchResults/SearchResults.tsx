import * as React from "react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { RecipeCard, type RecipeCardData } from "@/components/RecipeCard";
import { RecipeCardGridSkeleton } from "@/components/RecipeCard/RecipeCardSkeleton";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient, csrfFetch } from "@/lib/apiClient";
import { type SearchFilters } from "@shared/schema";
import { 
  Search, 
  Sparkles, 
  Clock, 
  Star, 
  TrendingUp,
  Filter,
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
type SearchMode = "match" | "creative";

interface RecipeSearchResponse {
  recipes: RecipeCardData[];
  total: number;
  mode: SearchMode;
  generatedAt: string;
}

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
  const [activeMode, setActiveMode] = useState<SearchMode>("match");
  const [isGeneratingCreative, setIsGeneratingCreative] = useState(false);
  const [creativeText, setCreativeText] = useState("");
  const [creativeStreamError, setCreativeStreamError] = useState<Error | null>(null);
  const streamAbortRef = React.useRef<AbortController | null>(null);
  const ingredientsKey = useMemo(() => ingredients.join("\u0000"), [ingredients]);

  // Build query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (ingredients.length > 0) {
      params.set('ingredients', ingredients.join(','));
    }
    if (filters.diet && filters.diet !== 'any') {
      params.set('diet', filters.diet);
    }
    if (filters.allergies && filters.allergies.length > 0) {
      params.set('allergies', filters.allergies.join(','));
    }
    if (filters.maxCookTime && filters.maxCookTime !== 60) {
      params.set('maxCookTime', filters.maxCookTime.toString());
    }
    if (filters.cuisine) {
      params.set('cuisine', filters.cuisine);
    }
    if (filters.difficulty && filters.difficulty !== 'any') {
      params.set('difficulty', filters.difficulty);
    }
    if (filters.allowSubstitutions === false) {
      params.set('allowSubstitutions', 'false');
    }
    if (filters.servings && filters.servings !== 4) {
      params.set('servings', filters.servings.toString());
    }
    params.set('mode', 'match');
    params.set('sort', sortBy);
    return params.toString();
  }, [ingredients, filters, sortBy]);

  // Fetch matched recipes
  const { 
    data: matchedData, 
    isLoading: matchedLoading, 
    error: matchedError,
    refetch: refetchMatched
  } = useQuery<RecipeSearchResponse>({
    queryKey: ['/api/recipes', queryParams],
    queryFn: () => apiClient.get<RecipeSearchResponse>(`/api/recipes?${queryParams}`),
    enabled: ingredients.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  React.useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  React.useEffect(() => {
    streamAbortRef.current?.abort();
    setCreativeText("");
    setCreativeStreamError(null);
  }, [ingredientsKey]);

  const streamCreativeRecipes = React.useCallback(async () => {
    const streamIngredients = ingredientsKey.split("\u0000").filter(Boolean);
    if (streamIngredients.length === 0) return;

    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    setCreativeText("");
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

      if (!response.body) {
        throw new Error("Recipe stream was empty");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setCreativeText(prev => prev + decoder.decode(value, { stream: true }));
      }

      const finalChunk = decoder.decode();
      if (finalChunk) {
        setCreativeText(prev => prev + finalChunk);
      }
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

  const handleModeChange = async (value: string) => {
    const mode = value as SearchMode;
    setActiveMode(mode);
    if (mode === 'creative' && !creativeText && !isGeneratingCreative) {
      await streamCreativeRecipes();
    }
  };

  const handleGenerateCreative = async () => {
    setActiveMode('creative');
    await streamCreativeRecipes();
  };

  const handleSortChange = (value: string) => {
    setSortBy(value as SortOption);
  };

  // Sort recipes based on selected option
  const sortedRecipes = useMemo(() => {
    const recipes = matchedData?.recipes || [];
    
    switch (sortBy) {
      case 'time':
        return [...recipes].sort((a, b) => (a.prepTime + a.cookTime) - (b.prepTime + b.cookTime));
      case 'rating':
        return [...recipes].sort((a, b) => b.rating - a.rating);
      case 'popularity':
        return [...recipes].sort((a, b) => b.reviewCount - a.reviewCount);
      case 'relevance':
      default:
        return [...recipes].sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0));
    }
  }, [matchedData, sortBy]);

  const isLoading = activeMode === 'creative' ? isGeneratingCreative && !creativeText : matchedLoading;
  const error = activeMode === 'creative' ? creativeStreamError : matchedError;

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
        icon={<Search className="mx-auto size-12 mb-4 text-primary" />}
        title="No ingredients yet"
        description="Add one or more ingredients to start finding recipes you can cook right now."
        action={{
          label: "Enter ingredients above",
          onClick: () => {}
        }}
        className={className}
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<RefreshCw className="mx-auto size-12 mb-4 text-primary" />}
        title="We couldn't reach the recipe service"
        description="Please check your connection and try the search again."
        action={{
          label: "Retry search",
          onClick: activeMode === 'creative' ? handleGenerateCreative : () => refetchMatched(),
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
          <h2 className="h2 vintage-text-primary">
            {activeMode === 'creative' ? 'Creative Recipes' : 'Matched Recipes'}
          </h2>
          {activeMode === 'creative' && creativeText ? (
            <Badge variant="secondary" className="text-sm">
              AI recommendations
            </Badge>
          ) : matchedData && (
            <Badge variant="secondary" className="text-sm">
              {matchedData.total} recipes found
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Sort dropdown */}
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

          {/* Mode toggle */}
          <Tabs value={activeMode} onValueChange={handleModeChange} className="w-auto">
            <TabsList>
              <TabsTrigger value="match" data-testid="mode-matched">
                <Search className="size-4 mr-1" />
                Matched
              </TabsTrigger>
              <TabsTrigger value="creative" data-testid="mode-creative">
                <Sparkles className="size-4 mr-1" />
                Creative
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Results */}
      {activeMode === 'creative' ? (
        creativeText ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
          >
            <Card>
              <CardContent className="p-6 whitespace-pre-wrap text-sm leading-relaxed">
                {creativeText}
              </CardContent>
            </Card>
          </motion.div>
        ) : !isGeneratingCreative && (
          <EmptyState
            icon={<Sparkles className="mx-auto size-12 mb-4 opacity-50" />}
            title="No creative recipes yet"
            description="Generate creative recommendations from your current ingredients."
            action={{
              label: "Generate creative ideas",
              onClick: handleGenerateCreative
            }}
          />
        )
      ) : isLoading ? (
        <RecipeCardGridSkeleton count={6} />
      ) : sortedRecipes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedRecipes.map((recipe, index) => (
            <motion.div
              key={`${recipe.id}-${activeMode}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2, duration: 0.8, ease: "easeOut" }}
            >
              <RecipeCard
                recipe={recipe}
                onSave={onRecipeSave}
                onUseSuggestion={onUseSuggestion}
                priority={index < 3} // Prioritize first 3 images
              />
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
        >
          <EmptyState
            icon={<Search className="mx-auto size-12 mb-4 opacity-50" />}
            title="No recipes found"
            description={`${getEmptyStateSuggestions()}. Try broadening your filters or adding a few more ingredients.`}
            action={{
              label: "Generate creative ideas",
              onClick: handleGenerateCreative
            }}
          />
        </motion.div>
      )}

      {/* Creative generation loading */}
      {isGeneratingCreative && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center gap-3">
              <RefreshCw className="size-5 animate-spin text-primary" />
              <span className="text-lg font-medium">Generating creative recipes...</span>
            </div>
            <p className="text-muted-foreground mt-2">
              Our AI is creating unique recipe combinations for you!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Load more button for creative mode */}
      {activeMode === 'creative' && creativeText && !isGeneratingCreative && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={handleGenerateCreative}
            disabled={isGeneratingCreative}
          >
            <Sparkles className="mr-2 size-4" />
            Generate More Creative Recipes
          </Button>
        </div>
      )}
    </div>
  );
});
