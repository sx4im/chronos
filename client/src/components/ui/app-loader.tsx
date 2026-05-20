import { cn } from "@/lib/utils";

interface AppLoaderProps {
  className?: string;
  label?: string;
}

export function AppLoader({ className, label = "Loading" }: AppLoaderProps) {
  return (
    <div className={cn("flex min-h-[50vh] w-full items-center justify-center", className)}>
      <img
        src="/Pizza.gif"
        alt=""
        className="size-32 sm:size-40"
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
