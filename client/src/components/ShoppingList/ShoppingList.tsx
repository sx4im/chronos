import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Download, 
  Mail, 
  Copy,
  Edit3,
  Check,
  X
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ShoppingListMobile } from "./ShoppingListMobile";

interface ShoppingListItem {
  id: string;
  name: string;
  normalizedName: string;
  totalAmount: string;
  unit: string;
  recipes: string[];
  conversions: Array<{
    from: string;
    to: string;
    amount: string;
    factor: number;
  }>;
}

interface ShoppingList {
  id: string;
  name: string;
  recipes: Array<{ id: string; title: string }>;
  items: ShoppingListItem[];
  createdAt: string;
}

interface ShoppingListProps {
  listId?: string;
  onClose?: () => void;
  className?: string;
}

export const ShoppingList = React.memo(function ShoppingList({ listId, onClose, className }: ShoppingListProps) {
  const isMobile = useIsMobile();

  // Use mobile version on mobile devices
  if (isMobile) {
    return (
      <ShoppingListMobile
        listId={listId}
        onClose={onClose}
        className={className}
      />
    );
  }

  return (
    <DesktopShoppingList
      listId={listId}
      onClose={onClose}
      className={className}
    />
  );
});

function DesktopShoppingList({ listId, onClose, className }: ShoppingListProps) {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = React.useState<string | null>(null);
  const [editAmount, setEditAmount] = React.useState("");
  const [editUnit, setEditUnit] = React.useState("");

  const { data: shoppingList, isLoading, error } = useQuery<ShoppingList>({
    queryKey: ['/api/shopping-lists', listId],
    enabled: !!listId,
    retry: 1,
    queryFn: () => apiClient.get<ShoppingList>(`/api/shopping-lists/${listId}`),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: { amount?: string; unit?: string } }) => {
      return apiClient.patch(`/api/shopping-list/${listId}/items/${itemId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shopping-lists', listId] });
      toast({ title: "Item updated successfully" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiClient.delete(`/api/shopping-list/${listId}/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shopping-lists', listId] });
      toast({ title: "Item removed from list" });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (format: 'csv' | 'email') => {
      return apiClient.post(`/api/shopping-list/${listId}/export`, { format });
    },
    onSuccess: (data, format) => {
      if (format === 'csv') {
        // In a real app, you'd trigger a download
        toast({ title: "CSV download started" });
      } else {
        toast({ title: "Shopping list sent to your email!" });
      }
    },
  });

  const startEditing = (item: ShoppingListItem) => {
    setEditingItem(item.id);
    setEditAmount(item.totalAmount);
    setEditUnit(item.unit);
  };

  const saveEdit = () => {
    if (!editingItem) return;
    
    updateItemMutation.mutate({
      itemId: editingItem,
      data: { amount: editAmount, unit: editUnit }
    });
    setEditingItem(null);
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditAmount("");
    setEditUnit("");
  };

  const copyToClipboard = async () => {
    if (!shoppingList) return;
    
    const text = shoppingList.items
      .map(item => `${item.name}: ${item.totalAmount} ${item.unit}`)
      .join('\n');
    
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Shopping list copied to clipboard!" });
    } catch (error) {
      toast({ 
        title: "Failed to copy", 
        description: "Please try again",
        variant: "destructive" 
      });
    }
  };

  if (isLoading) {
    return (
      <Card className={cn("w-full max-w-2xl mx-auto", className)}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-6 bg-muted animate-pulse rounded" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("w-full max-w-2xl mx-auto", className)}>
        <CardContent className="p-6 text-center">
          <ShoppingCart className="mx-auto size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Error loading shopping list</h3>
          <p className="text-muted-foreground">
            {error.message || "Failed to load the shopping list. Please try again."}
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!shoppingList) {
    return (
      <Card className={cn("w-full max-w-2xl mx-auto", className)}>
        <CardContent className="p-6 text-center">
          <ShoppingCart className="mx-auto size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Shopping list not found</h3>
          <p className="text-muted-foreground">
            The shopping list you're looking for doesn't exist.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full max-w-2xl mx-auto", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-xl">{shoppingList.name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {shoppingList.items.length} items • {shoppingList.recipes.length} recipes
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Recipe sources */}
        {shoppingList.recipes.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">From recipes:</Label>
            <div className="flex flex-wrap gap-2">
              {shoppingList.recipes.map((recipe) => (
                <Badge key={recipe.id} variant="outline">
                  {recipe.title}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Shopping list items */}
        <div className="space-y-3">
          {shoppingList.items.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="mx-auto size-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Empty shopping list</h3>
              <p className="text-muted-foreground">
                Add recipes to generate your shopping list.
              </p>
            </div>
          ) : (
            shoppingList.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{item.name}</span>
                    {item.conversions.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {item.conversions[0].amount} {item.conversions[0].to}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Used in {item.recipes.length} recipe{item.recipes.length > 1 ? 's' : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {editingItem === item.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-16 h-8"
                        placeholder="Amount"
                      />
                      <Input
                        value={editUnit}
                        onChange={(e) => setEditUnit(e.target.value)}
                        className="w-20 h-8"
                        placeholder="Unit"
                      />
                      <Button size="sm" onClick={saveEdit} disabled={updateItemMutation.isPending} aria-label={`Check ${item.name}`}>
                        <Check className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit} aria-label={`Cancel ${item.name}`}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="text-right">
                        <div className="font-medium">{item.totalAmount} {item.unit}</div>
                        {item.conversions.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            ≈ {item.conversions[0].amount} {item.conversions[0].to}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing(item)}
                        aria-label={`Edit ${item.name}`}
                      >
                        <Edit3 className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteItemMutation.mutate(item.id)}
                        disabled={deleteItemMutation.isPending}
                        aria-label={`Trash ${item.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Export actions */}
        {shoppingList.items.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
            >
              <Copy className="size-4 mr-2" />
              Copy List
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate('csv')}
              disabled={exportMutation.isPending}
            >
              <Download className="size-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate('email')}
              disabled={exportMutation.isPending}
            >
              <Mail className="size-4 mr-2" />
              Email List
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
