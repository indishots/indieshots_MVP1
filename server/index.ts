import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);
  
  // Start background cleanup job for scheduled account deletions
  const { startCleanupJob } = await import('./jobs/cleanup-scheduled-deletions');
  startCleanupJob();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Add health check endpoint for Cloud Run
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Port configuration for both Replit and Cloud Run
  const port = process.env.PORT || 5000;
  
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
    
    // Environment-specific logging
    if (process.env.NODE_ENV === 'production' && process.env.K_SERVICE) {
      // Cloud Run environment
      log(`Cloud Run service: ${process.env.K_SERVICE}`);
      log(`Cloud Run revision: ${process.env.K_REVISION}`);
    } else if (process.env.REPL_SLUG) {
      // Replit environment
      log(`External access: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.replit.app`);
    }
    
    log(`Local access: http://localhost:${port}`);
    log(`Server bound to all interfaces (0.0.0.0:${port})`);
  });
})();
