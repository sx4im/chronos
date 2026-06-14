import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  className?: string;
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action, 
  className 
}: EmptyStateProps) {
  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-8 text-center">
        <div className="text-muted-foreground mb-4">
          {icon}
        </div>
        <h3 className="title-md mb-2 text-center">{title}</h3>
        <p className="text-muted-foreground mb-4 max-w-md mx-auto">{description}</p>
        {action && (
          <Button
            onClick={action.onClick}
            disabled={action.disabled}
            className="mt-2"
            data-testid="empty-state-action"
          >
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface EmptyStateIconProps {
  className?: string;
}

export function EmptyStateIcon({ className }: EmptyStateIconProps) {
  return (
    <div className={cn("mx-auto size-12 opacity-50", className)}>
      <svg
        className="h-full w-full"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.709M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    </div>
  );
}
