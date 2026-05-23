import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  useSettings,
  useUpdateSettings,
  useUpdateProfile,
  useDeleteAccount,
} from "@/lib/api-hooks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  User, 
  Mail, 
  Bell, 
  Shield, 
  Camera,
  Save,
  Trash2,
  Download,
  Upload,
  Eye,
  EyeOff,
  Lock,
  Key,
  Smartphone,
  Monitor,
  Globe,
  Heart,
  BookOpen,
  Package,
  ShoppingCart,
  ChefHat,
  Clock,
  Scale,
  Thermometer,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Database,
  Cloud,
  CloudOff,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";

export default function Settings() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = React.useState("");

  const [profileData, setProfileData] = React.useState({
    name: user?.name || "",
    email: user?.email || "",
    bio: (user as any)?.bio || "",
    location: (user as any)?.location || "",
    website: (user as any)?.website || "",
  });

  React.useEffect(() => {
    setProfileData({
      name: user?.name || "",
      email: user?.email || "",
      bio: (user as any)?.bio || "",
      location: (user as any)?.location || "",
      website: (user as any)?.website || "",
    });
  }, [user]);

  const [notifications, setNotifications] = React.useState({
    emailNotifications: true,
    pushNotifications: true,
    recipeUpdates: true,
    pantryReminders: true,
    shoppingReminders: false,
    weeklyDigest: true,
    cookingTimer: true,
    ingredientAlerts: true,
  });

  const [privacy, setPrivacy] = React.useState({
    profileVisibility: "public",
    showEmail: false,
    showLocation: true,
    allowMessages: true,
    dataSharing: false,
  });

  const [cookingPreferences, setCookingPreferences] = React.useState({
    defaultServings: 4,
    preferredUnits: "metric",
    temperatureUnit: "celsius",
    defaultCookingTime: 30,
    autoStartTimer: false,
    showNutritionInfo: true,
    showCookingTips: true,
    voiceInstructions: false,
    soundEffects: true,
    difficultyLevel: "intermediate",
  });

  const [accessibility, setAccessibility] = React.useState({
    highContrast: false,
    largeText: false,
    screenReader: false,
    reducedMotion: false,
    keyboardNavigation: true,
  });

  const [dataSync, setDataSync] = React.useState({
    autoSync: true,
    syncFrequency: "realtime",
    offlineMode: false,
    cloudBackup: true,
    lastSync: new Date().toISOString(),
  });

  React.useEffect(() => {
    if (!settings) return;
    if (settings.notifications && Object.keys(settings.notifications).length > 0) {
      setNotifications((prev) => ({ ...prev, ...(settings.notifications as any) }));
    }
    if (settings.privacy && Object.keys(settings.privacy).length > 0) {
      setPrivacy((prev) => ({ ...prev, ...(settings.privacy as any) }));
    }
    if (settings.cookingPreferences && Object.keys(settings.cookingPreferences).length > 0) {
      setCookingPreferences((prev) => ({ ...prev, ...(settings.cookingPreferences as any) }));
    }
    if (settings.accessibility && Object.keys(settings.accessibility).length > 0) {
      setAccessibility((prev) => ({ ...prev, ...(settings.accessibility as any) }));
    }
    if (settings.dataSync && Object.keys(settings.dataSync).length > 0) {
      setDataSync((prev) => ({ ...prev, ...(settings.dataSync as any) }));
    }
  }, [settings]);

  const persistSection = (
    key: "notifications" | "privacy" | "cookingPreferences" | "accessibility" | "dataSync",
    value: Record<string, unknown>,
    successTitle: string,
  ) => {
    updateSettings.mutate({ [key]: value } as any, {
      onSuccess: () => toast({ title: successTitle }),
      onError: () =>
        toast({ title: "Could not save", description: "Please try again.", variant: "destructive" }),
    });
  };

  const handleSaveProfile = () => {
    updateProfile.mutate(
      {
        name: profileData.name.trim(),
        email: profileData.email.trim(),
        bio: profileData.bio.trim(),
        location: profileData.location.trim(),
        website: profileData.website.trim(),
      },
      {
        onSuccess: () => {
          toast({ title: "Profile updated!", description: "Your profile has been saved successfully." });
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

  const handleSaveNotifications = () => persistSection("notifications", notifications, "Notifications updated!");
  const handleSavePrivacy = () => persistSection("privacy", privacy, "Privacy settings updated!");
  const handleSaveCookingPreferences = () =>
    persistSection("cookingPreferences", cookingPreferences, "Cooking preferences updated!");
  const handleSaveAccessibility = () => persistSection("accessibility", accessibility, "Accessibility settings updated!");
  const handleSaveDataSync = () => persistSection("dataSync", dataSync, "Sync settings updated!");

  const handleExportData = () => {
    const data = {
      profile: profileData,
      notifications,
      privacy,
      cookingPreferences,
      accessibility,
      dataSync,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ingredo-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Data exported!",
      description: "Your settings have been downloaded as a JSON file.",
    });
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string);
            // In a real app, you would validate and apply the imported data
            toast({
              title: "Data imported!",
              description: "Your settings have been imported successfully.",
            });
          } catch (error) {
            toast({
              title: "Import failed",
              description: "The file format is invalid.",
              variant: "destructive",
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleDeleteAccount = () => {
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (deleteConfirmation.trim().toUpperCase() !== "DELETE") {
      toast({
        title: "Confirmation required",
        description: "Type DELETE to confirm.",
        variant: "destructive",
      });
      return;
    }
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Account deleted",
          description: "Your account and all data have been removed.",
        });
        setConfirmDeleteOpen(false);
        logout();
        window.location.href = "/";
      },
      onError: (error: any) => {
        toast({
          title: "Could not delete account",
          description: error?.message ?? "Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const handleSyncNow = () => {
    setDataSync(prev => ({ ...prev, lastSync: new Date().toISOString() }));
    toast({
      title: "Sync completed!",
      description: "Your data has been synchronized.",
    });
  };

  return (
    <div className="relative min-h-screen bg-grain bg-background font-sans text-foreground py-12">
      <div className="relative z-20 container mx-auto px-6 lg:px-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mb-8"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-serif text-4xl lg:text-5xl font-medium tracking-tight text-foreground mb-3">
                  Settings
                </h1>
                <p className="text-muted-foreground text-lg italic font-serif">
                  Manage your account preferences and app settings
                </p>
              </div>
            </div>
          </motion.div>

          <div className="space-y-8">
            {/* Profile Settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="size-5 text-primary" />
                    Profile Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-6">
                    <Avatar className="size-20">
                      <AvatarImage src={user?.avatar} alt={user?.name} />
                      <AvatarFallback className="text-2xl">
                        {user?.name?.split(' ').map((n: string) => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Button variant="outline" size="sm">
                        <Camera className="size-4 mr-2" />
                        Change Avatar
                      </Button>
                      <p className="text-sm text-gray-600 mt-1">
                        JPG, PNG or JPEG. Max size 2MB.
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={profileData.name}
                        onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Enter your email"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Input
                      id="bio"
                      value={profileData.bio}
                      onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={profileData.location}
                        onChange={(e) => setProfileData(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="City, Country"
                      />
                    </div>
                    <div>
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        value={profileData.website}
                        onChange={(e) => setProfileData(prev => ({ ...prev, website: e.target.value }))}
                        placeholder="https://yourwebsite.com"
                      />
                    </div>
                  </div>
                  
                  <Button onClick={handleSaveProfile} className="bg-primary hover:bg-primary/90">
                    <Save className="size-4 mr-2" />
                    Save Profile
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Cooking Preferences */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ChefHat className="size-5 text-primary" />
                    Cooking Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="default-servings">Default Servings</Label>
                      <Input
                        id="default-servings"
                        type="number"
                        min="1"
                        max="20"
                        value={cookingPreferences.defaultServings}
                        onChange={(e) => setCookingPreferences(prev => ({ ...prev, defaultServings: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="default-cooking-time">Default Cooking Time (minutes)</Label>
                      <Input
                        id="default-cooking-time"
                        type="number"
                        min="5"
                        max="300"
                        value={cookingPreferences.defaultCookingTime}
                        onChange={(e) => setCookingPreferences(prev => ({ ...prev, defaultCookingTime: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="preferred-units">Preferred Units</Label>
                      <div className="flex gap-2 mt-2">
                      <Button
                          variant={cookingPreferences.preferredUnits === "metric" ? "default" : "outline"}
                        size="sm"
                          onClick={() => setCookingPreferences(prev => ({ ...prev, preferredUnits: "metric" }))}
                      >
                          <Scale className="size-4 mr-1" />
                          Metric
                      </Button>
                      <Button
                          variant={cookingPreferences.preferredUnits === "imperial" ? "default" : "outline"}
                        size="sm"
                          onClick={() => setCookingPreferences(prev => ({ ...prev, preferredUnits: "imperial" }))}
                      >
                          <Scale className="size-4 mr-1" />
                          Imperial
                      </Button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="temperature-unit">Temperature Unit</Label>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant={cookingPreferences.temperatureUnit === "celsius" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCookingPreferences(prev => ({ ...prev, temperatureUnit: "celsius" }))}
                        >
                          <Thermometer className="size-4 mr-1" />
                          °C
                        </Button>
                        <Button
                          variant={cookingPreferences.temperatureUnit === "fahrenheit" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCookingPreferences(prev => ({ ...prev, temperatureUnit: "fahrenheit" }))}
                        >
                          <Thermometer className="size-4 mr-1" />
                          °F
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="auto-start-timer" className="text-gray-900 font-semibold">Auto Start Timer</Label>
                      <p className="text-sm text-gray-600">
                          Automatically start cooking timer when viewing recipes
                      </p>
                    </div>
                      <Switch
                        id="auto-start-timer"
                        checked={cookingPreferences.autoStartTimer}
                        onCheckedChange={(checked) => setCookingPreferences(prev => ({ ...prev, autoStartTimer: checked }))}
                      />
                  </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="show-nutrition" className="text-gray-900 font-semibold">Show Nutrition Info</Label>
                        <p className="text-sm text-gray-600">
                          Display nutritional information for recipes
                        </p>
                      </div>
                      <Switch
                        id="show-nutrition"
                        checked={cookingPreferences.showNutritionInfo}
                        onCheckedChange={(checked) => setCookingPreferences(prev => ({ ...prev, showNutritionInfo: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="show-cooking-tips" className="text-gray-900 font-semibold">Show Cooking Tips</Label>
                        <p className="text-sm text-gray-600">
                          Display helpful cooking tips and techniques
                        </p>
                      </div>
                      <Switch
                        id="show-cooking-tips"
                        checked={cookingPreferences.showCookingTips}
                        onCheckedChange={(checked) => setCookingPreferences(prev => ({ ...prev, showCookingTips: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="voice-instructions" className="text-gray-900 font-semibold">Voice Instructions</Label>
                        <p className="text-sm text-gray-600">
                          Enable voice-guided cooking instructions
                        </p>
                      </div>
                      <Switch
                        id="voice-instructions"
                        checked={cookingPreferences.voiceInstructions}
                        onCheckedChange={(checked) => setCookingPreferences(prev => ({ ...prev, voiceInstructions: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="sound-effects" className="text-gray-900 font-semibold">Sound Effects</Label>
                        <p className="text-sm text-gray-600">
                          Play sound effects for timer alerts and notifications
                        </p>
                      </div>
                      <Switch
                        id="sound-effects"
                        checked={cookingPreferences.soundEffects}
                        onCheckedChange={(checked) => setCookingPreferences(prev => ({ ...prev, soundEffects: checked }))}
                      />
                    </div>
                  </div>
                  
                  <Button onClick={handleSaveCookingPreferences} className="bg-primary hover:bg-primary/90">
                    <Save className="size-4 mr-2" />
                    Save Cooking Preferences
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Notification Settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="size-5 text-secondary" />
                    Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="email-notifications" className="text-gray-900 font-semibold">Email Notifications</Label>
                        <p className="text-sm text-gray-600">
                          Receive notifications via email
                        </p>
                      </div>
                      <Switch
                        id="email-notifications"
                        checked={notifications.emailNotifications}
                        onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, emailNotifications: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="push-notifications" className="text-gray-900 font-semibold">Push Notifications</Label>
                        <p className="text-sm text-gray-600">
                          Receive push notifications in your browser
                        </p>
                      </div>
                      <Switch
                        id="push-notifications"
                        checked={notifications.pushNotifications}
                        onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, pushNotifications: checked }))}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="recipe-updates" className="text-gray-900 font-semibold">Recipe Updates</Label>
                        <p className="text-sm text-gray-600">
                          Get notified when your saved recipes are updated
                        </p>
                      </div>
                      <Switch
                        id="recipe-updates"
                        checked={notifications.recipeUpdates}
                        onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, recipeUpdates: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="pantry-reminders" className="text-gray-900 font-semibold">Pantry Reminders</Label>
                        <p className="text-sm text-gray-600">
                          Get reminded about expiring ingredients
                        </p>
                      </div>
                      <Switch
                        id="pantry-reminders"
                        checked={notifications.pantryReminders}
                        onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, pantryReminders: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="shopping-reminders" className="text-gray-900 font-semibold">Shopping Reminders</Label>
                        <p className="text-sm text-gray-600">
                          Get reminded about your shopping list
                        </p>
                      </div>
                      <Switch
                        id="shopping-reminders"
                        checked={notifications.shoppingReminders}
                        onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, shoppingReminders: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="weekly-digest" className="text-gray-900 font-semibold">Weekly Digest</Label>
                        <p className="text-sm text-gray-600">
                          Receive a weekly summary of your cooking activity
                        </p>
                      </div>
                      <Switch
                        id="weekly-digest"
                        checked={notifications.weeklyDigest}
                        onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, weeklyDigest: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="cooking-timer" className="text-gray-900 font-semibold">Cooking Timer Alerts</Label>
                        <p className="text-sm text-gray-600">
                          Get notified when cooking timers finish
                        </p>
                      </div>
                      <Switch
                        id="cooking-timer"
                        checked={notifications.cookingTimer}
                        onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, cookingTimer: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="ingredient-alerts" className="text-gray-900 font-semibold">Ingredient Alerts</Label>
                        <p className="text-sm text-gray-600">
                          Get notified about missing or expiring ingredients
                        </p>
                      </div>
                      <Switch
                        id="ingredient-alerts"
                        checked={notifications.ingredientAlerts}
                        onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, ingredientAlerts: checked }))}
                      />
                    </div>
                  </div>
                  
                  <Button onClick={handleSaveNotifications} className="bg-primary hover:bg-primary/90">
                    <Save className="size-4 mr-2" />
                    Save Notifications
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Privacy Settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="size-5 text-green-600" />
                    Privacy & Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="profile-visibility" className="text-gray-900 font-semibold">Profile Visibility</Label>
                        <p className="text-sm text-gray-600">
                          Control who can see your profile
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={privacy.profileVisibility === "public" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPrivacy(prev => ({ ...prev, profileVisibility: "public" }))}
                        >
                          <Globe className="size-4 mr-1" />
                          Public
                        </Button>
                        <Button
                          variant={privacy.profileVisibility === "private" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPrivacy(prev => ({ ...prev, profileVisibility: "private" }))}
                        >
                          <Lock className="size-4 mr-1" />
                          Private
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="show-email" className="text-gray-900 font-semibold">Show Email</Label>
                        <p className="text-sm text-gray-600">
                          Display your email address on your profile
                        </p>
                      </div>
                      <Switch
                        id="show-email"
                        checked={privacy.showEmail}
                        onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, showEmail: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="show-location" className="text-gray-900 font-semibold">Show Location</Label>
                        <p className="text-sm text-gray-600">
                          Display your location on your profile
                        </p>
                      </div>
                      <Switch
                        id="show-location"
                        checked={privacy.showLocation}
                        onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, showLocation: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="allow-messages" className="text-gray-900 font-semibold">Allow Messages</Label>
                        <p className="text-sm text-gray-600">
                          Allow other users to send you messages
                        </p>
                      </div>
                      <Switch
                        id="allow-messages"
                        checked={privacy.allowMessages}
                        onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, allowMessages: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="data-sharing" className="text-gray-900 font-semibold">Data Sharing</Label>
                        <p className="text-sm text-gray-600">
                          Allow anonymous usage data to improve the app
                        </p>
                      </div>
                      <Switch
                        id="data-sharing"
                        checked={privacy.dataSharing}
                        onCheckedChange={(checked) => setPrivacy(prev => ({ ...prev, dataSharing: checked }))}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <Separator />
                    <div className="space-y-2">
                      <Button variant="outline" size="sm" className="border-2 border-gray-300">
                        <Key className="size-4 mr-2" />
                        Update Password
                      </Button>
                    </div>
                  </div>
                  
                  <Button onClick={handleSavePrivacy} className="bg-green-600 hover:bg-green-700">
                    <Save className="size-4 mr-2" />
                    Save Privacy Settings
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Accessibility Settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="size-5 text-primary" />
                    Accessibility
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="high-contrast" className="text-gray-900 font-semibold">High Contrast Mode</Label>
                        <p className="text-sm text-gray-600">
                          Increase contrast for better visibility
                        </p>
                      </div>
                      <Switch
                        id="high-contrast"
                        checked={accessibility.highContrast}
                        onCheckedChange={(checked) => setAccessibility(prev => ({ ...prev, highContrast: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="large-text" className="text-gray-900 font-semibold">Large Text</Label>
                        <p className="text-sm text-gray-600">
                          Increase text size for better readability
                        </p>
                      </div>
                      <Switch
                        id="large-text"
                        checked={accessibility.largeText}
                        onCheckedChange={(checked) => setAccessibility(prev => ({ ...prev, largeText: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="screen-reader" className="text-gray-900 font-semibold">Screen Reader Support</Label>
                        <p className="text-sm text-gray-600">
                          Optimize interface for screen readers
                        </p>
                      </div>
                      <Switch
                        id="screen-reader"
                        checked={accessibility.screenReader}
                        onCheckedChange={(checked) => setAccessibility(prev => ({ ...prev, screenReader: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="reduced-motion" className="text-gray-900 font-semibold">Reduce Motion</Label>
                        <p className="text-sm text-gray-600">
                          Minimize animations and transitions
                        </p>
                      </div>
                      <Switch
                        id="reduced-motion"
                        checked={accessibility.reducedMotion}
                        onCheckedChange={(checked) => setAccessibility(prev => ({ ...prev, reducedMotion: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="keyboard-navigation" className="text-gray-900 font-semibold">Keyboard Navigation</Label>
                        <p className="text-sm text-gray-600">
                          Enable full keyboard navigation support
                        </p>
                      </div>
                      <Switch
                        id="keyboard-navigation"
                        checked={accessibility.keyboardNavigation}
                        onCheckedChange={(checked) => setAccessibility(prev => ({ ...prev, keyboardNavigation: checked }))}
                      />
                    </div>
                  </div>
                  
                  <Button onClick={handleSaveAccessibility} className="bg-primary hover:bg-primary/90">
                    <Save className="size-4 mr-2" />
                    Save Accessibility Settings
                        </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Data Sync & Backup */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="size-5 text-green-600" />
                    Data Sync & Backup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="auto-sync" className="text-gray-900 font-semibold">Auto Sync</Label>
                        <p className="text-sm text-gray-600">
                          Automatically sync your data across devices
                        </p>
                      </div>
                      <Switch
                        id="auto-sync"
                        checked={dataSync.autoSync}
                        onCheckedChange={(checked) => setDataSync(prev => ({ ...prev, autoSync: checked }))}
                      />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="cloud-backup" className="text-gray-900 font-semibold">Cloud Backup</Label>
                      <p className="text-sm text-gray-600">
                          Backup your data to the cloud
                      </p>
                    </div>
                    <Switch
                        id="cloud-backup"
                        checked={dataSync.cloudBackup}
                        onCheckedChange={(checked) => setDataSync(prev => ({ ...prev, cloudBackup: checked }))}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="offline-mode" className="text-gray-900 font-semibold">Offline Mode</Label>
                      <p className="text-sm text-gray-600">
                          Enable offline access to your recipes
                      </p>
                    </div>
                    <Switch
                        id="offline-mode"
                        checked={dataSync.offlineMode}
                        onCheckedChange={(checked) => setDataSync(prev => ({ ...prev, offlineMode: checked }))}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <Label className="text-gray-900 font-semibold">Last Sync</Label>
                      <p className="text-sm text-gray-600">
                        {new Date(dataSync.lastSync).toLocaleString()}
                      </p>
                    </div>
                    <Button variant="outline" onClick={handleSyncNow}>
                      <Cloud className="size-4 mr-2" />
                      Sync Now
                    </Button>
                  </div>
                  
                  <Button onClick={handleSaveDataSync} className="bg-green-600 hover:bg-green-700">
                    <Save className="size-4 mr-2" />
                    Save Sync Settings
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Data Management */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="size-5 text-gray-600" />
                    Data Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-gray-900 font-semibold">Export Data</Label>
                        <p className="text-sm text-gray-600">
                          Download all your data including recipes, collections, and settings
                        </p>
                      </div>
                      <Button variant="outline" onClick={handleExportData}>
                        <Download className="size-4 mr-2" />
                        Export
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-gray-900 font-semibold">Import Data</Label>
                        <p className="text-sm text-gray-600">
                          Import data from a previously exported file
                        </p>
                      </div>
                      <Button variant="outline" onClick={handleImportData}>
                        <Upload className="size-4 mr-2" />
                        Import
                      </Button>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-red-600 font-semibold">Delete Account</Label>
                        <p className="text-sm text-gray-600">
                          Permanently delete your account and all associated data
                        </p>
                      </div>
                      <Button variant="destructive" onClick={handleDeleteAccount}>
                        <Trash2 className="size-4 mr-2" />
                        Delete Account
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={(open) => {
          setConfirmDeleteOpen(open);
          if (!open) setDeleteConfirmation("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your account, profile, favorites, pantry items, shopping lists, collections, and settings.
              This action cannot be undone. Type DELETE below to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            placeholder="Type DELETE to confirm"
            aria-label="Type DELETE to confirm account deletion"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteAccount.isPending}
            >
              {deleteAccount.isPending ? "Deleting…" : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
