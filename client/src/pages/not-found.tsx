import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CookingPot } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-surface-soft font-sans text-foreground px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-8 size-16 rounded-2xl bg-brand-pink/12 flex items-center justify-center">
          <CookingPot className="size-8 text-brand-pink" />
        </div>
        <p className="caption-label text-muted-foreground">Error 404</p>
        <h1 className="display-md mt-3">This page isn't on the menu.</h1>
        <p className="mt-4 body-lead">
          The page you're looking for doesn't exist or may have moved. Let's get you back to cooking.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Back home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
