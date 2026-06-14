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
      case "Easy": return "bg-success/12 text-success";
      case "Medium": return "bg-warning/15 text-warning";
      case "Hard": return "bg-error/10 text-error";
      default: return "bg-surface-card text-muted-foreground";
    }
  };

  const getMatchColor = (percentage: number) => {
    if (percentage >= 90) return "bg-success/12 text-success";
    if (percentage >= 70) return "bg-warning/15 text-warning";
    if (percentage >= 50) return "bg-brand-ochre/20 text-ink";
    return "bg-error/10 text-error";
  };

    return (
    <Card
      className={cn(
        "group overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-[0_18px_40px_-18px_rgba(10,10,10,0.18)] hover:-translate-y-0.5",
        isHovered && "clay-shadow",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/recipe/${recipe.id}`}>
        <div className="relative">
          {recipe.image && (
            <div className="relative aspect-[16/10] overflow-hidden bg-surface-card">
              <img
                src={recipe.image}
                alt={recipe.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading={priority ? "eager" : "lazy"}
              />
              {recipe.matchPercentage !== undefined && (
                <span className="absolute top-3 left-3 rounded-full bg-canvas/95 backdrop-blur px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">
                  {recipe.matchPercentage}% match
                </span>
              )}
            </div>
          )}
          <CardContent className="p-5">
            {/* Status badges */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {!recipe.image && recipe.matchPercentage !== undefined && (
                <Badge className={cn("text-xs font-semibold", getMatchColor(recipe.matchPercentage))}>
                  {recipe.matchPercentage}% match
                </Badge>
              )}
              {recipe.isCreative && (
                <Badge className="text-xs font-semibold bg-brand-lavender text-ink">
                  Creative
                </Badge>
              )}
              {recipe.hasAllIngredients && (
                <Badge className="text-xs bg-success/12 text-success">
                  <CheckCircle2 className="size-3 mr-1" />
                  All ingredients
                </Badge>
              )}
              {recipe.missingIngredients && recipe.missingIngredients.length > 0 && (
                <Badge className="text-xs bg-error/10 text-error">
                  <AlertCircle className="size-3 mr-1" />
                  {recipe.missingIngredients.length} missing
                </Badge>
              )}
            </div>

            {/* Title and description */}
            <div className="mb-3">
              <h3 className="title-md mb-1 line-clamp-1 group-hover:text-brand-pink transition-colors">
                {recipe.title}
              </h3>
              <p className="text-muted-foreground text-sm line-clamp-2 leading-relaxed">
                {recipe.description}
              </p>
            </div>

            {/* Meta information */}
            <div className="flex items-center justify-between mb-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Clock className="size-3.5 shrink-0" />
                  <span>{recipe.prepTime + recipe.cookTime}m</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="size-3.5 shrink-0" />
                  <span>{recipe.servings}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="size-3.5 shrink-0 text-brand-ochre fill-current" />
                  <span className="text-ink font-medium">{recipe.rating}</span>
                </div>
              </div>
              <Badge className={cn("text-xs", getDifficultyColor(recipe.difficulty))}>
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
                      className="text-xs px-2 py-0.5 bg-error/10 text-error"
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
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={handleSave}
                  data-testid={`save-recipe-${recipe.id}`}
                >
                  <Bookmark className={cn("size-4 mr-1", isSaved && "fill-current")} />
                  {isSaved ? "Saved" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={handleFavorite}
                  disabled={isLoading}
                  data-testid={`favorite-recipe-${recipe.id}`}
                >
                  <Heart className={cn("size-4 mr-1", isFavoritedState && "fill-current")} />
                  {isFavoritedState ? "Liked" : "Like"}
                </Button>
              </div>
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
