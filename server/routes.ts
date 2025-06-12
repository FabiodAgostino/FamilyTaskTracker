import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(app: Express): Promise<Server> {
  // This application uses Firebase as the backend
  // All data operations are handled on the frontend using Firebase SDK
  // No additional API routes are needed as Firebase provides real-time database operations
  
  const httpServer = createServer(app);
  return httpServer;
}
