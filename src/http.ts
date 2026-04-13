/**
 * HTTP client utilities for the relay-temp-mail package.
 *
 * This module provides a configurable HTTP client with timeout support,
 * automatic retry logic, and proper error classification for API responses.
 */

import {
  RelayTempMailError,
  NetworkError,
  AuthError,
  NotFoundError,
  RateLimitError,
} from './errors.js';

/**
 * Options for individual HTTP requests.
 */
export interface RequestOptions {
  /** Custom headers to include in the request */
  headers?: Record<string, string>;

  /** Request body (will be JSON serialized) */
  body?: unknown;

  /** Request timeout in milliseconds (overrides client default) */
  timeout?: number;

  /** Number of retries on failure (overrides client default) */
  retries?: number;
}

/**
 * HTTP client for making requests to the relay-temp-mail API.
 *
 * Provides a configurable base URL with timeout, retry, and automatic
 * JSON parsing capabilities.
 */
export class HttpClient {
  private baseUrl: string;
  private defaultTimeout: number;
  private defaultRetries: number;

  /**
   * Creates a new HttpClient instance.
   *
   * @param baseUrl - Base URL for all requests (e.g., 'https://api.example.com')
   * @param defaultTimeout - Default timeout in milliseconds (default: 30000)
   * @param defaultRetries - Default number of retries on failure (default: 0)
   */
  constructor(
    baseUrl: string,
    defaultTimeout: number = 30000,
    defaultRetries: number = 0
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.defaultTimeout = defaultTimeout;
    this.defaultRetries = defaultRetries;
  }

  /**
   * Makes an HTTP request to the specified path.
   *
   * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param path - API path (will be appended to baseUrl)
   * @param options - Optional request configuration
   * @returns Promise resolving to the parsed JSON response
   */
  async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const timeout = options.timeout ?? this.defaultTimeout;
    const retries = options.retries ?? this.defaultRetries;

    let lastError: RelayTempMailError | Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.executeRequest(method, path, options, timeout);
        return await this.handleResponse<T>(response);
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry
        if (attempt < retries && this.shouldRetry(error)) {
          const delay = 1000 * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }

        // Don't retry, throw the classified error
        if (error instanceof RelayTempMailError) {
          throw error;
        }

        // Classify the error if not already classified
        throw this.classifyError(error);
      }
    }

    // This should never be reached, but just in case
    throw lastError || new NetworkError('Request failed');
  }

  /**
   * Executes the actual HTTP request with timeout support.
   */
  private async executeRequest(
    method: string,
    path: string,
    options: RequestOptions,
    timeout: number
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      };

      if (options.body !== undefined) {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, fetchOptions);
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handles the HTTP response, parsing JSON and checking for errors.
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      throw this.classifyError(new Error(`HTTP ${response.status}`), response);
    }

    const text = await response.text();

    // Handle empty responses
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  /**
   * Classifies an error based on the error type and HTTP response.
   */
  private classifyError(error: unknown, response?: Response): RelayTempMailError {
    // Network errors (fetch failed)
    if (error instanceof Error && error.name === 'AbortError') {
      return new NetworkError('Request timed out');
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new NetworkError('Network request failed');
    }

    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      return new NetworkError('Network request failed');
    }

    // HTTP status-based classification
    if (response) {
      const status = response.status;

      if (status === 401 || status === 403) {
        return new AuthError(
          `Authentication failed: ${response.statusText}`,
          status
        );
      }

      if (status === 404) {
        return new NotFoundError(`Resource not found: ${response.statusText}`);
      }

      if (status === 429) {
        return new RateLimitError(
          `Rate limit exceeded: ${response.statusText}`
        );
      }

      if (status >= 500) {
        return new NetworkError(
          `Server error: ${response.statusText}`,
          status
        );
      }
    }

    // Default error
    if (error instanceof Error) {
      return new RelayTempMailError(
        error.message,
        'REQUEST_ERROR',
        response?.status
      );
    }

    return new RelayTempMailError('Unknown error occurred', 'UNKNOWN_ERROR');
  }

  /**
   * Determines if a request should be retried based on the error.
   */
  private shouldRetry(error: unknown): boolean {
    if (error instanceof NetworkError) {
      return true;
    }

    if (error instanceof RelayTempMailError && error.statusCode) {
      return error.statusCode >= 500;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return true;
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
