import { type NextFunction, type Request, type Response } from "express";
import { registerRoutes } from "../server/routes";
import { createApp } from "../server/createApp";

const app = createApp();

let initialized = false;
let initPromise: Promise<void> | null = null;

async function ensureInitialized() {
  if (initialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      await registerRoutes(app);
      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message =
          status >= 500 && process.env.NODE_ENV === "production"
            ? "Internal Server Error"
            : err.message || "Internal Server Error";

        res.status(status).json({ status, message });
      });
      initialized = true;
    })();
  }
  await initPromise;
}

export default async function handler(req: Request, res: Response) {
  await ensureInitialized();
  return app(req, res);
}
