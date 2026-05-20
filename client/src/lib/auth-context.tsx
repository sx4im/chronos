import * as React from "react";
import { Link } from "wouter";
import { AppLoader } from "@/components/ui/app-loader";
import { useAppStore, User } from "./store";
import { csrfFetch } from "./apiClient";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (name: string, username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const user = useAppStore((state) => state.user);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const setUser = useAppStore((state) => state.setUser);
  const storeLogout = useAppStore((state) => state.logout);
  const [isLoading, setIsLoading] = React.useState(true);

  // Mock authentication functions - replace with real API calls
  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await csrfFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Login failed');
      }
      const user = await res.json();
      setUser(user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, username: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await csrfFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Registration failed');
      }
      const user = await res.json();
      setUser(user);
    } finally {
      setIsLoading(false);
    }
  };



  const logout = async () => {
    try {
      await csrfFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    storeLogout();
  };

  // Fetch auth status on mount
  React.useEffect(() => {
    const fetchMe = async () => {
      setIsLoading(true);
      try {
        const res = await csrfFetch('/api/auth/me');
        if (res.ok) {
          const user = await res.json();
          setUser(user);
        } else {
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchMe();
  }, []);

  const value = React.useMemo(() => ({
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
  }), [user, isAuthenticated, isLoading, setUser, storeLogout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireRole?: 'admin';
}

export function ProtectedRoute({ children, fallback, requireRole }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AppLoader className="min-h-screen" label="Checking account" />;
  }

  if (!isAuthenticated || (requireRole === 'admin' && user?.role !== 'admin')) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">{!isAuthenticated ? "Authentication Required" : "Unauthorized"}</h2>
          <p className="text-gray-600">{!isAuthenticated ? "Please log in to access this page." : "You do not have permission to access this page."}</p>
          {!isAuthenticated && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link
                href="/auth/signup"
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Create account
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
