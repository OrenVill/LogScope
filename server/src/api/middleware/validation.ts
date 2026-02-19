import { Request, Response, NextFunction } from "express";

/**
 * Rate limiter for log collection endpoint
 * Limits: 100 requests per minute per IP
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per window

export const rateLimitMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const clientIp = req.ip || "unknown";
  const now = Date.now();

  let limiter = rateLimitStore.get(clientIp);

  // Clean up old entries
  if (!limiter || now > limiter.resetTime) {
    limiter = { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
    rateLimitStore.set(clientIp, limiter);
  }

  limiter.count++;

  // Set rate limit headers
  res.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, RATE_LIMIT_MAX - limiter.count));
  res.setHeader("X-RateLimit-Reset", Math.ceil(limiter.resetTime / 1000));

  // Check if limit exceeded
  if (limiter.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      success: false,
      error: "Too many requests. Rate limit exceeded.",
      errorCode: "RATE_LIMIT_EXCEEDED",
    });
  }

  next();
};

/**
 * Input validation for log collection endpoint
 */
export const validateLogEntry = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { timestamp, level, subject, source } = req.body;

  // Validate timestamp format (ISO 8601)
  if (!timestamp || typeof timestamp !== "string") {
    return res.status(400).json({
      success: false,
      error: "Invalid or missing timestamp. Must be ISO 8601 format.",
      errorCode: "INVALID_TIMESTAMP",
    });
  }

  if (isNaN(new Date(timestamp).getTime())) {
    return res.status(400).json({
      success: false,
      error: "Timestamp is not a valid ISO 8601 date.",
      errorCode: "INVALID_TIMESTAMP",
    });
  }

  // Validate log level
  const validLevels = ["debug", "info", "warn", "error", "success"];
  if (!level || !validLevels.includes(level)) {
    return res.status(400).json({
      success: false,
      error: `Invalid log level. Must be one of: ${validLevels.join(", ")}`,
      errorCode: "INVALID_LEVEL",
    });
  }

  // Validate subject
  if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Subject is required and must be a non-empty string.",
      errorCode: "INVALID_SUBJECT",
    });
  }

  if (subject.length > 255) {
    return res.status(400).json({
      success: false,
      error: "Subject cannot exceed 255 characters.",
      errorCode: "SUBJECT_TOO_LONG",
    });
  }

  // Validate source
  if (!source || typeof source !== "object") {
    return res.status(400).json({
      success: false,
      error: "Source is required and must be an object.",
      errorCode: "INVALID_SOURCE",
    });
  }

  const { runtime } = source;
  if (!runtime || !["node", "browser"].includes(runtime)) {
    return res.status(400).json({
      success: false,
      error: "Source.runtime is required and must be 'node' or 'browser'.",
      errorCode: "INVALID_RUNTIME",
    });
  }

  // Validate content size (log content should not exceed 10KB)
  const contentStr = JSON.stringify(req.body.content || "");
  if (contentStr.length > 10240) {
    return res.status(413).json({
      success: false,
      error: "Log content exceeds maximum size of 10KB.",
      errorCode: "CONTENT_TOO_LARGE",
    });
  }

  next();
};

/**
 * Validate search/filter parameters
 */
export const validateSearchParams = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { timeFrom, timeTo, limit, offset } = req.query;

  // Validate time ranges if provided
  if (timeFrom && isNaN(new Date(timeFrom as string).getTime())) {
    return res.status(400).json({
      success: false,
      error: "Invalid timeFrom parameter. Must be ISO 8601 format.",
      errorCode: "INVALID_TIME_RANGE",
    });
  }

  if (timeTo && isNaN(new Date(timeTo as string).getTime())) {
    return res.status(400).json({
      success: false,
      error: "Invalid timeTo parameter. Must be ISO 8601 format.",
      errorCode: "INVALID_TIME_RANGE",
    });
  }

  // Validate pagination
  if (limit) {
    const parsedLimit = parseInt(limit as string);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      return res.status(400).json({
        success: false,
        error: "Limit must be a number between 1 and 1000.",
        errorCode: "INVALID_LIMIT",
      });
    }
  }

  if (offset) {
    const parsedOffset = parseInt(offset as string);
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({
        success: false,
        error: "Offset must be a non-negative number.",
        errorCode: "INVALID_OFFSET",
      });
    }
  }

  next();
};
