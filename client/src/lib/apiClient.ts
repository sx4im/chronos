import { toast } from "@/hooks/use-toast";

class APIError extends Error {
  status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.name = "APIError";
    this.status = status;
  }
}

async function handleResponse(response: Response) {
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    
    // Handle 401 globally - redirect to login
    if (response.status === 401) {
      toast({
        title: "Authentication required",
        description: "Please log in to continue.",
        variant: "destructive",
      });
      // In a real app, you might redirect to login page
      window.location.href = "/login";
      throw new APIError("Authentication required", 401);
    }
    
    throw new APIError(text || response.statusText, response.status);
  }
  
  return response;
}

let cachedCsrfToken: string | null = null;
async function getCsrfToken() {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const response = await fetch('/api/csrf-token', { credentials: "include" });
    const data = await response.json();
    cachedCsrfToken = data.token;
    return cachedCsrfToken;
  } catch (error) {
    console.error('Failed to fetch CSRF token', error);
    return null;
  }
}

async function getJsonHeaders(url: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (url !== "/api/csrf-token" && url !== "/api/health") {
    const token = await getCsrfToken();
    if (token) headers["x-csrf-token"] = token;
  }
  return headers;
}

export async function csrfFetch(url: string, init: RequestInit = {}) {
  const method = init.method?.toUpperCase() ?? "GET";
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && url !== "/api/csrf-token" && url !== "/api/health") {
    const token = await getCsrfToken();
    if (token) headers.set("x-csrf-token", token);
  }

  return fetch(url, {
    ...init,
    method,
    headers,
    credentials: "include",
  });
}

const realClient = {
  async get<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });
    
    await handleResponse(response);
    return response.json();
  },

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: await getJsonHeaders(url),
      credentials: "include",
      body: data ? JSON.stringify(data) : undefined,
    });
    
    await handleResponse(response);
    return response.json();
  },

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "PUT",
      headers: await getJsonHeaders(url),
      credentials: "include",
      body: data ? JSON.stringify(data) : undefined,
    });
    
    await handleResponse(response);
    return response.json();
  },

  async patch<T>(url: string, data?: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "PATCH",
      headers: await getJsonHeaders(url),
      credentials: "include",
      body: data ? JSON.stringify(data) : undefined,
    });
    
    await handleResponse(response);
    return response.json();
  },

  async delete<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: "DELETE",
      headers: await getJsonHeaders(url),
      credentials: "include",
    });
    
    await handleResponse(response);
    return response.json();
  },
} as const;

export const apiClient = realClient;

export { APIError };
