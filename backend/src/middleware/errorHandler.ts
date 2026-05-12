// ============================================================
// LocoSnap — Error Handling Middleware
// ============================================================

import { Request, Response, NextFunction } from "express";
import { captureServerError } from "../services/analytics";

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Upstream-overload errors from Anthropic/OpenAI SDKs surface as HTTP 529 / 503
// with "overloaded_error" / "Overloaded" in the body. These are capacity issues
// on the provider side, not our bugs — return 503 to the client and skip Sentry.
function isUpstreamOverload(err: Error & { status?: number; statusCode?: number }): boolean {
  const upstreamStatus = err.status ?? err.statusCode;
  if (upstreamStatus === 529) return true;
  const msg = (err.message || "").toLowerCase();
  return msg.includes("overloaded_error") || msg.includes('"overloaded"');
}

export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const upstreamOverloaded = isUpstreamOverload(err as Error & { status?: number; statusCode?: number });
  const statusCode = upstreamOverloaded
    ? 503
    : "statusCode" in err
      ? err.statusCode
      : 500;
  const message = upstreamOverloaded
    ? "The AI service is temporarily busy. Please try again in a moment."
    : err.message || "Internal server error";

  console.error(`[ERROR] ${statusCode}: ${message}`);
  if (statusCode === 500) {
    console.error(err.stack);
    captureServerError(err, { statusCode, message });
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
}
