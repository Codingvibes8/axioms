import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Standardized API error response format
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * Standardized API success response format
 */
export interface ApiSuccessResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: string,
  code?: string,
  details?: unknown,
  status: number = 400
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { error, code, details },
    { status }
  );
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    { data, meta },
    { status }
  );
}

/**
 * Handles Zod validation errors
 */
export function handleZodError(error: z.ZodError): NextResponse<ApiErrorResponse> {
  return createErrorResponse(
    "Validation failed",
    "VALIDATION_ERROR",
    error.format(),
    400
  );
}

/**
 * Handles unknown errors safely (no stack traces)
 */
export function handleUnknownError(error: unknown, fallbackMessage = "Internal server error"): NextResponse<ApiErrorResponse> {
  console.error("API Error:", error);

  if (error instanceof Error) {
    // Don't expose internal error details in production
    if (process.env.NODE_ENV === "production") {
      return createErrorResponse(fallbackMessage, "INTERNAL_ERROR", undefined, 500);
    }
    return createErrorResponse(error.message, "INTERNAL_ERROR", undefined, 500);
  }

  return createErrorResponse(fallbackMessage, "INTERNAL_ERROR", undefined, 500);
}

/**
 * Common HTTP error responses
 */
export const ApiErrors = {
  unauthorized: (message = "Unauthorized") =>
    createErrorResponse(message, "UNAUTHORIZED", undefined, 401),

  forbidden: (message = "Forbidden") =>
    createErrorResponse(message, "FORBIDDEN", undefined, 403),

  notFound: (resource = "Resource") =>
    createErrorResponse(`${resource} not found`, "NOT_FOUND", undefined, 404),

  conflict: (message = "Resource already exists") =>
    createErrorResponse(message, "CONFLICT", undefined, 409),

  rateLimited: (message = "Rate limit exceeded", retryAfter?: number) =>
    createErrorResponse(
      message,
      "RATE_LIMITED",
      retryAfter ? { retryAfter } : undefined,
      429
    ),

  badRequest: (message = "Bad request") =>
    createErrorResponse(message, "BAD_REQUEST", undefined, 400),

  internal: (message = "Internal server error") =>
    createErrorResponse(message, "INTERNAL_ERROR", undefined, 500),
};

/**
 * Async route handler wrapper with standardized error handling
 */
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleZodError(error);
      }
      return handleUnknownError(error);
    }
  };
}

/**
 * Validates request body against a Zod schema
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return { success: false, response: handleZodError(result.error) };
    }
    return { success: true, data: result.data };
  } catch {
    return { success: false, response: ApiErrors.badRequest("Invalid JSON body") };
  }
}

/**
 * Extracts query parameters with validation
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
  const params: Record<string, string | string[]> = {};
  for (const [key, value] of searchParams.entries()) {
    if (params[key]) {
      if (Array.isArray(params[key])) {
        (params[key] as string[]).push(value);
      } else {
        params[key] = [params[key] as string, value];
      }
    } else {
      params[key] = value;
    }
  }

  const result = schema.safeParse(params);
  if (!result.success) {
    return { success: false, response: handleZodError(result.error) };
  }
  return { success: true, data: result.data };
}