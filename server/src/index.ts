import express, { Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { errorHandler } from "./api/middleware/errorHandler";

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Stub route for Phase 2
app.get("/api/logs", (req, res) => {
  res.json({
    success: true,
    data: [],
    message: "Phase 1: Routes coming in Phase 2",
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
