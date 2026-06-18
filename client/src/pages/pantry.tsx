import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  usePantryItems,
  useCreatePantryItem,
  useUpdatePantryItem,
  useDeletePantryItem,
  type PantryItem as ApiPantryItem,
} from "@/lib/api-hooks";
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Package, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Edit,
  Trash2,
  SortAsc,
  SortDesc,
  Grid,
  List,
} from "lucide-react";

type PantryItem = ApiPantryItem;

export default function Pantry() {
  const { data: pantryItems = [] } = usePantryItems();
  const createPantryItem = useCreatePantryItem();
  const patchPantryItem = useUpdatePantryItem();
  const deletePantryItem = useDeletePantryItem();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [sortBy, setSortBy] = React.useState("expiry");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<PantryItem | null>(null);

  const [newItem, setNewItem] = React.useState({
    name: "",
    quantity: 1,
    unit: "pieces",
    expiryDate: "",
    category: "vegetables",
  });

  const categories = [
    "vegetables", "fruits", "dairy", "meat", "grains", "spices", "beverages", "other"
  ];

  const units = [
    "pieces", "kg", "g", "lbs", "oz", "liters", "ml", "cups", "tbsp", "tsp", "cans", "packages"
  ];

  // Filter and sort items
  const filteredItems = React.useMemo(() => {
    let filtered = pantryItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    // Sort items
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "expiry": {
          const aTime = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.POSITIVE_INFINITY;
          const bTime = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.POSITIVE_INFINITY;
          comparison = aTime - bTime;
          break;
        }
        case "category":
          comparison = a.category.localeCompare(b.category);
          break;
        case "quantity":
          comparison = Number(a.quantity || 0) - Number(b.quantity || 0);
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [pantryItems, searchQuery, selectedCategory, sortBy, sortOrder]);

  // Get expiry status
  const getExpiryStatus = (expiryDate: string | null | undefined): { status: string; color: "default" | "secondary" | "destructive" | "outline"; days: number } => {
    if (!expiryDate) return { status: "unset", color: "outline", days: Number.POSITIVE_INFINITY };
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { status: "expired", color: "destructive", days: diffDays };
    if (diffDays <= 1) return { status: "expiring", color: "destructive", days: diffDays };
    if (diffDays <= 3) return { status: "soon", color: "secondary", days: diffDays };
    return { status: "fresh", color: "default", days: diffDays };
  };

  const buildPayload = () => ({
    name: newItem.name.trim(),
    quantity: String(newItem.quantity ?? 1),
    unit: newItem.unit,
    category: newItem.category,
    expiryDate: newItem.expiryDate ? new Date(newItem.expiryDate).toISOString() : null,
  });

  const handleAddItem = () => {
    if (!newItem.name) {
      toast({
        title: "Missing information",
        description: "Please provide an item name.",
        variant: "destructive",
      });
      return;
    }

    createPantryItem.mutate(buildPayload(), {
      onSuccess: () => {
        setNewItem({
          name: "",
          quantity: 1,
          unit: "pieces",
          expiryDate: "",
          category: "vegetables",
        });
        setShowAddDialog(false);
        toast({
          title: "Item added!",
          description: `${newItem.name} has been added to your pantry.`,
        });
      },
      onError: () => {
        toast({
          title: "Could not add item",
          description: "Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const handleEditItem = (item: PantryItem) => {
    setEditingItem(item);
    setNewItem({
      name: item.name,
      quantity: Number(item.quantity) || 1,
      unit: item.unit,
      expiryDate: item.expiryDate ? item.expiryDate.slice(0, 10) : "",
      category: item.category,
    });
    setShowAddDialog(true);
  };

  const handleUpdateItem = () => {
    if (!editingItem || !newItem.name) return;

    patchPantryItem.mutate(
      { id: editingItem.id, updates: buildPayload() },
      {
        onSuccess: () => {
          setEditingItem(null);
          setNewItem({
            name: "",
            quantity: 1,
            unit: "pieces",
            expiryDate: "",
            category: "vegetables",
          });
          setShowAddDialog(false);
          toast({
            title: "Item updated!",
            description: `${newItem.name} has been updated.`,
          });
        },
        onError: () => {
          toast({
            title: "Could not update item",
            description: "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleDeleteItem = (itemId: string, itemName: string) => {
    deletePantryItem.mutate(itemId, {
      onSuccess: () => {
        toast({
          title: "Item removed",
          description: `${itemName} has been removed from your pantry.`,
        });
      },
      onError: () => {
        toast({
          title: "Could not remove item",
          description: "Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const getExpiringCount = () => {
    return pantryItems.filter((item: PantryItem) => {
      const status = getExpiryStatus(item.expiryDate);
      return status.status === "expiring" || status.status === "expired";
    }).length;
  };

  return (
    <div className="relative min-h-screen bg-grain bg-background font-sans text-foreground py-10 sm:py-12">
      <div className="relative z-20 container mx-auto px-5 sm:px-6 lg:px-8">
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
                  My Pantry
                </h1>
                <div className="w-12 h-0.5 mb-6" style={{ background: 'var(--accent-gold)' }} />
                <p className="text-muted-foreground text-lg">
                  Manage your ingredients and track expiry dates
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {getExpiringCount() > 0 && (
                  <Badge variant="destructive" className="px-3 py-1">
                    <AlertTriangle className="size-4 mr-1" />
                    {getExpiringCount()} expiring
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
                        {editingItem ? "Edit Pantry Item" : "Add New Item"}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Item Name</Label>
                        <Input
                          id="name"
                          value={newItem.name}
                          onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Tomatoes"
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
                      
                      <div>
                        <Label htmlFor="expiryDate">Expiry Date</Label>
                        <Input
                          id="expiryDate"
                          type="date"
                          value={newItem.expiryDate}
                          onChange={(e) => setNewItem(prev => ({ ...prev, expiryDate: e.target.value }))}
                        />
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
                              expiryDate: "",
                              category: "vegetables",
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
            <Card className="transition-all hover:shadow-[0_18px_40px_-18px_rgba(10,10,10,0.18)] hover:-translate-y-0.5">
              <CardContent className="p-8">
                <div className="flex flex-col items-start gap-4">
                  <Package className="size-5" style={{ color: 'var(--brand-teal)' }} />
                  <div>
                    <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--ink)' }}>{pantryItems.length}</p>
                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--muted-ink)' }}>Total Items</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="transition-all hover:shadow-[0_18px_40px_-18px_rgba(10,10,10,0.18)] hover:-translate-y-0.5">
              <CardContent className="p-8">
                <div className="flex flex-col items-start gap-4">
                  <AlertTriangle className="size-5" style={{ color: 'var(--brand-teal)' }} />
                  <div>
                    <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--ink)' }}>{getExpiringCount()}</p>
                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--muted-ink)' }}>Expiring Soon</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="transition-all hover:shadow-[0_18px_40px_-18px_rgba(10,10,10,0.18)] hover:-translate-y-0.5">
              <CardContent className="p-8">
                <div className="flex flex-col items-start gap-4">
                  <CheckCircle className="size-5" style={{ color: 'var(--brand-teal)' }} />
                  <div>
                    <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--ink)' }}>{new Set(pantryItems.map(item => item.category)).size}</p>
                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--muted-ink)' }}>Categories</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="transition-all hover:shadow-[0_18px_40px_-18px_rgba(10,10,10,0.18)] hover:-translate-y-0.5">
              <CardContent className="p-8">
                <div className="flex flex-col items-start gap-4">
                  <Clock className="size-5" style={{ color: 'var(--brand-teal)' }} />
                  <div>
                    <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--ink)' }}>
                      {pantryItems.filter(item => getExpiryStatus(item.expiryDate).status === "fresh").length}
                    </p>
                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--muted-ink)' }}>Fresh Items</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Filters and Search */}
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
                        placeholder="Search pantry items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  {/* Controls Row - Category, Sort, Sort Order, View Toggle */}
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
                          <SelectItem value="expiry">Expiry Date</SelectItem>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="category">Category</SelectItem>
                          <SelectItem value="quantity">Quantity</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="outline"
                        onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                        className="px-3"
                      >
                        {sortOrder === "asc" ? <SortAsc className="size-4" /> : <SortDesc className="size-4" />}
                      </Button>
                      
                      <div className="flex gap-1">
                        <Button
                          variant={viewMode === "grid" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setViewMode("grid")}
                          className="px-3"
                        >
                          <Grid className="size-4" />
                        </Button>
                        <Button
                          variant={viewMode === "list" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setViewMode("list")}
                          className="px-3"
                        >
                          <List className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Pantry Items */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {filteredItems.length === 0 ? (
              <Card className="bg-white/95 backdrop-blur-sm">
                <CardContent className="p-12 text-center">
                  <Package className="size-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2 text-center">No items found</h3>
                  <p className="text-muted-foreground mb-6 text-center max-w-md mx-auto">
                    {pantryItems.length === 0 
                      ? "Start building your pantry by adding some ingredients!"
                      : "Try adjusting your search or filter criteria."
                    }
                  </p>
                  {pantryItems.length === 0 && (
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
              <div className={viewMode === "grid" 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "space-y-4"
              }>
                <AnimatePresence>
                  {filteredItems.map((item, index) => {
                    const expiryStatus = getExpiryStatus(item.expiryDate);
                    
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className={`hover:shadow-lg transition-all duration-300 ${
                          expiryStatus.status === "expired" ? "border-error/30 bg-error/10" :
                          expiryStatus.status === "expiring" ? "border-secondary/30 bg-secondary/10" :
                           "border-border"
                        }`}>
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <h3 className="font-semibold text-foreground mb-1">{item.name}</h3>
                                <p className="text-sm text-muted-foreground capitalize">{item.category}</p>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditItem(item)}
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
                            
                            <div className="space-y-2 mb-4">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Quantity:</span>
                                <span className="font-medium">{item.quantity} {item.unit}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Expires:</span>
                                <span className="font-medium">{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "Not set"}</span>
                              </div>
                            </div>
                            
                            <Badge 
                              variant={expiryStatus.color}
                              className="w-full justify-center"
                            >
                              {expiryStatus.status === "expired" && "Expired"}
                              {expiryStatus.status === "expiring" && "Expiring today"}
                              {expiryStatus.status === "soon" && `Expires in ${expiryStatus.days} days`}
                              {expiryStatus.status === "fresh" && "Fresh"}
                            </Badge>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
