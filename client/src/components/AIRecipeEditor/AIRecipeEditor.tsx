import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/apiClient';
import { 
  Save, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Edit3, 
  Eye,
  HelpCircle,
  ChefHat,
  Clock,
  Users
} from 'lucide-react';

interface AIRecipe {
  id?: string;
  title: string;
  description: string;
  image: string;
  cookTime: number;
  prepTime: number;
  servings: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  ingredients: Array<{
    id: string;
    name: string;
    amount: number;
    unit: string;
    thumbnail?: string;
  }>;
  instructions: Array<{
    step: number;
    description: string;
    time_min?: number;
  }>;
  tags: string[];
  nutrition: {
    calories: number;
    protein: string;
    carbs: string;
    fat: string;
    fiber?: string;
    sugar?: string;
  };
  source: 'ingredo_generated';
}

interface AIRecipeEditorProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: AIRecipe | null;
  onSave: (recipe: AIRecipe) => void;
}

export default function AIRecipeEditor({ isOpen, onClose, recipe, onSave }: AIRecipeEditorProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedRecipe, setEditedRecipe] = useState<AIRecipe | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (recipe) {
      setEditedRecipe(recipe);
      setHasUnsavedChanges(false);
      setJsonError(null);
    }
  }, [recipe]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        setIsEditing(false);
        setEditedRecipe(recipe);
        setHasUnsavedChanges(false);
        setJsonError(null);
      }
    } else {
      setIsEditing(false);
    }
  };

  const handleJsonChange = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      setEditedRecipe(parsed);
      setJsonError(null);
      setHasUnsavedChanges(true);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON');
    }
  };

  const validateRecipe = (recipe: AIRecipe): string[] => {
    const errors: string[] = [];
    
    if (!recipe.title?.trim()) {
      errors.push('Title is required');
    }
    
    if (!recipe.description?.trim()) {
      errors.push('Description is required');
    }
    
    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      errors.push('At least one ingredient is required');
    } else {
      recipe.ingredients.forEach((ingredient, index) => {
        if (!ingredient.name?.trim()) {
          errors.push(`Ingredient ${index + 1} name is required`);
        }
        if (!ingredient.amount || ingredient.amount <= 0) {
          errors.push(`Ingredient ${index + 1} amount must be greater than 0`);
        }
      });
    }
    
    if (!recipe.instructions || recipe.instructions.length === 0) {
      errors.push('At least one instruction step is required');
    } else {
      recipe.instructions.forEach((instruction, index) => {
        if (!instruction.description?.trim()) {
          errors.push(`Instruction step ${index + 1} description is required`);
        }
      });
    }
    
    if (!recipe.cookTime || recipe.cookTime <= 0) {
      errors.push('Cook time must be greater than 0');
    }
    
    if (!recipe.prepTime || recipe.prepTime < 0) {
      errors.push('Prep time must be 0 or greater');
    }
    
    if (!recipe.servings || recipe.servings <= 0) {
      errors.push('Servings must be greater than 0');
    }
    
    return errors;
  };

  const handleSave = async () => {
    if (!editedRecipe) return;
    
    const validationErrors = validateRecipe(editedRecipe);
    if (validationErrors.length > 0) {
      toast({
        title: "Validation Error",
        description: validationErrors.join(', '),
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiClient.post<AIRecipe>('/api/recipe', {
        ...editedRecipe,
        source: 'ingredo_generated',
        slug: editedRecipe.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      });
      
      toast({
        title: "Recipe Saved",
        description: "Your AI-generated recipe has been saved successfully!",
      });
      
      onSave(response);
      setIsEditing(false);
      setHasUnsavedChanges(false);
      onClose();
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save the recipe. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatJson = (obj: any) => {
    return JSON.stringify(obj, null, 2);
  };

  if (!recipe) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-2xl font-bold">AI-Generated Recipe</DialogTitle>
              <Badge variant="secondary" className="bg-primary/10 text-primary uppercase tracking-widest font-bold text-[10px]">
                <ChefHat className="size-3 mr-1" />
                AI Generated
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <HelpCircle className="size-4" />
                <span>This recipe was generated using your ingredients as a base — you can tweak quantities or steps.</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex gap-6 h-[70vh]">
          {/* Left Panel - JSON Editor */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Recipe Data</h3>
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button onClick={handleEdit} size="sm" variant="outline">
                    <Edit3 className="size-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={handleCancel} size="sm" variant="outline">
                      <X className="size-4 mr-2" />
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSave} 
                      size="sm" 
                      disabled={!!jsonError || isSaving}
                    >
                      <Save className="size-4 mr-2" />
                      {isSaving ? 'Saving...' : 'Save Recipe'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="flex-1 flex flex-col">
                <textarea
                  value={formatJson(editedRecipe)}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="flex-1 p-4 border rounded-lg font-mono text-sm resize-none"
                  placeholder="Edit the recipe JSON..."
                />
                {jsonError && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertTriangle className="size-4" />
                      <span className="font-medium">JSON Error:</span>
                    </div>
                    <p className="text-red-700 text-sm mt-1">{jsonError}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <pre className="p-4 bg-gray-50 rounded-lg text-sm font-mono overflow-auto">
                  {formatJson(editedRecipe)}
                </pre>
              </div>
            )}
          </div>

          <Separator orientation="vertical" />

          {/* Right Panel - Live Preview */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="size-5" />
              <h3 className="text-lg font-semibold">Live Preview</h3>
            </div>

            <div className="flex-1 overflow-auto">
              {editedRecipe && (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">{editedRecipe.title}</CardTitle>
                        <p className="text-muted-foreground mt-2">{editedRecipe.description}</p>
                      </div>
                      <img 
                        src={editedRecipe.image} 
                        alt={editedRecipe.title}
                        className="size-24 object-cover rounded-lg"
                      />
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="flex items-center gap-2">
                        <Clock className="size-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Prep Time</p>
                          <p className="text-sm text-muted-foreground">{editedRecipe.prepTime} min</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="size-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Cook Time</p>
                          <p className="text-sm text-muted-foreground">{editedRecipe.cookTime} min</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="size-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Servings</p>
                          <p className="text-sm text-muted-foreground">{editedRecipe.servings}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold mb-3">Ingredients</h4>
                        <ul className="space-y-2">
                          {editedRecipe.ingredients.map((ingredient, index) => (
                            <li key={index} className="flex items-center gap-3">
                              <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                                {index + 1}
                              </div>
                              <span className="text-sm">
                                <span className="font-medium">{ingredient.amount} {ingredient.unit}</span> {ingredient.name}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3">Instructions</h4>
                        <ol className="space-y-3">
                          {editedRecipe.instructions.map((instruction, index) => (
                            <li key={index} className="flex gap-3">
                              <div className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium flex-shrink-0">
                                {instruction.step}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm">{instruction.description}</p>
                                {instruction.time_min && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {instruction.time_min} minutes
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3">Nutrition</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>Calories: {editedRecipe.nutrition.calories}</div>
                          <div>Protein: {editedRecipe.nutrition.protein}</div>
                          <div>Carbs: {editedRecipe.nutrition.carbs}</div>
                          <div>Fat: {editedRecipe.nutrition.fat}</div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3">Tags</h4>
                        <div className="flex flex-wrap gap-2">
                          {editedRecipe.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
