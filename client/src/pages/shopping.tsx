import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useShoppingLists,
  useCreateShoppingList,
  useShoppingListItems,
  useAddShoppingListItem,
  useUpdateShoppingListItem,
  useDeleteShoppingListItem,
  type ShoppingListItem as ApiShoppingItem,
} from "@/lib/api-hooks";
import { 
  Plus, 
  Search, 
  Filter, 
  ShoppingCart, 
  CheckCircle2,
  Trash2,
  Download,
  FileText,
  Share2,
  SortAsc,
  SortDesc,
  List,
  Grid,
  Edit,
  Copy,
  Printer,
} from "lucide-react";

interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  isPurchased: boolean;
  addedDate: string;
}

const DEFAULT_LIST_NAME = "My Shopping List";

export default function Shopping() {
  const { toast } = useToast();
  const { data: lists, isLoading: listsLoading } = useShoppingLists();
  const createList = useCreateShoppingList();
  const [activeListId, setActiveListId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!lists) return;
    if (lists.length > 0) {
      setActiveListId((current) => current ?? lists[0].id);
    } else if (!createList.isPending) {
      createList.mutate({ name: DEFAULT_LIST_NAME }, {
        onSuccess: (created: any) => {
          if (created?.id) setActiveListId(created.id);
        },
      });
    }
  }, [lists, createList]);

  const { data: listDetail } = useShoppingListItems(activeListId);
  const apiItems: ApiShoppingItem[] = React.useMemo(() => {
    if (!listDetail || !Array.isArray((listDetail as any).items)) return [];
    return (listDetail as any).items as ApiShoppingItem[];
  }, [listDetail]);

  const addItemMutation = useAddShoppingListItem(activeListId ?? "");
  const updateItemMutation = useUpdateShoppingListItem(activeListId ?? "");
  const deleteItemMutation = useDeleteShoppingListItem(activeListId ?? "");

  const shoppingList: ShoppingListItem[] = React.useMemo(() =>
    apiItems.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: Number(item.amount) || 1,
      unit: item.unit,
      category: item.category || "other",
      isPurchased: item.isPurchased,
      addedDate: item.createdAt,
    })),
    [apiItems],
  );
  
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [sortBy, setSortBy] = React.useState("added");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [showCompleted, setShowCompleted] = React.useState(true);
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<ShoppingListItem | null>(null);

  const [newItem, setNewItem] = React.useState({
    name: "",
    quantity: 1,
    unit: "pieces",
    category: "vegetables",
    isPurchased: false,
  });

  const categories = [
    "vegetables", "fruits", "dairy", "meat", "grains", "spices", "beverages", "other"
  ];

  const units = [
    "pieces", "kg", "g", "lbs", "oz", "liters", "ml", "cups", "tbsp", "tsp", "cans", "packages"
  ];

  // Filter and sort items
  const filteredItems = React.useMemo(() => {
    let filtered = shoppingList.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      const matchesCompleted = showCompleted || !item.isPurchased;
      return matchesSearch && matchesCategory && matchesCompleted;
    });

    // Sort items
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "category":
          comparison = a.category.localeCompare(b.category);
          break;
        case "quantity":
          comparison = a.quantity - b.quantity;
          break;
        case "added":
          comparison = new Date(a.addedDate).getTime() - new Date(b.addedDate).getTime();
          break;
        case "status":
          comparison = (a.isPurchased ? 1 : 0) - (b.isPurchased ? 1 : 0);
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [shoppingList, searchQuery, selectedCategory, sortBy, sortOrder, showCompleted]);

  const purchasedCount = shoppingList.filter(item => item.isPurchased).length;
  const totalCount = shoppingList.length;
  const remainingCount = totalCount - purchasedCount;

  const handleAddItem = () => {
    if (!newItem.name) {
      toast({
        title: "Missing information",
        description: "Please enter an item name.",
        variant: "destructive",
      });
      return;
    }
    if (!activeListId) {
      toast({ title: "List not ready", description: "Hold on while we set up your list.", variant: "destructive" });
      return;
    }

    addItemMutation.mutate(
      {
        name: newItem.name,
        amount: String(newItem.quantity),
        unit: newItem.unit,
        category: newItem.category,
        isPurchased: newItem.isPurchased,
      },
      {
        onSuccess: () => {
          setNewItem({ name: "", quantity: 1, unit: "pieces", category: "vegetables", isPurchased: false });
          setShowAddDialog(false);
          toast({ title: "Item added!", description: `${newItem.name} has been added to your shopping list.` });
        },
        onError: () => {
          toast({ title: "Could not add item", description: "Please try again.", variant: "destructive" });
        },
      },
    );
  };

  const handleEditItem = (item: ShoppingListItem) => {
    setEditingItem(item);
    setNewItem({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      isPurchased: item.isPurchased,
    });
    setShowAddDialog(true);
  };

  const handleUpdateItem = () => {
    if (!editingItem) return;

    updateItemMutation.mutate(
      {
        itemId: editingItem.id,
        updates: {
          name: newItem.name,
          amount: String(newItem.quantity),
          unit: newItem.unit,
          category: newItem.category,
        },
      },
      {
        onSuccess: () => {
          setEditingItem(null);
          setNewItem({ name: "", quantity: 1, unit: "pieces", category: "vegetables", isPurchased: false });
          setShowAddDialog(false);
          toast({ title: "Item updated!", description: `${newItem.name} has been updated.` });
        },
        onError: () => {
          toast({ title: "Could not update item", description: "Please try again.", variant: "destructive" });
        },
      },
    );
  };

  const handleDeleteItem = (itemId: string, itemName: string) => {
    deleteItemMutation.mutate(itemId, {
      onSuccess: () => {
        toast({ title: "Item removed", description: `${itemName} has been removed from your shopping list.` });
      },
      onError: () => {
        toast({ title: "Could not remove item", description: "Please try again.", variant: "destructive" });
      },
    });
  };

  const handleTogglePurchased = (itemId: string) => {
    const current = shoppingList.find((item) => item.id === itemId);
    if (!current) return;
    updateItemMutation.mutate({ itemId, updates: { isPurchased: !current.isPurchased } });
  };

  const handleClearPurchased = async () => {
    const purchased = shoppingList.filter((item) => item.isPurchased);
    if (purchased.length === 0) {
      toast({ title: "Nothing to clear", description: "Mark items as purchased first." });
      return;
    }
    await Promise.allSettled(purchased.map((item) => deleteItemMutation.mutateAsync(item.id)));
    toast({ title: "Cleared completed items", description: "All purchased items have been removed from your list." });
  };

  const exportToText = () => {
    const text = shoppingList
      .filter(item => !item.isPurchased)
      .map(item => `${item.name} - ${item.quantity} ${item.unit}`)
      .join('\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shopping-list.txt';
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "List exported!",
      description: "Your shopping list has been downloaded as a text file.",
    });
  };

  const copyToClipboard = () => {
    const text = shoppingList
      .filter(item => !item.isPurchased)
      .map(item => `${item.name} - ${item.quantity} ${item.unit}`)
      .join('\n');
    
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard!",
      description: "Your shopping list has been copied.",
    });
  };

  const printList = () => {
    const printContent = shoppingList
      .filter(item => !item.isPurchased)
      .map(item => `${item.name} - ${item.quantity} ${item.unit}`)
      .join('\n');
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Shopping List</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #333; }
              .item { margin: 5px 0; }
            </style>
          </head>
          <body>
            <h1>Shopping List</h1>
            <div>${printContent.split('\n').map(item => `<div class="item">${item}</div>`).join('')}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="relative min-h-screen bg-grain bg-background font-sans text-foreground py-12">
      <div className="relative z-20 container mx-auto px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mb-8"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="relative pb-1">
                <h1 className="font-serif text-4xl lg:text-5xl font-medium tracking-tight text-foreground mb-4">
                  Shopping List
                </h1>
                <div className="w-12 h-0.5 mb-6" style={{ background: 'var(--accent-gold)' }} />
                <p className="text-muted-foreground text-lg italic font-serif">
                  Plan your shopping and never forget an ingredient
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {remainingCount > 0 && (
                  <Badge variant="secondary" className="px-3 py-1">
                    {remainingCount} items remaining
                  </Badge>
                )}
                
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="size-4 mr-2" />
                      Add Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {editingItem ? "Edit Shopping Item" : "Add New Item"}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Item Name</Label>
                        <Input
                          id="name"
                          value={newItem.name}
                          onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Milk"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="quantity">Quantity</Label>
                          <Input
                            id="quantity"
                            type="number"
                            min="1"
                            value={newItem.quantity}
                            onChange={(e) => setNewItem(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="unit">Unit</Label>
                          <Select value={newItem.unit} onValueChange={(value) => setNewItem(prev => ({ ...prev, unit: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {units.map(unit => (
                                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="category">Category</Label>
                        <Select value={newItem.category} onValueChange={(value) => setNewItem(prev => ({ ...prev, category: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(category => (
                              <SelectItem key={category} value={category}>
                                {category.charAt(0).toUpperCase() + category.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex gap-2 pt-4">
                        <Button
                          onClick={editingItem ? handleUpdateItem : handleAddItem}
                          className="flex-1 bg-primary hover:bg-primary/90"
                        >
                          {editingItem ? "Update Item" : "Add Item"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowAddDialog(false);
                            setEditingItem(null);
                            setNewItem({
                              name: "",
                              quantity: 1,
                              unit: "pieces",
                              category: "vegetables",
                              isPurchased: false,
                            });
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
          >
            <Card className="border-0 shadow-sm transition-colors" style={{ background: 'var(--bg-deep-olive)' }}>
              <CardContent className="p-8">
                <div className="flex flex-col items-start gap-4">
                  <ShoppingCart className="size-5" style={{ color: 'var(--accent-gold)' }} />
                  <div>
                    <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--text-on-dark)' }}>{totalCount}</p>
                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--text-on-dark-muted)' }}>Total Items</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm transition-colors" style={{ background: 'var(--bg-deep-olive)' }}>
              <CardContent className="p-8">
                <div className="flex flex-col items-start gap-4">
                  <CheckCircle2 className="size-5" style={{ color: 'var(--accent-gold)' }} />
                  <div>
                    <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--text-on-dark)' }}>{purchasedCount}</p>
                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--text-on-dark-muted)' }}>Purchased</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm transition-colors" style={{ background: 'var(--bg-deep-olive)' }}>
              <CardContent className="p-8">
                <div className="flex flex-col items-start gap-4">
                  <List className="size-5" style={{ color: 'var(--accent-gold)' }} />
                  <div>
                    <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--text-on-dark)' }}>{remainingCount}</p>
                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--text-on-dark-muted)' }}>Remaining</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm transition-colors" style={{ background: 'var(--bg-deep-olive)' }}>
              <CardContent className="p-8">
                <div className="flex flex-col items-start gap-4">
                  <Filter className="size-5" style={{ color: 'var(--accent-gold)' }} />
                  <div>
                    <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--text-on-dark)' }}>{new Set(shoppingList.map(item => item.category)).size}</p>
                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--text-on-dark-muted)' }}>Categories</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Filters and Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Search Bar - Full Width */}
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
                      <Input
                        placeholder="Search shopping items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  {/* Controls Row - Category, Sort, Sort Order, Show Completed */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-full sm:w-40">
                        <Filter className="size-4 mr-2" />
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(category => (
                          <SelectItem key={category} value={category}>
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="flex gap-2 flex-1">
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="flex-1 sm:w-32">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="added">Date Added</SelectItem>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="category">Category</SelectItem>
                          <SelectItem value="quantity">Quantity</SelectItem>
                          <SelectItem value="status">Status</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="outline"
                        onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                        className="px-3"
                      >
                        {sortOrder === "asc" ? <SortAsc className="size-4" /> : <SortDesc className="size-4" />}
                      </Button>
                      
                      <Button
                        variant={showCompleted ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="px-3 whitespace-nowrap"
                      >
                        Show Completed
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Export Actions */}
                {shoppingList.length > 0 && (
                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button variant="outline" size="sm" onClick={exportToText}>
                      <Download className="size-4 mr-2" />
                      Export TXT
                    </Button>
                    <Button variant="outline" size="sm" onClick={copyToClipboard}>
                      <Copy className="size-4 mr-2" />
                      Copy List
                    </Button>
                    <Button variant="outline" size="sm" onClick={printList}>
                      <Printer className="size-4 mr-2" />
                      Print
                    </Button>
                    {purchasedCount > 0 && (
                      <Button variant="outline" size="sm" onClick={handleClearPurchased}>
                        <Trash2 className="size-4 mr-2" />
                        Clear Completed
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Shopping List Items */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {filteredItems.length === 0 ? (
              <Card className="bg-white/95 backdrop-blur-sm">
                <CardContent className="p-12 text-center">
                  <ShoppingCart className="size-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2 text-center">No items found</h3>
                  <p className="text-muted-foreground mb-6 text-center max-w-md mx-auto">
                    {shoppingList.length === 0 
                      ? "Start building your shopping list by adding some items!"
                      : "Try adjusting your search or filter criteria."
                    }
                  </p>
                  {shoppingList.length === 0 && (
                    <div className="flex justify-center">
                      <Button onClick={() => setShowAddDialog(true)}>
                        <Plus className="size-4 mr-2" />
                        Add Your First Item
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className={`transition-all duration-300 ${
                        item.isPurchased 
                          ? "bg-green-50 border-green-200 opacity-75" 
                          : "hover:shadow-md"
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <Checkbox
                              checked={item.isPurchased}
                              onCheckedChange={() => handleTogglePurchased(item.id)}
                              className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                            />
                            
                            <div className="flex-1">
                              <div className={`flex items-center gap-2 ${item.isPurchased ? "line-through text-gray-500" : ""}`}>
                                <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                <Badge variant="secondary" className="text-xs">
                                  {item.category}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600">
                                {item.quantity} {item.unit}
                              </p>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditItem(item)}
                                disabled={item.isPurchased}
                              >
                                <Edit className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteItem(item.id, item.name)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
