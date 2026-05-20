import * as React from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, 
  Users, 
  ChefHat, 
  Heart, 
  Share2, 
  Bookmark, 
  Star,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  Timer,
  Plus,
  Minus,
  Printer,
  Copy,
  Facebook,
  Twitter,
  Instagram,
} from "lucide-react";

interface Recipe {
  id: string;
  slug: string;
  title: string;
  description: string;
  image?: string;
  cookTime: number;
  prepTime: number;
  servings: number;
  difficulty: "Easy" | "Medium" | "Hard";
  rating: number;
  reviewCount: number;
  author: {
    name: string;
    avatar?: string;
  };
  ingredients: Array<{
    id: string;
    name: string;
    amount: number;
    unit: string;
    thumbnail?: string;
    substitutes?: Array<{
      name: string;
      confidence: number;
      ratio: string;
    }>;
  }>;
  instructions: Array<{
    step: number;
    description: string;
    time_min?: number;
  }>;
  tags: string[];
  nutrition?: {
    calories: number;
    protein: string;
    carbs: string;
    fat: string;
    fiber: string;
    sugar: string;
  };
}

interface SimilarRecipe {
  id: string;
  slug: string;
  title: string;
  image?: string;
  cookTime: number;
  rating: number;
}

interface TimerState {
  isRunning: boolean;
  timeLeft: number;
  totalTime: number;
  stepNumber: number;
}

export default function Recipe() {
  const params = useParams();
  const slug = params.slug;
  const { toast } = useToast();
  
  // State management
  const [servings, setServings] = React.useState(4);
  const [completedIngredients, setCompletedIngredients] = React.useState<Set<string>>(new Set());
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(new Set());
  const [activeTimer, setActiveTimer] = React.useState<TimerState | null>(null);
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [substitutions, setSubstitutions] = React.useState<Record<string, string>>({});

  // Fetch recipe data
  const { data: recipe, isLoading, error } = useQuery<Recipe>({
    queryKey: ['recipe', slug],
    queryFn: () => apiClient.get(`/api/recipe/${slug}`).then((res: any) => res.data),
    enabled: !!slug,
  });

  // Fetch similar recipes
  const { data: similarRecipes } = useQuery<SimilarRecipe[]>({
    queryKey: ['similar-recipes', recipe?.id],
    queryFn: () => apiClient.get(`/api/recipe/${recipe?.id}/similar`).then((res: any) => res.data),
    enabled: !!recipe?.id,
  });

  // Save recipe mutation
  const saveRecipeMutation = useMutation({
    mutationFn: (recipeId: string) => apiClient.post(`/api/recipe/${recipeId}/save`),
    onSuccess: () => {
      toast({
        title: "Recipe saved!",
        description: "Added to your favorites.",
      });
    },
  });

  // Progress tracking mutation
  const updateProgressMutation = useMutation({
    mutationFn: ({ recipeId, type, itemId }: { recipeId: string; type: 'ingredient' | 'step'; itemId: string | number }) =>
      apiClient.post(`/api/recipe/${recipeId}/progress`, { type, itemId }),
  });

  // Timer management
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTimer?.isRunning && activeTimer.timeLeft > 0) {
      interval = setInterval(() => {
        setActiveTimer(prev => prev ? { ...prev, timeLeft: prev.timeLeft - 1 } : null);
      }, 1000);
    } else if (activeTimer?.timeLeft === 0) {
      // Timer finished
      toast({
        title: "Timer finished!",
        description: `Step ${activeTimer.stepNumber} is complete.`,
      });
      setActiveTimer(null);
    }
    return () => clearInterval(interval);
  }, [activeTimer, toast]);

  // Load saved progress from localStorage
  React.useEffect(() => {
    if (recipe) {
      const savedProgress = localStorage.getItem(`recipe-progress-${recipe.id}`);
      if (savedProgress) {
        const { ingredients, steps, servings: savedServings } = JSON.parse(savedProgress);
        setCompletedIngredients(new Set(ingredients));
        setCompletedSteps(new Set(steps));
        setServings(savedServings);
      }
    }
  }, [recipe]);

  // Save progress to localStorage
  const saveProgress = React.useCallback((ingredients: Set<string>, steps: Set<number>, servings: number) => {
    if (recipe) {
      const progress = {
        ingredients: Array.from(ingredients),
        steps: Array.from(steps),
        servings
      };
      localStorage.setItem(`recipe-progress-${recipe.id}`, JSON.stringify(progress));
    }
  }, [recipe]);

  // Handle ingredient toggle
  const toggleIngredient = (ingredientId: string) => {
    const newCompleted = new Set(completedIngredients);
    if (newCompleted.has(ingredientId)) {
      newCompleted.delete(ingredientId);
    } else {
      newCompleted.add(ingredientId);
    }
    setCompletedIngredients(newCompleted);
    saveProgress(newCompleted, completedSteps, servings);
    
    if (recipe) {
      updateProgressMutation.mutate({
        recipeId: recipe.id,
        type: 'ingredient',
        itemId: ingredientId
      });
    }
  };

  // Handle step toggle
  const toggleStep = (stepNumber: number) => {
    const newCompleted = new Set(completedSteps);
    if (newCompleted.has(stepNumber)) {
      newCompleted.delete(stepNumber);
    } else {
      newCompleted.add(stepNumber);
    }
    setCompletedSteps(newCompleted);
    saveProgress(completedIngredients, newCompleted, servings);
    
    if (recipe) {
      updateProgressMutation.mutate({
        recipeId: recipe.id,
        type: 'step',
        itemId: stepNumber
      });
    }
  };

  // Handle servings change
  const handleServingsChange = (newServings: number) => {
    if (newServings > 0) {
      setServings(newServings);
      saveProgress(completedIngredients, completedSteps, newServings);
    }
  };

  // Calculate adjusted ingredient amounts
  const getAdjustedAmount = (originalAmount: number) => {
    if (!recipe) return originalAmount;
    return Math.round((originalAmount * servings / recipe.servings) * 100) / 100;
  };

  // Timer functions
  const startTimer = (stepNumber: number, timeMinutes: number) => {
    setActiveTimer({
      isRunning: true,
      timeLeft: timeMinutes * 60,
      totalTime: timeMinutes * 60,
      stepNumber
    });
  };

  const pauseTimer = () => {
    setActiveTimer(prev => prev ? { ...prev, isRunning: false } : null);
  };

  const resumeTimer = () => {
    setActiveTimer(prev => prev ? { ...prev, isRunning: true } : null);
  };

  const stopTimer = () => {
    setActiveTimer(null);
  };

  // Format timer display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Share functions
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied!",
      description: "Recipe link copied to clipboard.",
    });
  };

  const shareToSocial = (platform: string) => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(recipe?.title || '');
    let shareUrl = '';
    
    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
        break;
      case 'instagram':
        shareUrl = `https://www.instagram.com/`;
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Use substitution
  const applySubstitution = (ingredientId: string, substituteName: string) => {
    setSubstitutions(prev => ({ ...prev, [ingredientId]: substituteName }));
    toast({
      title: "Substitution applied!",
      description: `Using ${substituteName} instead.`,
    });
  };

  if (isLoading) {
    return (
      <div className="relative min-h-screen">
        <div
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/recipe.webp)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
        <div
          className="fixed inset-0 z-0"
          style={{ backgroundColor: 'rgba(30, 64, 175, 0.8)' }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          <div className="max-w-6xl mx-auto space-y-8">
          <Skeleton className="h-64 w-full rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="relative min-h-screen">
        <div
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/recipe.webp)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
        <div
          className="fixed inset-0 z-0"
          style={{ backgroundColor: 'rgba(30, 64, 175, 0.8)' }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold mb-2 text-foreground">Recipe not found</h2>
              <p className="text-muted-foreground">
              The recipe you're looking for doesn't exist or has been removed.
            </p>
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-grain bg-background font-sans text-foreground py-12">
      <div className="container mx-auto px-6 lg:px-12 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
        <div className="mb-8">
          {recipe.image && (
              <div className="relative mb-6">
            <img 
              src={recipe.image}
              alt={recipe.title}
                  className="w-full h-64 md:h-80 object-cover rounded-lg"
                />
                <div className="absolute top-4 right-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => saveRecipeMutation.mutate(recipe.id)}
                    data-testid="save-recipe"
                  >
                    <Heart className="mr-2 size-4" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowShareModal(true)}
                    data-testid="share-recipe"
                  >
                    <Share2 className="mr-2 size-4" />
                    Share
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handlePrint}
                    data-testid="print-recipe"
                  >
                    <Printer className="mr-2 size-4" />
                    Print
                  </Button>
                </div>
              </div>
          )}
          
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {recipe.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-vintage-warm-brown/20 text-foreground">
                  {tag}
                </Badge>
              ))}
            </div>
            
              <h1 className="font-serif text-3xl md:text-4xl font-medium text-foreground">{recipe.title}</h1>
              <p className="text-lg text-muted-foreground">{recipe.description}</p>
              
              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-vintage-warm-brown/20 flex items-center justify-center">
                  <ChefHat className="size-5 text-foreground" />
                </div>
                <div>
                  <p className="text-foreground font-medium">{recipe.author.name}</p>
                  <p className="text-muted-foreground text-sm">Recipe Author</p>
                </div>
              </div>
            
            {/* Recipe Meta */}
              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="size-4" />
                <span>{recipe.prepTime + recipe.cookTime} mins total</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="size-4" />
                  <span>{servings} servings</span>
              </div>
              <div className="flex items-center gap-1">
                <ChefHat className="size-4" />
                <span>{recipe.difficulty}</span>
              </div>
              <div className="flex items-center gap-1">
                  <Star className="size-4 text-yellow-400 fill-current" />
                <span>{recipe.rating} ({recipe.reviewCount} reviews)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Row with Servings Control */}
          <Card className="mb-8 bg-vintage-light-beige/10 backdrop-blur-sm border-vintage-warm-brown/20">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{recipe.prepTime}</div>
                  <div className="text-sm text-muted-foreground">Prep Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{recipe.cookTime}</div>
                  <div className="text-sm text-muted-foreground">Cook Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{recipe.prepTime + recipe.cookTime}</div>
                  <div className="text-sm text-muted-foreground">Total Time</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleServingsChange(servings - 1)}
                      disabled={servings <= 1}
                      className="size-8 p-0"
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="text-2xl font-bold text-foreground min-w-[3rem]">{servings}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleServingsChange(servings + 1)}
                      className="size-8 p-0"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">Servings</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Timer */}
          {activeTimer && (
            <Card className="mb-8 bg-vintage-warm-brown/20 backdrop-blur-sm border-vintage-warm-brown/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Timer className="size-6 text-foreground" />
                    <div>
                      <div className="text-lg font-bold text-foreground">
                        Step {activeTimer.stepNumber} Timer
                      </div>
                      <div className="text-2xl font-mono text-foreground">
                        {formatTime(activeTimer.timeLeft)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {activeTimer.isRunning ? (
                      <Button size="sm" onClick={pauseTimer}>
                        <Pause className="size-4 mr-2" />
                        Pause
              </Button>
                    ) : (
                      <Button size="sm" onClick={resumeTimer}>
                        <Play className="size-4 mr-2" />
                        Resume
              </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={stopTimer}>
                      <RotateCcw className="size-4 mr-2" />
                      Stop
              </Button>
            </div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-vintage-warm-brown h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${((activeTimer.totalTime - activeTimer.timeLeft) / activeTimer.totalTime) * 100}%` }}
                    ></div>
          </div>
        </div>
              </CardContent>
            </Card>
          )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Ingredients */}
              <Card className="bg-vintage-light-beige/10 backdrop-blur-sm border-vintage-warm-brown/20">
              <CardHeader>
                  <CardTitle className="text-foreground">Ingredients</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="space-y-3">
                    {recipe.ingredients.map((ingredient) => (
                      <div key={ingredient.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-vintage-warm-brown/10 transition-colors">
                        <Checkbox
                          id={ingredient.id}
                          checked={completedIngredients.has(ingredient.id)}
                          onCheckedChange={() => toggleIngredient(ingredient.id)}
                          className="data-[state=checked]:bg-vintage-warm-brown data-[state=checked]:border-vintage-warm-brown"
                        />
                        <div className="flex-1 flex items-center gap-3">
                          {ingredient.thumbnail && (
                            <img 
                              src={ingredient.thumbnail} 
                              alt={ingredient.name}
                              className="size-8 rounded object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <span className={`font-medium ${completedIngredients.has(ingredient.id) ? 'line-through text-muted-foreground/60' : 'text-foreground'}`}>
                              {substitutions[ingredient.id] || ingredient.name}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              {getAdjustedAmount(ingredient.amount)} {ingredient.unit}
                      </span>
                          </div>
                        </div>
                        {ingredient.substitutes && ingredient.substitutes.length > 0 && (
                          <div className="flex gap-1">
                            {ingredient.substitutes.slice(0, 2).map((sub, index) => (
                              <Button
                                key={index}
                                size="sm"
                                variant="outline"
                                onClick={() => applySubstitution(ingredient.id, sub.name)}
                                className="text-xs h-7"
                              >
                                {sub.name}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
              </CardContent>
            </Card>

            {/* Instructions */}
              <Card className="bg-vintage-light-beige/10 backdrop-blur-sm border-vintage-warm-brown/20">
              <CardHeader>
                  <CardTitle className="text-foreground">Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="space-y-6">
                  {recipe.instructions.map((instruction) => (
                      <div key={instruction.step} className="flex gap-4">
                        <div className="flex flex-col items-center">
                      <button
                        onClick={() => toggleStep(instruction.step)}
                            className={`flex-shrink-0 size-10 rounded-full border-2 flex items-center justify-center transition-colors ${
                          completedSteps.has(instruction.step)
                                ? 'bg-vintage-warm-brown border-vintage-warm-brown text-foreground'
                                : 'border-vintage-light-beige/30 hover:border-vintage-warm-brown text-foreground'
                        }`}
                        data-testid={`step-${instruction.step}`}
                      >
                        {completedSteps.has(instruction.step) ? (
                              <CheckCircle2 className="size-5" />
                        ) : (
                          <span className="text-sm font-medium">{instruction.step}</span>
                        )}
                      </button>
                          {instruction.time_min && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startTimer(instruction.step, instruction.time_min!)}
                              className="mt-2 text-xs h-6"
                              disabled={!!activeTimer}
                            >
                              <Timer className="size-3 mr-1" />
                              {instruction.time_min}m
                            </Button>
                          )}
                        </div>
                      <div className="flex-1">
                          <p className={`text-foreground leading-relaxed ${
                          completedSteps.has(instruction.step) 
                              ? 'line-through text-muted-foreground/60' 
                            : ''
                        }`}>
                          {instruction.description}
                        </p>
                      </div>
                      </div>
                  ))}
                  </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
              {/* Nutrition Info */}
              {recipe.nutrition && (
                <Card className="bg-vintage-light-beige/10 backdrop-blur-sm border-vintage-warm-brown/20">
              <CardHeader>
                    <CardTitle className="text-foreground text-lg">Nutrition (per serving)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                      <span className="text-muted-foreground">Calories</span>
                      <span className="text-foreground font-medium">{recipe.nutrition.calories}</span>
                    </div>
                    <Separator className="bg-vintage-warm-brown/20" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Protein</span>
                      <span className="text-foreground font-medium">{recipe.nutrition.protein}</span>
                </div>
                    <Separator className="bg-vintage-warm-brown/20" />
                <div className="flex justify-between">
                      <span className="text-muted-foreground">Carbs</span>
                      <span className="text-foreground font-medium">{recipe.nutrition.carbs}</span>
                </div>
                    <Separator className="bg-vintage-warm-brown/20" />
                <div className="flex justify-between">
                      <span className="text-muted-foreground">Fat</span>
                      <span className="text-foreground font-medium">{recipe.nutrition.fat}</span>
                </div>
                    <Separator className="bg-vintage-warm-brown/20" />
                <div className="flex justify-between">
                      <span className="text-muted-foreground">Fiber</span>
                      <span className="text-foreground font-medium">{recipe.nutrition.fiber}</span>
                </div>
                    <Separator className="bg-vintage-warm-brown/20" />
                <div className="flex justify-between">
                      <span className="text-muted-foreground">Sugar</span>
                      <span className="text-foreground font-medium">{recipe.nutrition.sugar}</span>
                </div>
              </CardContent>
            </Card>
              )}

              {/* Quick Actions */}
              <Card className="bg-vintage-light-beige/10 backdrop-blur-sm border-vintage-warm-brown/20">
                <CardHeader>
                  <CardTitle className="text-foreground text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => setCompletedIngredients(new Set(recipe.ingredients.map(i => i.id)))}
                  >
                    <CheckCircle2 className="mr-2 size-4" />
                    Check All Ingredients
                  </Button>
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => setCompletedSteps(new Set(recipe.instructions.map(i => i.step)))}
                  >
                    <CheckCircle2 className="mr-2 size-4" />
                    Complete All Steps
                  </Button>
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => {
                      setCompletedIngredients(new Set());
                      setCompletedSteps(new Set());
                    }}
                  >
                    <RotateCcw className="mr-2 size-4" />
                    Reset Progress
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Similar Recipes */}
          {recipe && !similarRecipes && (
            <Card className="mt-12 bg-vintage-light-beige/10 backdrop-blur-sm border-vintage-warm-brown/20">
              <CardHeader>
                <CardTitle className="text-foreground">Similar Recipes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Card key={index} className="bg-vintage-warm-brown/10 border-vintage-warm-brown/20">
                      <CardContent className="p-4 space-y-3">
                        <Skeleton className="h-32 w-full rounded" />
                        <Skeleton className="h-5 w-3/4" />
                        <div className="flex justify-between">
                          <Skeleton className="h-4 w-12" />
                          <Skeleton className="h-4 w-10" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {similarRecipes && similarRecipes.length > 0 && (
            <Card className="mt-12 bg-vintage-light-beige/10 backdrop-blur-sm border-vintage-warm-brown/20">
              <CardHeader>
                <CardTitle className="text-foreground">Similar Recipes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {similarRecipes.map((similar) => (
                    <Card key={similar.id} className="bg-vintage-warm-brown/10 border-vintage-warm-brown/20 hover:bg-vintage-warm-brown/20 transition-colors">
                      <CardContent className="p-4">
                        {similar.image && (
                          <img 
                            src={similar.image} 
                            alt={similar.title}
                            className="w-full h-32 object-cover rounded mb-3"
                          />
                        )}
                        <h3 className="font-medium text-foreground mb-2">{similar.title}</h3>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {similar.cookTime}m
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="size-3 text-yellow-400 fill-current" />
                            {similar.rating}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Share Modal */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="bg-vintage-light-beige border-vintage-warm-brown/20">
          <DialogHeader>
            <DialogTitle className="text-primary">Share Recipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input 
                value={window.location.href} 
                readOnly 
                className="flex-1"
              />
              <Button onClick={copyLink} variant="outline">
                <Copy className="size-4 mr-2" />
                Copy
              </Button>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => shareToSocial('facebook')} 
                variant="outline" 
                className="flex-1"
              >
                <Facebook className="size-4 mr-2" />
                Facebook
              </Button>
              <Button 
                onClick={() => shareToSocial('twitter')} 
                variant="outline" 
                className="flex-1"
              >
                <Twitter className="size-4 mr-2" />
                Twitter
              </Button>
              <Button 
                onClick={() => shareToSocial('instagram')} 
                variant="outline" 
                className="flex-1"
              >
                <Instagram className="size-4 mr-2" />
                Instagram
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
