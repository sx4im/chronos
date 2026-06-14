import * as React from "react";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/apiClient";
import { generateId } from "@/lib/ids";
import { type IngredientChip, type UploadedImage } from "@shared/schema";
import { X, GripVertical, Camera, Search } from "lucide-react";
import { ImageUploader } from "@/components/ImageUploader";
import { Portal } from "@/components/ui/portal";

interface IngredientSuggestion {
  name: string;
  normalized: string;
  commonUnit?: string;
}

interface IngredientsResponse {
  suggestions: IngredientSuggestion[];
}

interface IngredientInputProps {
  initialIngredients?: IngredientChip[];
  onChange: (ingredients: IngredientChip[]) => void;
  placeholder?: string;
  maxItems?: number;
  onOpenImageModal?: () => void;
}

interface SortableChipProps {
  chip: IngredientChip;
  onRemove: (id: string) => void;
}

function SortableChip({ chip, onRemove }: SortableChipProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const displayText = chip.qty && chip.unit 
    ? `${chip.qty} ${chip.unit} ${chip.name}`
    : chip.name;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors min-w-fit max-w-48",
        "bg-primary text-white hover:bg-primary/90",
        isDragging && "opacity-50"
      )}
      data-testid={`ingredient-chip-${chip.name.toLowerCase()}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none hover:cursor-grabbing"
        aria-label={`Drag ${chip.name}`}
      >
        <GripVertical className="size-3" />
      </button>
      <span>{displayText}</span>
      <button
        onClick={() => onRemove(chip.id)}
        className="ml-1 rounded-full hover:bg-white/20 p-0.5"
        aria-label={`Remove ${chip.name}`}
        data-testid={`remove-chip-${chip.name.toLowerCase()}`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

const STORAGE_KEY = "ingredo:search_draft";

// Parse ingredient text into structured format
function parseIngredient(text: string): Omit<IngredientChip, "id"> {
  const trimmed = text.trim();
  
  // Try to match patterns like "2 cups flour", "3 eggs", "1/2 tsp salt"
  const match = trimmed.match(/^(\d+(?:\/\d+)?(?:\.\d+)?)\s*(\w+)?\s+(.+)$/);
  
  if (match) {
    const [, qty, unit, name] = match;
    return {
      name: name.trim(),
      qty: qty.trim(),
      unit: unit?.trim(),
    };
  }
  
  return { name: trimmed };
}

export function IngredientInput({
  initialIngredients = [],
  onChange,
  placeholder = "Add ingredients...",
  maxItems = 50,
  onOpenImageModal,
}: IngredientInputProps) {
  const [ingredients, setIngredients] = useState<IngredientChip[]>(initialIngredients);
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showImageUploader, setShowImageUploader] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && initialIngredients.length === 0) {
        const parsed = JSON.parse(saved) as IngredientChip[];
        setIngredients(parsed);
        onChange(parsed);
      }
    } catch (error) {
      console.warn("Failed to load ingredients from localStorage:", error);
    }
  }, []);

  // Debounce input for API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Fetch suggestions
  const { data: suggestionsData } = useQuery<IngredientsResponse>({
    queryKey: ["/api/ingredients", debouncedQuery],
    queryFn: () => apiClient.get<IngredientsResponse>(`/api/ingredients?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length > 0 && showSuggestions,
    staleTime: 5 * 60 * 1000,
  });

  const suggestions = suggestionsData?.suggestions || [];

  // Save to localStorage and call onChange when ingredients change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ingredients));
      onChange(ingredients);
    } catch (error) {
      console.warn("Failed to save ingredients to localStorage:", error);
    }
  }, [ingredients, onChange]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const addIngredient = useCallback((text: string) => {
    if (!text.trim() || ingredients.length >= maxItems) return;
    
    const parsed = parseIngredient(text);
    const newChip: IngredientChip = {
      id: generateId(),
      ...parsed,
    };
    
    // Check if ingredient already exists
    const exists = ingredients.some(ing => 
      ing.name.toLowerCase() === parsed.name.toLowerCase()
    );
    
    if (!exists) {
      setIngredients(prev => [...prev, newChip]);
    }
    
    setInputValue("");
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  }, [ingredients, maxItems]);

  const removeIngredient = useCallback((id: string) => {
    setIngredients(prev => prev.filter(ing => ing.id !== id));
  }, []);

  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData("text");
    
    // Split by comma or newline and parse each ingredient
    const items = pastedText
      .split(/[,\n]/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
    
    if (items.length > 1) {
      // Multiple items pasted - add them all
      const newIngredients = items
        .slice(0, maxItems - ingredients.length)
        .map(text => ({
          id: generateId(),
          ...parseIngredient(text),
        }))
        .filter(newChip => 
          !ingredients.some(existing => 
            existing.name.toLowerCase() === newChip.name.toLowerCase()
          )
        );
      
      setIngredients(prev => [...prev, ...newIngredients]);
      setInputValue("");
    } else if (items.length === 1) {
      // Single item - just set input value
      setInputValue(items[0]);
    }
  }, [ingredients, maxItems]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
        addIngredient(suggestions[selectedSuggestionIndex].name);
      } else if (inputValue.trim()) {
        addIngredient(inputValue);
      }
    } else if (event.key === "Escape") {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (event.key === "Backspace" && inputValue === "") {
      // Remove last chip when backspace on empty input
      if (ingredients.length > 0) {
        const lastIngredient = ingredients[ingredients.length - 1];
        removeIngredient(lastIngredient.id);
      }
    }
  }, [selectedSuggestionIndex, suggestions, inputValue, addIngredient, ingredients, removeIngredient]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setIngredients(prev => {
        const oldIndex = prev.findIndex(item => item.id === active.id);
        const newIndex = prev.findIndex(item => item.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const handleSuggestionClick = useCallback((suggestion: IngredientSuggestion) => {
    addIngredient(suggestion.name);
  }, [addIngredient]);

  const handleImageUploadComplete = useCallback((uploadedImages: UploadedImage[]) => {
    // Auto-add recognized ingredients from uploaded images
    uploadedImages.forEach(image => {
      if (image.recognized) {
        image.recognized.forEach(ingredient => {
          if (ingredient.confidence > 0.7) { // Only add high-confidence ingredients
            addIngredient(ingredient.name);
          }
        });
      }
    });
  }, [addIngredient]);

  const handleImageAttach = useCallback((_imageId: string, _chipIndex?: number) => {
    // Hook for future per-chip image attachment.
  }, []);

  const openImageModal = useCallback(() => {
    if (onOpenImageModal) {
      onOpenImageModal();
    } else {
      setShowImageUploader(true);
    }
  }, [onOpenImageModal]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="relative flex min-h-[44px] w-full items-center border border-hairline focus-within:border-ink bg-canvas pl-9 pr-3 py-2 text-sm rounded-xl flex-wrap gap-1 transition-colors">
          {/* Search Icon */}
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
          
          {/* Chips */}
          {ingredients.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={ingredients.map(ing => ing.id)}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex flex-wrap gap-1.5 mr-2 max-w-full overflow-hidden">
                  {ingredients.map((chip) => (
                    <SortableChip
                      key={chip.id}
                      chip={chip}
                      onRemove={removeIngredient}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          
          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(e.target.value.length > 0);
              setSelectedSuggestionIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => {
              if (inputValue.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              // Delay hiding suggestions to allow clicking
              setTimeout(() => setShowSuggestions(false), 150);
            }}
            placeholder={ingredients.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[6rem] bg-transparent outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground pl-1 pr-10 text-sm font-medium"
            disabled={ingredients.length >= maxItems}
            aria-label="Add ingredients"
            data-testid="ingredient-input"
          />
          
          {/* Add Photo Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disableMotion
            onClick={openImageModal}
            className="absolute right-2 top-1/2 -translate-y-1/2 size-8 shrink-0 rounded-lg p-0 text-muted-foreground hover:text-ink hover:bg-surface-card"
            aria-label="Add photo"
            data-testid="add-photo-button"
          >
            <Camera className="size-4" />
          </Button>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <Portal>
            <div
              ref={suggestionsRef}
              className="fixed z-[10001] w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto"
              role="listbox"
              style={{
                left: inputRef.current?.getBoundingClientRect().left || 0,
                top: (inputRef.current?.getBoundingClientRect().bottom || 0) + 4,
                width: inputRef.current?.getBoundingClientRect().width || 'auto'
              }}
            >
            {suggestions.slice(0, 8).map((suggestion, index) => (
              <button
                key={suggestion.name}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                  selectedSuggestionIndex === index && "bg-accent text-accent-foreground"
                )}
                role="option"
                aria-selected={selectedSuggestionIndex === index}
                data-testid={`suggestion-${suggestion.name.toLowerCase()}`}
              >
                <div className="flex justify-between items-center">
                  <span>{suggestion.name}</span>
                  {suggestion.commonUnit && (
                    <Badge variant="secondary" className="text-xs">
                      {suggestion.commonUnit}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
            </div>
          </Portal>
        )}
      </div>

      {/* Helper text */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {ingredients.length === 0 
            ? "Add at least 5 ingredients to generate recipes"
            : ingredients.length < 5
            ? `${ingredients.length}/${maxItems} ingredients, need ${5 - ingredients.length} more to search`
            : `${ingredients.length}/${maxItems} ingredients`
          }
        </span>
        <span>Press Enter to add • Drag to reorder</span>
      </div>

      {/* Image Upload Modal */}
      {showImageUploader && (
        <Portal>
          <div className="fixed inset-0 z-[10000] bg-background/80 backdrop-blur-sm">
            <div className="fixed left-[50%] top-[50%] z-[10000] grid w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Upload ingredient photos</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowImageUploader(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <ImageUploader
                maxImages={3}
                maxSizeMB={5}
                onUploadComplete={handleImageUploadComplete}
                onAttach={handleImageAttach}
                autoDetect={true}
              />
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
