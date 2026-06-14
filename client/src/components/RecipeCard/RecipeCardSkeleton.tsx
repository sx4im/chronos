import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface RecipeCardSkeletonProps {
  className?: string;
}

function PulseLine({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md bg-foreground/5 animate-pulse",
        className
      )}
    />
  );
}

export function RecipeCardSkeleton({ className }: RecipeCardSkeletonProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="aspect-[16/10] bg-foreground/5 animate-pulse" />
      <CardContent className="p-5">
        {/* Title placeholder */}
        <div className="mb-3">
          <PulseLine className="h-5 w-3/4 mb-2" />
          <PulseLine className="h-4 w-full mb-1" />
          <PulseLine className="h-4 w-2/3" />
        </div>

        {/* Meta information placeholder */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <PulseLine className="h-4 w-12" />
            <PulseLine className="h-4 w-8" />
            <PulseLine className="h-4 w-10" />
          </div>
          <PulseLine className="h-5 w-16" />
        </div>

        {/* Tags placeholder */}
        <div className="flex gap-1 mb-3">
          <PulseLine className="h-5 w-16" />
          <PulseLine className="h-5 w-20" />
          <PulseLine className="h-5 w-14" />
        </div>

        {/* Actions placeholder */}
        <div className="flex items-center justify-between">
          <PulseLine className="h-8 w-24" />
          <PulseLine className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

export function RecipeCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-3 py-8">
        <Loader2 className="size-6 animate-spin text-foreground/40" />
        <span className="text-muted-foreground font-medium">Finding recipes for your ingredients...</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: count }).map((_, i) => (
          <RecipeCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
