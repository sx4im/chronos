import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  User, 
  Heart, 
  BookOpen, 
  TrendingUp, 
  Clock, 
  Star, 
  Settings,
  ChefHat,
  ShoppingCart,
  Filter,
  SortAsc,
} from "lucide-react";
import { ShoppingListManager } from "@/components/ShoppingList/ShoppingListManager";
import { ScrollReveal, FadeUp, FadeLeft, FadeRight, SlowFadeUp } from "@/components/ScrollReveal";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  joinDate: string;
  stats: {
    savedRecipes: number;
    cookedRecipes: number;
    collections: number;
    followers: number;
  };
}

interface Recipe {
  id: string;
  title: string;
  image?: string;
  cookTime: number;
  rating: number;
  reviewCount: number;
  tags: string[];
  lastCooked?: string;
}

interface Collection {
  id: string;
  name: string;
  description: string;
  recipeCount: number;
  coverImage?: string;
  isPublic: boolean;
}

export default function Profile() {

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ['/api/profile'],
  });

  const { data: savedRecipes, isLoading: savedLoading } = useQuery<Recipe[]>({
    queryKey: ['/api/profile/saved-recipes'],
  });

  const { data: recentRecipes, isLoading: recentLoading } = useQuery<Recipe[]>({
    queryKey: ['/api/profile/recent-recipes'],
  });

  const { data: collections, isLoading: collectionsLoading } = useQuery<Collection[]>({
    queryKey: ['/api/profile/collections'],
  });

  if (profileLoading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex items-center space-x-4">
            <Skeleton className="size-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Profile not found</h2>
            <p className="text-muted-foreground">
              Unable to load your profile. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-grain bg-background font-sans text-foreground py-12">
      <div className="container mx-auto px-6 lg:px-12 relative z-10">
        <div className="max-w-6xl mx-auto">
        {/* Profile Header */}
        <SlowFadeUp>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8">
            <Avatar className="size-20">
              <AvatarImage src={profile.avatar} alt={profile.name} />
              <AvatarFallback className="text-2xl">
                {profile.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 text-left">
              <h1 className="font-serif text-4xl lg:text-5xl font-medium tracking-tight text-foreground mb-4 text-left">{profile.name}</h1>
              <div className="w-12 h-0.5 mb-6" style={{ background: 'var(--accent-gold)' }} />
              <p className="text-muted-foreground mb-4">{profile.email}</p>
            </div>

            <Button data-testid="edit-profile" onClick={() => alert('Edit Profile functionality coming soon!')}>
              <Settings className="mr-2 size-4" />
              Edit Profile
            </Button>
          </div>
        </SlowFadeUp>

        {/* Stats Cards */}
        <FadeUp>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <ScrollReveal preset="fadeLeft" >
              <Card className="border-0 shadow-sm transition-colors" style={{ background: 'var(--bg-deep-olive)' }}>
                <CardContent className="p-8">
                  <div className="flex flex-col items-start gap-4">
                    <Heart className="size-5" style={{ color: 'var(--accent-gold)' }} />
                    <div>
                      <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--text-on-dark)' }}>{profile.stats.savedRecipes}</p>
                      <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--text-on-dark-muted)' }}>Saved Recipes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
            
            <ScrollReveal preset="fadeUp" >
              <Card className="border-0 shadow-sm transition-colors" style={{ background: 'var(--bg-deep-olive)' }}>
                <CardContent className="p-8">
                  <div className="flex flex-col items-start gap-4">
                    <ChefHat className="size-5" style={{ color: 'var(--accent-gold)' }} />
                    <div>
                      <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--text-on-dark)' }}>{profile.stats.cookedRecipes}</p>
                      <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--text-on-dark-muted)' }}>Recipes Cooked</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
            
            <ScrollReveal preset="fadeRight" >
              <Card className="border-0 shadow-sm transition-colors" style={{ background: 'var(--bg-deep-olive)' }}>
                <CardContent className="p-8">
                  <div className="flex flex-col items-start gap-4">
                    <BookOpen className="size-5" style={{ color: 'var(--accent-gold)' }} />
                    <div>
                      <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--text-on-dark)' }}>{profile.stats.collections}</p>
                      <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--text-on-dark-muted)' }}>Collections</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>
        </FadeUp>

        {/* Content Tabs */}
        <FadeUp>
          <Tabs defaultValue="saved" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="saved" data-testid="tab-saved">Saved Recipes</TabsTrigger>
              <TabsTrigger value="recent" data-testid="tab-recent">Recently Cooked</TabsTrigger>
              <TabsTrigger value="collections" data-testid="tab-collections">Collections</TabsTrigger>
              <TabsTrigger value="shopping" data-testid="tab-shopping">Shopping Lists</TabsTrigger>
            </TabsList>

          {/* Saved Recipes */}
          <TabsContent value="saved" className="space-y-4">
            <FadeUp >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-serif font-medium text-foreground">Saved Recipes</h2>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => alert('Filter functionality coming soon!')}
                  >
                    <Filter className="size-4 mr-2" />
                    Filter
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => alert('Sort functionality coming soon!')}
                  >
                    <SortAsc className="size-4 mr-2" />
                    Sort
                  </Button>
                </div>
              </div>
            </FadeUp>
            
            {savedLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="h-48 w-full" />
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : savedRecipes && savedRecipes.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedRecipes.map((recipe, index) => (
                  <ScrollReveal key={recipe.id} preset="fadeUp" >
                    <Card className="overflow-hidden hover:shadow-md transition-shadow">
                      {recipe.image && (
                        <img 
                          src={recipe.image}
                          alt={recipe.title}
                          className="w-full h-48 object-cover"
                        />
                      )}
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex gap-1">
                            {recipe.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex items-center text-muted-foreground text-sm">
                            <Clock className="mr-1 size-3" />
                            {recipe.cookTime}m
                          </div>
                        </div>
                        <h3 className="font-semibold text-lg mb-2">{recipe.title}</h3>
                        <div className="flex items-center space-x-2">
                          <Star className="size-4 text-accent fill-current" />
                          <span className="text-sm font-medium">{recipe.rating}</span>
                          <span className="text-muted-foreground text-sm">
                            ({recipe.reviewCount})
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </ScrollReveal>
                ))}
              </div>
            ) : (
              <FadeUp >
                <Card>
                  <CardContent className="p-8 text-center">
                    <Heart className="mx-auto size-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No saved recipes yet</h3>
                    <p className="text-muted-foreground">
                      Start exploring recipes and save your favorites!
                    </p>
                  </CardContent>
                </Card>
              </FadeUp>
            )}
          </TabsContent>

          {/* Recent Recipes */}
          <TabsContent value="recent" className="space-y-4">
            <FadeUp >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-serif font-medium text-foreground">Recently Cooked</h2>
                <span className="text-muted-foreground">
                  {recentRecipes?.length || 0} recipes
                </span>
              </div>
            </FadeUp>
            
            {recentLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <Skeleton className="size-16 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : recentRecipes && recentRecipes.length > 0 ? (
              <div className="space-y-4">
                {recentRecipes.map((recipe, index) => (
                  <ScrollReveal key={recipe.id} preset="fadeUp" >
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {recipe.image && (
                            <img 
                              src={recipe.image}
                              alt={recipe.title}
                              className="size-16 rounded object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <h3 className="font-semibold">{recipe.title}</h3>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <span>Cooked {recipe.lastCooked}</span>
                              <div className="flex items-center">
                                <Clock className="mr-1 size-3" />
                                {recipe.cookTime}m
                              </div>
                              <div className="flex items-center">
                                <Star className="mr-1 size-3 text-accent" />
                                {recipe.rating}
                              </div>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            Cook Again
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </ScrollReveal>
                ))}
              </div>
            ) : (
              <FadeUp >
                <Card>
                  <CardContent className="p-8 text-center">
                    <ChefHat className="mx-auto size-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No recipes cooked yet</h3>
                    <p className="text-muted-foreground">
                      Start cooking recipes and they'll appear here!
                    </p>
                  </CardContent>
                </Card>
              </FadeUp>
            )}
          </TabsContent>

          {/* Collections */}
          <TabsContent value="collections" className="space-y-4">
            <FadeUp >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">My Collections</h2>
                <Button 
                  data-testid="create-collection"
                  onClick={() => alert('Create collection functionality coming soon!')}
                >
                  <BookOpen className="mr-2 size-4" />
                  New Collection
                </Button>
              </div>
            </FadeUp>
            
            {collectionsLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <Skeleton className="h-32 w-full" />
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : collections && collections.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {collections.map((collection, index) => (
                  <ScrollReveal key={collection.id} preset="fadeUp" >
                    <Card className="overflow-hidden hover:shadow-md transition-shadow">
                      {collection.coverImage ? (
                        <img 
                          src={collection.coverImage}
                          alt={collection.name}
                          className="w-full h-32 object-cover"
                        />
                      ) : (
                        <div className="w-full h-32 bg-muted flex items-center justify-center">
                          <BookOpen className="size-8 text-muted-foreground" />
                        </div>
                      )}
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold">{collection.name}</h3>
                          <Badge variant={collection.isPublic ? "default" : "secondary"} className="text-xs">
                            {collection.isPublic ? "Public" : "Private"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {collection.description}
                        </p>
                        <div className="text-sm text-muted-foreground">
                          {collection.recipeCount} recipes
                        </div>
                      </CardContent>
                    </Card>
                  </ScrollReveal>
                ))}
              </div>
            ) : (
              <FadeUp >
                <Card>
                  <CardContent className="p-8 text-center">
                    <BookOpen className="mx-auto size-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No collections yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Create collections to organize your favorite recipes!
                    </p>
                    <Button 
                      data-testid="create-first-collection"
                      onClick={() => alert('Create collection functionality coming soon!')}
                    >
                      Create Your First Collection
                    </Button>
                  </CardContent>
                </Card>
              </FadeUp>
            )}
          </TabsContent>
          {/* Shopping Lists */}
          <TabsContent value="shopping" className="space-y-4">
            <FadeUp >
              <ShoppingListManager />
            </FadeUp>
          </TabsContent>
        </Tabs>
        </FadeUp>
        </div>
      </div>
    </div>
  );
}
