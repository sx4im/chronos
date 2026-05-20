import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import { doubleCsrf } from "csrf-csrf";
import passport from "passport";
import { pool } from "./db";

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required");
}
const sessionSecret = SESSION_SECRET;

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
if (!ADMIN_API_KEY) {
  throw new Error("ADMIN_API_KEY is required");
}

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => sessionSecret,
  getSessionIdentifier: (req) => req.sessionID ?? "",
  cookieName: "x-csrf-token",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
});

const defaultJsonParser = express.json({ limit: "100kb" });
const largeImageJsonPath = "/api/ingredients/extract";
const isProduction = process.env.NODE_ENV === "production";

function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  if (
    ["GET", "HEAD", "OPTIONS"].includes(req.method) ||
    req.path === "/api/csrf-token" ||
    req.path === "/api/health"
  ) {
    return next();
  }

  return doubleCsrfProtection(req, res, next);
}

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://mock-storage.example.com"],
          scriptSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'", "https://replit.com"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: isProduction ? ["'self'"] : ["'self'", "ws:", "http://localhost:*", "http://127.0.0.1:*"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
    }),
  );
  app.use((req, res, next) => {
    if (req.path === largeImageJsonPath) {
      return next();
    }
    return defaultJsonParser(req, res, next);
  });
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));

  const PgSession = connectPgSimple(session);
  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: "user_sessions",
        createTableIfMissing: false,
      }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  app.get("/api/csrf-token", (req, res) => {
    res.json({ token: generateCsrfToken(req, res) });
  });

  app.use(csrfMiddleware);

  return app;
}
