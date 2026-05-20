import * as React from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { 
  ChefHat, 
  Heart, 
  ShoppingCart, 
  Package, 
  Clock, 
  Star,
  TrendingUp,
  Plus,
  ArrowRight,
  Calendar,
  Users,
  Zap,
  Target,
  BookOpen,
  Settings,
  Bell,
} from "lucide-react";

interface QuickStats {
  savedRecipes: number;
  cookedRecipes: number;
  pantryItems: number;
  shoppingItems: number;
}

interface RecentActivity {
  id: string;
  type: 'recipe_saved' | 'recipe_cooked' | 'pantry_added' | 'shopping_added';
  title: string;
  description: string;
  timestamp: string;
  icon: React.ReactNode;
}

interface ExpiringItem {
  id: string;
  name: string;
  expiryDate: string;
  daysLeft: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const favoriteRecipes = useAppStore(state => state.favoriteRecipes);
  const pantryItems = useAppStore(state => state.pantryItems);
  const shoppingList = useAppStore(state => state.shoppingList);
  const getExpiringItems = useAppStore(state => state.getExpiringItems);
  

  const [quickStats] = React.useState<QuickStats>({
    savedRecipes: favoriteRecipes.length,
    cookedRecipes: 12, // Mock data
    pantryItems: pantryItems.length,
    shoppingItems: shoppingList.length,
  });

  const [recentActivity] = React.useState<RecentActivity[]>([
    {
      id: "1",
      type: "recipe_saved",
      title: "Saved Caprese Salad",
      description: "Added to your favorites",
      timestamp: "2 hours ago",
      icon: <Heart className="size-4 text-red-500" />
    },
    {
      id: "2",
      type: "pantry_added",
      title: "Added Tomatoes",
      description: "Added to your pantry",
      timestamp: "4 hours ago",
      icon: <Package className="size-4 text-green-500" />
    },
    {
      id: "3",
      type: "recipe_cooked",
      title: "Cooked Pasta Marinara",
      description: "Marked as completed",
      timestamp: "1 day ago",
      icon: <ChefHat className="size-4 text-primary" />
    },
    {
      id: "4",
      type: "shopping_added",
      title: "Added Basil",
      description: "Added to shopping list",
      timestamp: "2 days ago",
      icon: <ShoppingCart className="size-4 text-primary" />
    }
  ]);

  const expiringItems = getExpiringItems();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        duration: 0.4
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.4,
        ease: "easeOut"
      }
    }
  };

  return (
    <div className="relative min-h-screen bg-grain bg-background font-sans text-foreground py-12">
      
      <div className="relative z-20 container mx-auto px-6 lg:px-12 py-8">
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
                <h1 className="font-serif text-4xl lg:text-5xl font-medium tracking-tight text-foreground mb-4 leading-tight">
                  {getGreeting()}{user?.name?.split(' ')[0] ? `, ${user.name.split(' ')[0]}` : ''}.
                </h1>
                <div className="w-12 h-0.5 mb-6" style={{ background: 'var(--accent-gold)' }} />
                <p className="text-muted-foreground text-lg italic font-serif">
                  Your culinary digest for today.
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="btn-fill-up">
                  <Bell className="size-4 mr-2" />
                  Notifications
                </Button>
                <Button variant="outline" size="sm" className="btn-fill-up">
                  <Settings className="size-4 mr-2" />
                  Settings
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Quick Stats - Editorial Redesign */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
          >
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm transition-colors" style={{ background: 'var(--bg-deep-olive)' }}>
                <CardContent className="p-8">
                  <div className="flex flex-col items-start gap-4">
                    <Heart className="size-5" style={{ color: 'var(--accent-gold)' }} />
                    <div>
                      <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--text-on-dark)' }}>{quickStats.savedRecipes}</p>
                      <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--text-on-dark-muted)' }}>Saved Recipes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm transition-colors" style={{ background: 'var(--bg-deep-olive)' }}>
                <CardContent className="p-8">
                  <div className="flex flex-col items-start gap-4">
                    <ChefHat className="size-5" style={{ color: 'var(--accent-gold)' }} />
                    <div>
                      <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--text-on-dark)' }}>{quickStats.cookedRecipes}</p>
                      <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--text-on-dark-muted)' }}>Recipes Cooked</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm transition-colors" style={{ background: 'var(--bg-deep-olive)' }}>
                <CardContent className="p-8">
                  <div className="flex flex-col items-start gap-4">
                    <Package className="size-5" style={{ color: 'var(--accent-gold)' }} />
                    <div>
                      <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--text-on-dark)' }}>{quickStats.pantryItems}</p>
                      <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--text-on-dark-muted)' }}>Pantry Items</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm transition-colors" style={{ background: 'var(--bg-deep-olive)' }}>
                <CardContent className="p-8">
                  <div className="flex flex-col items-start gap-4">
                    <ShoppingCart className="size-5" style={{ color: 'var(--accent-gold)' }} />
                    <div>
                      <p className="text-3xl font-serif font-medium mb-1" style={{ color: 'var(--text-on-dark)' }}>{quickStats.shoppingItems}</p>
                      <p className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--text-on-dark-muted)' }}>Shopping Items</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-8">
              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                id="quick-actions-card"
              >
                <Card className="bg-white/95 backdrop-blur-sm h-full">
                  <CardHeader>
                    <CardTitle className="font-serif text-2xl font-medium tracking-tight">
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Link href="/search">
                        <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center justify-center gap-2">
                          <ChefHat className="size-5 text-primary" />
                          <div className="text-center">
                            <div className="font-bold text-[10px] tracking-widest uppercase">Find Recipes</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">Discover new meals</div>
                          </div>
                        </Button>
                      </Link>
                      
                      <Link href="/pantry">
                        <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center justify-center gap-2">
                          <Package className="size-5 text-secondary" />
                          <div className="text-center">
                            <div className="font-bold text-[10px] tracking-widest uppercase">Manage Pantry</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">Track ingredients</div>
                          </div>
                        </Button>
                      </Link>
                      
                      <Link href="/shopping">
                        <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center justify-center gap-2">
                          <ShoppingCart className="size-5 text-accent" />
                          <div className="text-center">
                            <div className="font-bold text-[10px] tracking-widest uppercase">Shopping List</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">Plan your shopping</div>
                          </div>
                        </Button>
                      </Link>
                      
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Recent Activity */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                id="recent-activity-card"
              >
                <Card className="bg-white/95 backdrop-blur-sm h-full">
                  <CardHeader>
                    <CardTitle className="font-serif text-2xl font-medium tracking-tight">
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="recent-activity-mobile">
                    <div className="space-y-2 sm:space-y-3">
                      {recentActivity.map((activity, index) => (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + index * 0.1 }}
                          className="recent-activity-item-mobile flex items-center rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="recent-activity-icon-mobile bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                            {activity.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="recent-activity-text-mobile font-medium text-gray-900 truncate">{activity.title}</p>
                            <p className="recent-activity-desc-mobile text-gray-600 truncate">{activity.description}</p>
                          </div>
                          <span className="recent-activity-time-mobile text-gray-500 flex-shrink-0 ml-2">{activity.timestamp}</span>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Expiring Items - Match Quick Actions height */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="bg-white/95 backdrop-blur-sm h-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="font-serif text-2xl font-medium tracking-tight">
                      Expiring Soon
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    {expiringItems.length > 0 ? (
                      <div className="flex flex-col h-full">
                        <div className="space-y-3 overflow-y-auto flex-1 min-h-[200px]">
                          {expiringItems.slice(0, 5).map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-secondary/10 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate text-sm">{item.name}</p>
                                <p className="text-xs text-gray-600">Expires in {item.daysLeft ?? 0} days</p>
                              </div>
                              <Badge variant={(item.daysLeft ?? 0) <= 1 ? "destructive" : "secondary"} className="ml-2 flex-shrink-0 text-xs">
                                {item.daysLeft ?? 0}d
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col justify-center items-center text-center min-h-[145px]">
                        <Package className="size-8 text-gray-300 mx-auto" />
                        <p className="text-gray-600 text-sm">No items expiring soon</p>
                        <p className="text-xs text-gray-500 mt-1">Great job managing your pantry!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Cooking Tips - Match Recent Activity height */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="bg-white/95 backdrop-blur-sm h-full cooking-tips-card">
                  <CardHeader>
                    <CardTitle className="font-serif text-2xl font-medium tracking-tight">
                      Cooking Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="cooking-tips-content">
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 rounded-lg cooking-tips-item">
                        <h4 className="font-medium text-green-700 mb-1 text-2xl">Pro Tip</h4>
                        <p className="text-xs text-green-800">
                          Store fresh herbs in a glass of water in the fridge to keep them fresh longer.
                        </p>
                      </div>
                       <div className="p-4 bg-secondary/10 rounded-lg cooking-tips-item">
                        <h4 className="font-medium text-secondary mb-1 text-2xl">Trending</h4>
                        <p className="text-xs text-secondary/80">
                          One-pot meals are perfect for busy weeknights and easy cleanup.
                        </p>
                      </div>
                      <div className="p-4 bg-amber-50 rounded-lg cooking-tips-item">
                        <h4 className="font-medium text-amber-700 mb-1 text-2xl">Quick Tip</h4>
                        <p className="text-xs text-amber-800">
                          Always taste and season your food at each cooking stage for best flavor.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
