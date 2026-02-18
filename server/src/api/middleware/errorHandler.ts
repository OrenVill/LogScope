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
