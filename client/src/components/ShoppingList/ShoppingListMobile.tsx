import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  ShoppingCart, 
  Trash2, 
  Download, 
  Mail, 
  Copy,
  Edit3,
  Check,
  X,
  ChevronLeft
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

interface ShoppingListMobileProps {
  listId?: string;
  onClose?: () => void;
  className?: string;
}

export function ShoppingListMobile({ listId, onClose, className }: ShoppingListMobileProps) {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = React.useState<string | null>(null);
  const [editAmount, setEditAmount] = React.useState("");
  const [editUnit, setEditUnit] = React.useState("");
  const [swipedItem, setSwipedItem] = React.useState<string | null>(null);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const { data: shoppingList, isLoading } = useQuery<ShoppingList>({
    queryKey: ['/api/shopping-lists', listId],
    enabled: !!listId,
    queryFn: () => apiClient.get<ShoppingList>(`/api/shopping-lists/${listId}`),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: { amount?: string; unit?: string } }) => {
      return apiClient.patch(`/api/shopping-list/${listId}/items/${itemId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shopping-lists', listId] });
      toast({ title: "Item updated" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiClient.delete(`/api/shopping-list/${listId}/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shopping-lists', listId] });
      toast({ title: "Item removed" });
      setSwipedItem(null);
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (format: 'csv' | 'email') => {
      return apiClient.post(`/api/shopping-list/${listId}/export`, { format });
    },
    onSuccess: (data, format) => {
      if (format === 'csv') {
        toast({ title: "CSV download started" });
      } else {
        toast({ title: "Sent to your email!" });
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
      toast({ title: "Copied to clipboard!" });
    } catch (error) {
      toast({ 
        title: "Failed to copy", 
        description: "Please try again",
        variant: "destructive" 
      });
    }
  };

  const handleTouchStart = (e: React.TouchEvent, itemId: string) => {
    if (editingItem) return;
    
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setSwipedItem(itemId);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touchStart = touchStartRef.current;
    if (!touchStart || !swipedItem) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    
    // Only trigger swipe if horizontal movement is greater than vertical
    if (deltaY > 50) {
      setSwipedItem(null);
      touchStartRef.current = null;
      return;
    }
    
    // Prevent default scrolling if we're swiping
    if (Math.abs(deltaX) > 10) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchStart = touchStartRef.current;
    if (!touchStart || !swipedItem) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    
    // If swipe is significant enough, show delete action
    if (Math.abs(deltaX) > 100) {
      // Swipe action is already handled by the UI state
    } else {
      setSwipedItem(null);
    }
    
    touchStartRef.current = null;
  };

  if (isLoading) {
    return (
      <div className={cn("w-full", className)}>
        <div className="space-y-3">
          <div className="h-6 bg-muted animate-pulse rounded" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!shoppingList) {
    return (
      <div className={cn("w-full", className)}>
        <Card>
          <CardContent className="p-6 text-center">
            <ShoppingCart className="mx-auto size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Shopping list not found</h3>
            <p className="text-muted-foreground">
              The shopping list you're looking for doesn't exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Mobile Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ChevronLeft className="size-5" />
            </Button>
          )}
          <div>
            <h2 className="text-lg font-semibold">{shoppingList.name}</h2>
            <p className="text-sm text-muted-foreground">
              {shoppingList.items.length} items
            </p>
          </div>
        </div>
      </div>

      {/* Recipe sources - compact */}
      {shoppingList.recipes.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-1">
            {shoppingList.recipes.slice(0, 3).map((recipe) => (
              <Badge key={recipe.id} variant="outline" className="text-xs">
                {recipe.title.length > 15 ? `${recipe.title.substring(0, 15)}...` : recipe.title}
              </Badge>
            ))}
            {shoppingList.recipes.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{shoppingList.recipes.length - 3} more
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Shopping list items - mobile optimized */}
      <div className="space-y-2">
        {shoppingList.items.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <ShoppingCart className="mx-auto size-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Empty shopping list</h3>
              <p className="text-muted-foreground text-sm">
                Add recipes to generate your shopping list.
              </p>
            </CardContent>
          </Card>
        ) : (
          shoppingList.items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "relative overflow-hidden",
                swipedItem === item.id && "bg-error/10"
              )}
              onTouchStart={(e) => handleTouchStart(e, item.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">{item.name}</span>
                    {item.conversions.length > 0 && (
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {item.conversions[0].amount} {item.conversions[0].to}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.recipes.length} recipe{item.recipes.length > 1 ? 's' : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {editingItem === item.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-12 h-8 text-sm"
                        placeholder="Qty"
                      />
                      <Input
                        value={editUnit}
                        onChange={(e) => setEditUnit(e.target.value)}
                        className="w-16 h-8 text-sm"
                        placeholder="Unit"
                      />
                      <Button size="sm" onClick={saveEdit} className="size-8 p-0">
                        <Check className="size-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit} className="size-8 p-0">
                        <X className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="text-right">
                        <div className="font-medium text-sm">{item.totalAmount} {item.unit}</div>
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
                        className="size-8 p-0"
                      >
                        <Edit3 className="size-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Swipe to delete overlay */}
              {swipedItem === item.id && (
                <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-4">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteItemMutation.mutate(item.id)}
                    className="h-8"
                  >
                    <Trash2 className="size-4 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Mobile Export Actions - Bottom Sheet Style */}
      {shoppingList.items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 space-y-3">
          <div className="text-center text-sm text-muted-foreground mb-2">
            Export your shopping list
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              className="flex flex-col items-center gap-1 h-auto py-3"
            >
              <Copy className="size-4" />
              <span className="text-xs">Copy</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate('csv')}
              disabled={exportMutation.isPending}
              className="flex flex-col items-center gap-1 h-auto py-3"
            >
              <Download className="size-4" />
              <span className="text-xs">CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate('email')}
              disabled={exportMutation.isPending}
              className="flex flex-col items-center gap-1 h-auto py-3"
            >
              <Mail className="size-4" />
              <span className="text-xs">Email</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
