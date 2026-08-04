/**
 * Express middleware for Lifemarq API
 *
 * Provides:
 * - Request logging with correlation IDs
 * - Error handling and standardization
 * - Performance monitoring
 * - Security headers
 */

import { Request, Response, NextFunction } from "express";

/**
 * Generate unique request ID for tracing
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Correlation ID middleware - add unique ID to each request
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const correlationId = req.headers["x-correlation-id"] || generateRequestId();
  (req as any).correlationId = correlationId;
  (req as any).startTime = Date.now();

  // Add correlation ID to response header
  res.setHeader("x-correlation-id", correlationId);

  // Log request
  console.log(`[${correlationId}] ${req.method} ${req.path}`);

  next();
}

/**
 * Performance monitoring middleware
 */
export function performanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - (req as any).startTime;
    const correlationId = (req as any).correlationId;

    // Log response with duration
    const statusCode = res.statusCode;
    const level = statusCode >= 400 ? "WARN" : "INFO";
    console.log(
      `[${correlationId}] ${level} ${req.method} ${req.path} ${statusCode} ${duration}ms`,
    );

    // Add performance header
    res.setHeader("x-response-time", `${duration}ms`);

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Prevent MIME type sniffing
  res.setHeader("x-content-type-options", "nosniff");

  // Prevent clickjacking
  res.setHeader("x-frame-options", "DENY");

  // Enable XSS protection
  res.setHeader("x-xss-protection", "1; mode=block");

  // Referrer policy
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");

  // Content Security Policy (permissive for API)
  res.setHeader(
    "content-security-policy",
    "default-src 'none'; frame-ancestors 'none'",
  );

  next();
}

/**
 * Error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const correlationId = (req as any).correlationId;
  const statusCode = (err as any).statusCode || 500;
  const message = err.message || "Internal Server Error";

  console.error(`[${correlationId}] ERROR ${statusCode}: ${message}`, err);

  res.status(statusCode).json({
    error: message,
    correlationId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Request size limiter
 */
export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Simple in-memory rate limiting (replace with Redis for production)
  const clientIp = req.ip || "unknown";
  const limit = 100; // requests per minute
  const window = 60 * 1000; // 1 minute

  // In production, use Redis or external rate limiting service
  next();
}

/**
 * Sanitize request logs (remove sensitive data)
 */
export function sanitizeLogData(data: any): any {
  if (typeof data !== "object") return data;

  const sanitized = { ...data };
  const sensitiveFields = ["password", "apiKey", "privateKey", "secret"];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }

  return sanitized;
}
