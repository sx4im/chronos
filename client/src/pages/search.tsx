import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { Card, CardContent } from "@/components/ui/card";
import { IngredientInput } from "@/components/IngredientInput";
import { PreferencesPanel } from "@/components/PreferencesPanel";
import { SearchResults } from "@/components/SearchResults";
import { type IngredientChip, type SearchFilters } from "@shared/schema";
import { Search as SearchIcon } from "lucide-react";

export default function Search() {
  const [selectedIngredients, setSelectedIngredients] = React.useState<IngredientChip[]>([]);
  const [searchFilters, setSearchFilters] = React.useState<SearchFilters>(() => {
    // Initialize with default filters
    return {
      diet: "any",
      allergies: [],
      maxCookTime: 60,
      cuisine: undefined,
      difficulty: "any",
      allowSubstitutions: true,
      servings: 4
    };
  });

  const handleIngredientsChange = (newIngredients: IngredientChip[]) => {
    setSelectedIngredients(newIngredients);
  };

  const handleFiltersChange = (filters: SearchFilters) => {
    setSearchFilters(filters);
  };

  return (
    <div className="relative min-h-screen bg-grain bg-background font-sans text-foreground py-10 sm:py-12">
      <div className="container mx-auto px-5 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
        >
          <div className="text-left mb-12">
            <span className="caption-label text-muted-foreground">Recipe search</span>
            <h1 className="display-lg mt-4 mb-4">Find recipes</h1>
            <p className="body-lead max-w-xl">
              Add the ingredients you have and discover delicious recipes you can make right now.
            </p>
          </div>
        </motion.div>

        {/* Ingredient Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
        >
          <Card className="mb-8">
            <CardContent className="p-6" >
              <IngredientInput
                initialIngredients={selectedIngredients}
                onChange={handleIngredientsChange}
                placeholder="Search ingredients..."
                maxItems={15}
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
        >
          <div className="mb-8">
            <PreferencesPanel onFiltersChange={handleFiltersChange} />
          </div>
        </motion.div>

        {/* Search Results */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
        >
          <SearchResults
            ingredients={selectedIngredients.map(ing => ing.name)}
            filters={searchFilters}
          />
        </motion.div>
              </div>
      </div>
    </div>
  );
}
