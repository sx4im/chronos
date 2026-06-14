import * as React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { Menu, User, Heart, Settings, LogOut, X, Package, ShoppingCart } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-semibold tracking-[-0.03em] text-ink", className)}>
      Ingredo<span className="text-brand-pink">.</span>
    </span>
  );
}

export function AppShell({ children }: AppShellProps) {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isLoading, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navigation = [
    { name: "Discover", href: "/", current: location === "/" },
    { name: "Search", href: "/search", current: location === "/search" },
    { name: "Dashboard", href: "/dashboard", current: location === "/dashboard" },
    { name: "Pantry", href: "/pantry", current: location === "/pantry" },
    { name: "Shopping", href: "/shopping", current: location === "/shopping" },
    { name: "Favorites", href: "/favorites", current: location === "/favorites" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-canvas font-sans text-foreground">
      {/* ─── Desktop Top Nav — cream bar, 64px ─── */}
      <div className="w-full sticky top-0 z-50 lg:block hidden">
        <header className="w-full h-16 bg-canvas/90 backdrop-blur-md border-b border-hairline">
          <div className="max-w-[1280px] mx-auto px-8 h-full">
            <div className="flex items-center justify-between h-full">
              {/* Logo */}
              <Link
                href="/"
                className={cn("flex items-center transition-opacity hover:opacity-70 rounded-sm", FOCUS_RING)}
                data-testid="logo-link"
              >
                <Wordmark className="text-[22px]" />
              </Link>

              {/* Center Navigation */}
              <nav className="flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                      item.current
                        ? "bg-surface-card text-ink"
                        : "text-muted-foreground hover:text-ink",
                      FOCUS_RING
                    )}
                    data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>

              {/* Right Actions */}
              <div className="flex items-center gap-2">
                {!isLoading && !isAuthenticated ? (
                  <>
                    <Button variant="ghost" asChild>
                      <Link href="/auth/login" data-testid="desktop-login-link">
                        Sign in
                      </Link>
                    </Button>
                    <Button asChild>
                      <Link href="/auth/signup" data-testid="desktop-signup-link">
                        Try free
                      </Link>
                    </Button>
                  </>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid="profile-menu"
                        className="size-11 rounded-full p-0 hover:bg-surface-card"
                      >
                        <Avatar className="size-9">
                          <AvatarFallback className="bg-primary text-on-primary text-sm rounded-full">
                            <User className="size-5" />
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={12} className="rounded-2xl">
                      <DropdownMenuItem asChild>
                        <Link href="/profile" data-testid="menu-profile">
                          <User className="mr-2 size-4" />
                          Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/favorites" data-testid="menu-favorites">
                          <Heart className="mr-2 size-4" />
                          Favorites
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/settings" data-testid="menu-settings">
                          <Settings className="mr-2 size-4" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/pantry" data-testid="menu-pantry">
                          <Package className="mr-2 size-4" />
                          Pantry
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/shopping" data-testid="menu-shopping">
                          <ShoppingCart className="mr-2 size-4" />
                          Shopping List
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        data-testid="menu-logout"
                        onClick={() => {
                          logout();
                          setLocation("/");
                        }}
                      >
                        <LogOut className="mr-2 size-4" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* ─── Mobile Logo + Menu ─── */}
      <div className="lg:hidden fixed top-4 left-4 sm:top-5 sm:left-6 z-50 flex items-center">
        <Link href="/" className={cn("flex items-center rounded-sm", FOCUS_RING)}>
          <Wordmark className="text-2xl" />
        </Link>
      </div>

      <div className="lg:hidden fixed top-3 right-4 sm:top-4 sm:right-6 z-50 flex items-center">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          {!isMobileMenuOpen && (
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 bg-canvas/90 text-ink border border-hairline backdrop-blur-sm hover:bg-surface-card"
                data-testid="mobile-menu-toggle"
              >
                <Menu className="size-6" />
              </Button>
            </SheetTrigger>
          )}
          <SheetContent side="right" className="w-[88vw] max-w-80 bg-canvas border-l border-hairline [&>button]:hidden">
            <div className="flex flex-col h-full">
              {/* Mobile Header */}
              <div className="flex items-center justify-between mb-8 mt-2">
                <Wordmark className="text-2xl" />
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn("p-2 hover:bg-surface-card rounded-full transition-colors", FOCUS_RING)}
                  aria-label="Close menu"
                >
                  <X className="size-6 text-ink" />
                </button>
              </div>

              {/* Mobile Navigation */}
              <div className="flex-1">
                <nav className="space-y-1">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center px-5 py-3.5 text-lg font-medium transition-colors rounded-xl",
                        item.current
                          ? "bg-surface-card text-ink"
                          : "text-muted-foreground hover:bg-surface-soft hover:text-ink",
                        FOCUS_RING
                      )}
                      data-testid={`mobile-nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  ))}
                </nav>

                {/* Mobile Profile Section */}
                <div className="mt-8 pt-8 border-t border-hairline">
                  {!isLoading && !isAuthenticated ? (
                    <div className="space-y-3">
                      <Button asChild className="w-full">
                        <Link href="/auth/signup" onClick={() => setIsMobileMenuOpen(false)}>
                          Try free
                        </Link>
                      </Button>
                      <Button variant="outline" asChild className="w-full">
                        <Link href="/auth/login" onClick={() => setIsMobileMenuOpen(false)}>
                          Sign in
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Link
                        href="/profile"
                        className={cn("flex items-center px-4 py-3 text-lg font-medium text-ink hover:bg-surface-card rounded-xl transition-colors", FOCUS_RING)}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <User className="mr-3 size-5" />
                        Profile
                      </Link>
                      <Link
                        href="/settings"
                        className={cn("flex items-center px-4 py-3 text-lg font-medium text-ink hover:bg-surface-card rounded-xl transition-colors", FOCUS_RING)}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Settings className="mr-3 size-5" />
                        Settings
                      </Link>
                      <button
                        className={cn("flex items-center px-4 py-3 text-lg font-medium text-ink hover:bg-surface-card rounded-xl w-full text-left transition-colors", FOCUS_RING)}
                        onClick={() => {
                          logout();
                          setIsMobileMenuOpen(false);
                          setLocation("/");
                        }}
                      >
                        <LogOut className="mr-3 size-5" />
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        {children}
      </main>

      {/* ─── Footer — cream-tinted (Clay closes warm, never dark) ─── */}
      <footer className="relative bg-surface-soft border-t border-hairline overflow-hidden pt-20 pb-8">
        <div className="max-w-[1280px] mx-auto px-6 sm:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-16 mb-16">

            {/* Brand */}
            <div className="lg:col-span-5">
              <Link href="/" className="inline-block mb-5">
                <Wordmark className="text-3xl" />
              </Link>
              <p className="text-body-text text-base leading-relaxed mb-8 max-w-sm">
                Culinary intelligence for the modern home chef. Turn the ingredients you already
                have into extraordinary, zero-waste meals.
              </p>

              {/* Social Icons */}
              <div className="flex items-center gap-3">
                {[
                  { name: 'Twitter', icon: 'M6.29 18.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0020 3.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.073 4.073 0 01.8 7.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407a11.616 11.616 0 006.29 1.84', href: 'https://twitter.com/sx4im' },
                  { name: 'GitHub', icon: 'M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z', href: 'https://github.com/sx4im' },
                  { name: 'LinkedIn', icon: 'M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z', href: 'https://linkedin.com/in/sx4im' },
                  { name: 'Instagram', icon: 'M12.017 0H7.983C3.582 0 0 3.582 0 7.983v4.034C0 16.418 3.582 20 7.983 20h4.034C16.418 20 20 16.418 20 12.017V7.983C20 3.582 16.418 0 12.017 0zM10 13.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7zm6.5-6.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z', href: 'https://instagram.com/sx4im' }
                ].map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn("size-10 rounded-full border border-hairline bg-canvas flex items-center justify-center text-muted-foreground transition-colors hover:bg-ink hover:text-on-primary hover:border-ink", FOCUS_RING)}
                  >
                    <span className="sr-only">{social.name}</span>
                    <svg className="size-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d={social.icon} clipRule="evenodd" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Product */}
            <div className="lg:col-span-2">
              <h4 className="caption-label text-muted-foreground mb-6">Product</h4>
              <ul className="space-y-3">
                <li><Link href="/" className={cn("text-muted-foreground hover:text-ink transition-colors text-sm rounded-sm", FOCUS_RING)}>Features</Link></li>
                <li><Link href="/search" className={cn("text-muted-foreground hover:text-ink transition-colors text-sm rounded-sm", FOCUS_RING)}>How It Works</Link></li>
                <li><Link href="/pantry" className={cn("text-muted-foreground hover:text-ink transition-colors text-sm rounded-sm", FOCUS_RING)}>Pantry Manager</Link></li>
                <li><Link href="/search" className={cn("text-muted-foreground hover:text-ink transition-colors text-sm rounded-sm", FOCUS_RING)}>Recipe Search</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div className="lg:col-span-2">
              <h4 className="caption-label text-muted-foreground mb-6">Company</h4>
              <ul className="space-y-3">
                <li><button type="button" className="appearance-none bg-transparent border-0 p-0 text-left font-[inherit] cursor-pointer text-muted-foreground hover:text-ink transition-colors text-sm">About</button></li>
                <li><button type="button" className="appearance-none bg-transparent border-0 p-0 text-left font-[inherit] cursor-pointer text-muted-foreground hover:text-ink transition-colors text-sm">Blog</button></li>
                <li><button type="button" className="appearance-none bg-transparent border-0 p-0 text-left font-[inherit] cursor-pointer text-muted-foreground hover:text-ink transition-colors text-sm">Careers</button></li>
                <li><button type="button" className="appearance-none bg-transparent border-0 p-0 text-left font-[inherit] cursor-pointer text-muted-foreground hover:text-ink transition-colors text-sm">Contact</button></li>
              </ul>
            </div>

            {/* Legal */}
            <div className="lg:col-span-3">
              <h4 className="caption-label text-muted-foreground mb-6">Legal</h4>
              <ul className="space-y-3">
                <li><button type="button" className="appearance-none bg-transparent border-0 p-0 text-left font-[inherit] cursor-pointer text-muted-foreground hover:text-ink transition-colors text-sm">Privacy Policy</button></li>
                <li><button type="button" className="appearance-none bg-transparent border-0 p-0 text-left font-[inherit] cursor-pointer text-muted-foreground hover:text-ink transition-colors text-sm">Terms of Service</button></li>
                <li><button type="button" className="appearance-none bg-transparent border-0 p-0 text-left font-[inherit] cursor-pointer text-muted-foreground hover:text-ink transition-colors text-sm">Cookie Policy</button></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-hairline flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 Ingredo. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground">
              Crafted by <a href="https://saimshafique.com/" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:text-brand-pink transition-colors underline underline-offset-4 decoration-hairline">Saim Shafique</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
