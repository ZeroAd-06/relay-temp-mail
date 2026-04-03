/**
 * Custom error classes for the relay-temp-mail package.
 *
 * These errors provide structured error information including error codes,
 * HTTP status codes, and response data for better error handling.
 */

/**
 * Base error class for all relay-temp-mail errors.
 *
 * Extends the built-in Error class with additional context about the error,
 * including an error code for programmatic error handling and optional
 * response data from the API.
 */
export class RelayTempMailError extends Error {
  /**
   * Machine-readable error code for programmatic error handling.
   * Examples: 'NETWORK_ERROR', 'AUTH_ERROR', 'NOT_FOUND'
   */
  code: string;

  /**
   * HTTP status code associated with this error, if applicable.
   */
  statusCode?: number;

  /**
   * Raw response data from the API, if available.
   */
  response?: any;

  /**
   * Creates a new RelayTempMailError instance.
   *
   * @param message - Human-readable error message describing the error.
   * @param code - Machine-readable error code (e.g., 'UNKNOWN_ERROR').
   * @param statusCode - Optional HTTP status code associated with the error.
   * @param response - Optional raw response data from the API.
   */
  constructor(
    message: string,
    code: string,
    statusCode?: number,
    response?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.response = response;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error for network-related failures.
 *
 * Thrown when there is a problem establishing or maintaining a network
 * connection, such as DNS resolution failures, connection timeouts,
 * or network unreachability.
 */
export class NetworkError extends RelayTempMailError {
  code = 'NETWORK_ERROR' as const;

  constructor(message: string, response?: any) {
    super(message, 'NETWORK_ERROR', undefined, response);
  }
}

/**
 * Error for authentication and authorization failures.
 *
 * Thrown when API requests fail due to invalid or missing credentials
 * (401) or when the authenticated user lacks permission for the
 * requested operation (403).
 */
export class AuthError extends RelayTempMailError {
  code = 'AUTH_ERROR' as const;

  constructor(message: string, statusCode?: number, response?: any) {
    super(message, 'AUTH_ERROR', statusCode, response);
  }
}

/**
 * Error for resource not found errors.
 *
 * Thrown when the requested resource does not exist (404 response),
 * such as when trying to access a non-existent alias or email.
 */
export class NotFoundError extends RelayTempMailError {
  code = 'NOT_FOUND' as const;

  constructor(message: string, response?: any) {
    super(message, 'NOT_FOUND', 404, response);
  }
}

/**
 * Error for MIME message parsing failures.
 *
 * Thrown when there is an error parsing email MIME content,
 * such as malformed headers or invalid message structure.
 */
export class ParseError extends RelayTempMailError {
  code = 'PARSE_ERROR' as const;

  constructor(message: string, response?: any) {
    super(message, 'PARSE_ERROR', undefined, response);
  }
}

/**
 * Error for rate limiting responses.
 *
 * Thrown when the API rate limit has been exceeded (429 response).
 * The client should wait and retry the request after the indicated
 * cooldown period.
 */
export class RateLimitError extends RelayTempMailError {
  code = 'RATE_LIMIT_ERROR' as const;

  constructor(message: string, response?: any) {
    super(message, 'RATE_LIMIT_ERROR', 429, response);
  }
}
