import * as React from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  Users, 
  Star, 
  Bookmark, 
  Eye, 
  ChefHat, 
  AlertCircle,
  CheckCircle2,
  X,
  Heart
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";

export interface RecipeCardData {
  id: string;
  title: string;
  description: string;
  image: string;
  imageSet?: {
    mobile: string;
    tablet: string;
    desktop: string;
  };
  matchPercentage?: number;
  cookTime: number;
  prepTime: number;
  servings: number;
  difficulty: "Easy" | "Medium" | "Hard";
  rating: number;
  reviewCount: number;
  tags: string[];
  diet?: string;
  cuisine?: string;
  missingIngredients?: string[];
  hasAllIngredients?: boolean;
  isCreative?: boolean;
}

interface RecipeCardProps {
  recipe: RecipeCardData;
  onSave?: (recipeId: string) => void;
  onUseSuggestion?: (recipeId: string) => void;
  onFavorite?: (recipeId: string, isFavorited: boolean) => void;
  className?: string;
  priority?: boolean;
  isFavorited?: boolean;
}

export const RecipeCard = React.memo(function RecipeCard({ 
  recipe, 
  onSave, 
  onUseSuggestion, 
  onFavorite,
  className,
  priority = false,
  isFavorited = false
}: RecipeCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);
  const [isFavoritedState, setIsFavoritedState] = React.useState(isFavorited);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSaved(!isSaved);
    onSave?.(recipe.id);
  };

  const handleUseSuggestion = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onUseSuggestion?.(recipe.id);
  };

  const handleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const newFavoritedState = !isFavoritedState;
      const endpoint = newFavoritedState ? `/api/recipe/${recipe.id}/save` : `/api/recipe/${recipe.id}/unsave`;
      
      await apiClient.post(endpoint);
      setIsFavoritedState(newFavoritedState);
      onFavorite?.(recipe.id, newFavoritedState);
      
      toast({
        title: newFavoritedState ? "Recipe saved!" : "Recipe removed from favorites",
        description: newFavoritedState 
          ? "Added to your favorites" 
          : "Removed from your favorites"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update favorites. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy": return "bg-green-100 text-green-800 border-green-200";
      case "Medium": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Hard": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getMatchColor = (percentage: number) => {
    if (percentage >= 90) return "match-badge";
    if (percentage >= 70) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (percentage >= 50) return "bg-accent/20 text-foreground border-accent/30";
    return "bg-red-100 text-red-800 border-red-200";
  };

  return (
    <Card 
      className={cn(
        "group overflow-hidden transition-all duration-300 hover:shadow-lg cursor-pointer recipe-card-vintage",
        isHovered && "shadow-lg scale-[1.02]",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/recipe/${recipe.id}`}>
        <div className="relative">
          {/* Image */}
          <div className="relative overflow-hidden">
            {recipe.imageSet ? (
              <picture>
                <source media="(min-width: 1024px)" srcSet={recipe.imageSet.desktop} />
                <source media="(min-width: 768px)" srcSet={recipe.imageSet.tablet} />
                <img
                  src={recipe.imageSet.mobile}
                  alt={recipe.title}
                  width={600}
                  height={400}
                  className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                  loading={priority ? "eager" : "lazy"}
                />
              </picture>
            ) : (
              <img
                src={recipe.image}
                alt={recipe.title}
                width={600}
                height={400}
                className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                loading={priority ? "eager" : "lazy"}
              />
            )}
            
            {/* Overlay with actions */}
            <div className={cn(
              "absolute inset-0 bg-black/20 transition-opacity duration-300 flex items-center justify-center",
              isHovered ? "opacity-100" : "opacity-0"
            )}>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 px-3"
                  onClick={handleSave}
                  data-testid={`save-recipe-${recipe.id}`}
                >
                  <Bookmark className={cn("size-4 mr-1", isSaved && "fill-current")} />
                  {isSaved ? "Saved" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant={isFavoritedState ? "default" : "secondary"}
                  className="h-8 px-3"
                  onClick={handleFavorite}
                  disabled={isLoading}
                  data-testid={`favorite-recipe-${recipe.id}`}
                >
                  <Heart className={cn("size-4 mr-1", isFavoritedState && "fill-current")} />
                  {isFavoritedState ? "Favorited" : "Favorite"}
                </Button>
                <Button
                  size="sm"
                  className="h-8 px-3"
                  onClick={handleUseSuggestion}
                  data-testid={`use-suggestion-${recipe.id}`}
                >
                  <ChefHat className="size-4 mr-1" />
                  Use This
                </Button>
              </div>
            </div>

            {/* Match percentage badge */}
            {recipe.matchPercentage !== undefined && (
              <div className="absolute top-3 left-3">
                <Badge 
                  className={cn(
                    "px-2 py-1 text-xs font-semibold",
                    getMatchColor(recipe.matchPercentage)
                  )}
                >
                  {recipe.matchPercentage}% match
                </Badge>
              </div>
            )}

            {/* Creative badge */}
            {recipe.isCreative && (
              <div className="absolute top-3 right-3">
                <Badge className="px-2 py-1 text-xs font-semibold creative-badge">
                  Creative
                </Badge>
              </div>
            )}

            {/* Missing ingredients indicator */}
            {recipe.missingIngredients && recipe.missingIngredients.length > 0 && (
              <div className="absolute bottom-3 right-3">
                <Badge 
                  className="px-2 py-1 text-xs missing-ingredient"
                >
                  <AlertCircle className="size-3 mr-1" />
                  {recipe.missingIngredients.length} missing
                </Badge>
              </div>
            )}

            {/* All ingredients available indicator */}
            {recipe.hasAllIngredients && (
              <div className="absolute bottom-3 right-3">
                <Badge 
                  className="px-2 py-1 text-xs all-ingredients"
                >
                  <CheckCircle2 className="size-3 mr-1" />
                  All ingredients
                </Badge>
              </div>
            )}
          </div>

          <CardContent className="p-4">
            {/* Title and description */}
            <div className="mb-3">
              <h3 className="recipe-title mb-1 line-clamp-1 group-hover:text-vintage-warm-brown transition-colors">
                {recipe.title}
              </h3>
              <p className="text-muted-foreground text-sm line-clamp-2">
                {recipe.description}
              </p>
            </div>

            {/* Meta information */}
            <div className="flex items-center justify-between mb-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <div className="flex items-center">
                  <Clock className="size-4 mr-1" />
                  <span>{recipe.prepTime + recipe.cookTime}m</span>
                </div>
                <div className="flex items-center">
                  <Users className="size-4 mr-1" />
                  <span>{recipe.servings}</span>
                </div>
                <div className="flex items-center">
                  <Star className="size-4 mr-1 text-accent fill-current" />
                  <span>{recipe.rating}</span>
                </div>
              </div>
              <Badge 
                className={cn(
                  "text-xs px-2 py-1",
                  getDifficultyColor(recipe.difficulty)
                )}
              >
                {recipe.difficulty}
              </Badge>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mb-3">
              {recipe.diet && (
                <Badge variant="outline" className="text-xs">
                  {recipe.diet}
                </Badge>
              )}
              {recipe.cuisine && (
                <Badge variant="outline" className="text-xs">
                  {recipe.cuisine}
                </Badge>
              )}
              {recipe.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Missing ingredients pills */}
            {recipe.missingIngredients && recipe.missingIngredients.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-1">Missing ingredients:</p>
                <div className="flex flex-wrap gap-1">
                  {recipe.missingIngredients.slice(0, 3).map((ingredient) => (
                    <Badge 
                      key={ingredient} 
                      className="text-xs px-2 py-0.5 missing-ingredient"
                    >
                      <X className="size-2 mr-1" />
                      {ingredient}
                    </Badge>
                  ))}
                  {recipe.missingIngredients.length > 3 && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                      +{recipe.missingIngredients.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                data-testid={`view-recipe-${recipe.id}`}
              >
                <Eye className="size-4 mr-1" />
                View Recipe
              </Button>
              <span className="text-xs text-muted-foreground">
                {recipe.reviewCount} reviews
              </span>
            </div>
          </CardContent>
        </div>
      </Link>
    </Card>
  );
});
