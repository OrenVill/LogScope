import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * Read the configured API key from the environment.
 * Returns undefined when no key is set (auth disabled).
 */
export function getConfiguredApiKey(): string | undefined {
  const key = process.env.API_KEY;
  return key && key.trim().length > 0 ? key.trim() : undefined;
}

/**
 * Constant-time comparison of two strings to prevent timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against itself to keep constant time, then return false
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Express middleware that enforces API key authentication.
 * When API_KEY env var is set, every request must include a matching
 * `X-API-Key` header. When API_KEY is not configured, the middleware
 * is a passthrough.
 */
export const apiKeyAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const configuredKey = getConfiguredApiKey();

  // No key configured → auth disabled, pass through
  if (!configuredKey) {
    return next();
  }

  const providedKey = req.header("X-API-Key");

  if (!providedKey) {
    return res.status(401).json({
      success: false,
      error: "Missing API key. Provide it via the X-API-Key header.",
      errorCode: "UNAUTHORIZED",
    });
  }

  if (!safeCompare(providedKey, configuredKey)) {
    return res.status(401).json({
      success: false,
      error: "Invalid API key.",
      errorCode: "UNAUTHORIZED",
    });
  }

  next();
};
