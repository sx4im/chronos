import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateCollection,
  useDeleteCollection,
  useUpdateProfile,
} from "@/lib/api-hooks";
import {
  Heart,
  BookOpen,
  Clock,
  Star,
  Settings,
  ChefHat,
  Filter,
  SortAsc,
  Trash2,
} from "lucide-react";
import { ShoppingListManager } from "@/components/ShoppingList/ShoppingListManager";
import { ScrollReveal, FadeUp, SlowFadeUp } from "@/components/ScrollReveal";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;
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
  const { toast } = useToast();
  const updateProfile = useUpdateProfile();
  const createCollection = useCreateCollection();
  const deleteCollection = useDeleteCollection();

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

  const [editProfileOpen, setEditProfileOpen] = React.useState(false);
  const [profileDraft, setProfileDraft] = React.useState({
    name: "",
    email: "",
    bio: "",
    location: "",
    website: "",
  });

  React.useEffect(() => {
    if (profile && editProfileOpen) {
      setProfileDraft({
        name: profile.name ?? "",
        email: profile.email ?? "",
        bio: profile.bio ?? "",
        location: profile.location ?? "",
        website: profile.website ?? "",
      });
    }
  }, [profile, editProfileOpen]);

  const [createCollectionOpen, setCreateCollectionOpen] = React.useState(false);
  const [collectionDraft, setCollectionDraft] = React.useState({ name: "", description: "", isPublic: false });

  const [savedDifficultyFilter, setSavedDifficultyFilter] = React.useState<string>("all");
  const [savedSort, setSavedSort] = React.useState<string>("recent");
  const [savedSortOrder, setSavedSortOrder] = React.useState<"asc" | "desc">("desc");

  const filteredSavedRecipes = React.useMemo(() => {
    if (!savedRecipes) return savedRecipes;
    const filtered = savedRecipes.filter((recipe) => {
      if (savedDifficultyFilter === "all") return true;
      return (recipe as any).difficulty?.toLowerCase() === savedDifficultyFilter.toLowerCase();
    });
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (savedSort) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "cookTime":
          comparison = (a.cookTime ?? 0) - (b.cookTime ?? 0);
          break;
        case "rating":
          comparison = (a.rating ?? 0) - (b.rating ?? 0);
          break;
        case "recent":
        default:
          comparison = 0;
          break;
      }
      return savedSortOrder === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [savedRecipes, savedDifficultyFilter, savedSort, savedSortOrder]);

  const submitProfile = () => {
    updateProfile.mutate(
      {
        name: profileDraft.name.trim(),
        email: profileDraft.email.trim(),
        bio: profileDraft.bio.trim(),
        location: profileDraft.location.trim(),
        website: profileDraft.website.trim(),
      },
      {
        onSuccess: () => {
          toast({ title: "Profile updated!", description: "Your profile has been saved." });
          setEditProfileOpen(false);
        },
        onError: (error: any) => {
          toast({
            title: "Could not save profile",
            description: error?.message ?? "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const submitCollection = () => {
    if (!collectionDraft.name.trim()) {
      toast({ title: "Name required", description: "Please give your collection a name.", variant: "destructive" });
      return;
    }
    createCollection.mutate(
      {
        name: collectionDraft.name.trim(),
        description: collectionDraft.description.trim(),
        isPublic: collectionDraft.isPublic,
      },
      {
        onSuccess: () => {
          toast({ title: "Collection created", description: `${collectionDraft.name} is ready.` });
          setCollectionDraft({ name: "", description: "", isPublic: false });
          setCreateCollectionOpen(false);
        },
        onError: (error: any) => {
          toast({
            title: "Could not create collection",
            description: error?.message ?? "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleDeleteCollection = (id: string, name: string) => {
    deleteCollection.mutate(id, {
      onSuccess: () => {
        toast({ title: "Collection deleted", description: `${name} has been removed.` });
      },
      onError: () => {
        toast({ title: "Could not delete collection", variant: "destructive" });
      },
    });
  };

  if (profileLoading) {
    return (
      <div className="relative min-h-screen bg-grain bg-background container mx-auto px-5 sm:px-6 lg:px-8 py-10 sm:py-12">
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
      <div className="relative min-h-screen bg-grain bg-background container mx-auto px-5 sm:px-6 lg:px-8 py-10 sm:py-12">
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
    <div className="relative min-h-screen bg-grain bg-background font-sans text-foreground py-10 sm:py-12">
      <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative z-10">
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

            <Button data-testid="edit-profile" onClick={() => setEditProfileOpen(true)}>
              <Settings className="mr-2 size-4" />
              Edit Profile
            </Button>
          </div>
        </SlowFadeUp>

        {/* Stats Cards */}
        <FadeUp>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <ScrollReveal preset="fadeLeft" >
              <Card className="transition-all hover:shadow-[0_18px_40px_-18px_rgba(10,10,10,0.18)] hover:-translate-y-0.5">
                <CardContent className="p-8">
                  <div className="flex flex-col items-start gap-4">
                    <Heart className="size-5" style={{ color: 'var(--brand-teal)' }} />
                    <div>
                      <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--ink)' }}>{profile.stats.savedRecipes}</p>
                      <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--muted-ink)' }}>Saved Recipes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
            
            <ScrollReveal preset="fadeUp" >
              <Card className="transition-all hover:shadow-[0_18px_40px_-18px_rgba(10,10,10,0.18)] hover:-translate-y-0.5">
                <CardContent className="p-8">
                  <div className="flex flex-col items-start gap-4">
                    <ChefHat className="size-5" style={{ color: 'var(--brand-teal)' }} />
                    <div>
                      <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--ink)' }}>{profile.stats.cookedRecipes}</p>
                      <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--muted-ink)' }}>Recipes Cooked</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
            
            <ScrollReveal preset="fadeRight" >
              <Card className="transition-all hover:shadow-[0_18px_40px_-18px_rgba(10,10,10,0.18)] hover:-translate-y-0.5">
                <CardContent className="p-8">
                  <div className="flex flex-col items-start gap-4">
                    <BookOpen className="size-5" style={{ color: 'var(--brand-teal)' }} />
                    <div>
                      <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--ink)' }}>{profile.stats.collections}</p>
                      <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--muted-ink)' }}>Collections</p>
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
                  <Select value={savedDifficultyFilter} onValueChange={setSavedDifficultyFilter}>
                    <SelectTrigger className="w-36">
                      <Filter className="size-4 mr-2" />
                      <SelectValue placeholder="Difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={savedSort} onValueChange={setSavedSort}>
                    <SelectTrigger className="w-36">
                      <SortAsc className="size-4 mr-2" />
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Recently saved</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="cookTime">Cook time</SelectItem>
                      <SelectItem value="rating">Rating</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSavedSortOrder((order) => (order === "asc" ? "desc" : "asc"))}
                  >
                    {savedSortOrder === "asc" ? "Asc" : "Desc"}
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
            ) : filteredSavedRecipes && filteredSavedRecipes.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSavedRecipes.map((recipe, index) => (
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
                <h2 className="display-sm">My Collections</h2>
                <Button 
                  data-testid="create-collection"
                  onClick={() => setCreateCollectionOpen(true)}
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
                          <div className="flex items-center gap-2">
                            <Badge variant={collection.isPublic ? "default" : "secondary"} className="text-xs">
                              {collection.isPublic ? "Public" : "Private"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => handleDeleteCollection(collection.id, collection.name)}
                              aria-label={`Delete ${collection.name}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
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
                      onClick={() => setCreateCollectionOpen(true)}
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

      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>Update your profile details. These are visible on your public profile.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={profileDraft.name}
                onChange={(e) => setProfileDraft((d) => ({ ...d, name: e.target.value }))}
                maxLength={80}
              />
            </div>
            <div>
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={profileDraft.email}
                onChange={(e) => setProfileDraft((d) => ({ ...d, email: e.target.value }))}
                maxLength={254}
              />
            </div>
            <div>
              <Label htmlFor="profile-bio">Bio</Label>
              <Textarea
                id="profile-bio"
                value={profileDraft.bio}
                onChange={(e) => setProfileDraft((d) => ({ ...d, bio: e.target.value }))}
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="profile-location">Location</Label>
                <Input
                  id="profile-location"
                  value={profileDraft.location}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, location: e.target.value }))}
                  maxLength={120}
                />
              </div>
              <div>
                <Label htmlFor="profile-website">Website</Label>
                <Input
                  id="profile-website"
                  type="url"
                  value={profileDraft.website}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, website: e.target.value }))}
                  placeholder="https://example.com"
                  maxLength={255}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditProfileOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitProfile} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createCollectionOpen} onOpenChange={setCreateCollectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create collection</DialogTitle>
            <DialogDescription>Group recipes together for easier discovery.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="collection-name">Name</Label>
              <Input
                id="collection-name"
                value={collectionDraft.name}
                onChange={(e) => setCollectionDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g., Weeknight dinners"
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="collection-description">Description</Label>
              <Textarea
                id="collection-description"
                value={collectionDraft.description}
                onChange={(e) => setCollectionDraft((d) => ({ ...d, description: e.target.value }))}
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="collection-public">Public</Label>
                <p className="text-xs text-muted-foreground">Public collections can be shared with anyone via link.</p>
              </div>
              <Switch
                id="collection-public"
                checked={collectionDraft.isPublic}
                onCheckedChange={(checked) => setCollectionDraft((d) => ({ ...d, isPublic: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateCollectionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitCollection} disabled={createCollection.isPending}>
              {createCollection.isPending ? "Creating…" : "Create collection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
