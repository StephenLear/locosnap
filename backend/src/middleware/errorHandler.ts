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

export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = "statusCode" in err ? err.statusCode : 500;
  const message = err.message || "Internal server error";

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
