import { Switch, Route, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { AppShell } from "@/components/app-shell";
import { AuthProvider, ProtectedRoute } from "@/lib/auth-context";
import { Analytics } from "@vercel/analytics/react";
import { LazyMotion, domAnimation } from "framer-motion";

import { lazy, Suspense } from "react";
import { AppLoader } from "@/components/ui/app-loader";

// Lazy-loaded Pages
const Home = lazy(() => import("@/pages/home"));
const Search = lazy(() => import("@/pages/search"));
const Recipe = lazy(() => import("@/pages/recipe"));
const Profile = lazy(() => import("@/pages/profile"));
const Admin = lazy(() => import("@/pages/admin"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Pantry = lazy(() => import("@/pages/pantry"));
const Shopping = lazy(() => import("@/pages/shopping"));
const Favorites = lazy(() => import("@/pages/favorites"));
const Settings = lazy(() => import("@/pages/settings"));

// Lazy-loaded Auth Pages
const Login = lazy(() => import("@/pages/auth/login"));
const Signup = lazy(() => import("@/pages/auth/signup"));

function AppRouter() {
  return (
    <Suspense 
      fallback={<AppLoader />}
    >
      <Switch>
          {/* Public Routes */}
          <Route path="/" component={Home} />
          <Route path="/search" component={Search} />
          <Route path="/recipe/:slug" component={Recipe} />
          
          {/* Auth Routes */}
          <Route path="/auth/login" component={Login} />
          <Route path="/auth/signup" component={Signup} />
          
          {/* Protected Routes */}
          <Route path="/dashboard"><ProtectedRoute><Dashboard /></ProtectedRoute></Route>
          <Route path="/pantry"><ProtectedRoute><Pantry /></ProtectedRoute></Route>
          <Route path="/shopping"><ProtectedRoute><Shopping /></ProtectedRoute></Route>
          <Route path="/favorites"><ProtectedRoute><Favorites /></ProtectedRoute></Route>
          <Route path="/settings"><ProtectedRoute><Settings /></ProtectedRoute></Route>
          <Route path="/profile"><ProtectedRoute><Profile /></ProtectedRoute></Route>
          <Route path="/admin"><ProtectedRoute requireRole="admin"><Admin /></ProtectedRoute></Route>
          
        {/* 404 */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Router>
              <LazyMotion features={domAnimation}>
                <AppShell>
                  <AppRouter />
                </AppShell>
              </LazyMotion>
              <Toaster />
              <Analytics />
            </Router>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
