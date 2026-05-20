import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  ShoppingCart, 
  Plus, 
  Calendar,
  FileText,
  Trash2,
  Edit3,
  Eye
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ShoppingList } from "./ShoppingList";

interface ShoppingListSummary {
  id: string;
  name: string;
  recipeCount: number;
  itemCount: number;
  createdAt: string;
}

interface ShoppingListManagerProps {
  className?: string;
}

export function ShoppingListManager({ className }: ShoppingListManagerProps) {
  const queryClient = useQueryClient();
  const [selectedListId, setSelectedListId] = React.useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [newListName, setNewListName] = React.useState("");
  const [selectedRecipes, setSelectedRecipes] = React.useState<string[]>([]);

  const { data: shoppingLists, isLoading } = useQuery<ShoppingListSummary[]>({
    queryKey: ['/api/shopping-lists'],
  });

  const createListMutation = useMutation({
    mutationFn: async (data: { name: string; recipeIds: string[] }) => {
      return apiClient.post('/api/shopping-lists', data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/shopping-lists'] });
      setIsCreateDialogOpen(false);
      setNewListName("");
      setSelectedRecipes([]);
      toast({ 
        title: "Shopping list created successfully!",
        description: "You can now view your shopping list from the list below."
      });
    },
  });

  const handleCreateList = () => {
    if (!newListName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your shopping list",
        variant: "destructive"
      });
      return;
    }

    createListMutation.mutate({
      name: newListName.trim(),
      recipeIds: selectedRecipes
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (selectedListId) {
    return (
      <ShoppingList
        listId={selectedListId}
        onClose={() => setSelectedListId(null)}
        className={className}
      />
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Shopping List</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="list-name">List Name</Label>
                <Input
                  id="list-name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g., Weekly Groceries"
                />
              </div>
              <div>
                <Label>Select Recipes (Optional)</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  You can add recipes later from your favorites
                </p>
                {/* In a real app, this would show a list of saved recipes */}
                <div className="text-sm text-muted-foreground">
                  Recipe selection will be available in the full implementation
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateList}
                  disabled={createListMutation.isPending}
                >
                  {createListMutation.isPending ? "Creating..." : "Create List"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      {/* Shopping Lists Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : shoppingLists && shoppingLists.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shoppingLists?.map((list) => (
            <Card
              key={list.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedListId(list.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-1">{list.name}</CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedListId(list.id);
                    }}
                  >
                    <Eye className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <FileText className="size-4" />
                      {list.itemCount} items
                    </div>
                    <div className="flex items-center gap-1">
                      <ShoppingCart className="size-4" />
                      {list.recipeCount} recipes
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="size-3" />
                    Created {formatDate(list.createdAt)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="w-full">
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center justify-center min-h-[300px]">
              <ShoppingCart className="size-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No shopping lists yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first shopping list to start organizing your grocery shopping.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="size-4 mr-2" />
                Create Your First List
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
