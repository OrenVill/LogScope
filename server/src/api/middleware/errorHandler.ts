import { Request, Response, NextFunction } from "express";
import { ErrorResponse } from "../../types";

/**
 * Error handling middleware for Express
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("Error:", err);

  // Handle payload too large errors
  if (err.code === "PAYLOAD_TOO_LARGE" || err.status === 413) {
    return res.status(413).json({
      success: false,
      error: "Payload too large. Request body exceeds 1MB limit.",
      errorCode: "PAYLOAD_TOO_LARGE",
    });
  }

  // Handle JSON parsing errors
  if (err.status === 400 && err instanceof SyntaxError) {
    return res.status(400).json({
      success: false,
      error: "Invalid JSON in request body",
      errorCode: "INVALID_JSON",
    });
  }

  const statusCode = err.statusCode || 500;
  const errorCode = err.code || "INTERNAL_SERVER_ERROR";
  const message = err.message || "An unexpected error occurred";

  const response: ErrorResponse = {
    success: false,
    error: message,
    errorCode,
  };

  res.status(statusCode).json(response);
};

