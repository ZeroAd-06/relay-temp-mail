/**
 * CloudFlare temp email API client.
 *
 * This module provides the CFEmailClient class for interacting with the
 * CloudFlare temp email API to retrieve emails.
 */

import { Email, CFMailsResponse } from './types.js';
import { AuthError, NetworkError, NotFoundError, RateLimitError, RelayTempMailError } from './errors.js';

/**
 * HTTP client interface for making requests.
 *
 * This interface allows for dependency injection, making testing easier
 * by allowing mock implementations.
 */
export interface HttpClient {
  /**
   * Makes an HTTP GET request.
   *
   * @param url - The URL to request
   * @param options - Request options including headers
   * @returns The response body as unknown
   */
  get(url: string, options?: { headers?: Record<string, string> }): Promise<unknown>;
}

/**
 * Default HTTP client implementation using fetch.
 */
class DefaultHttpClient implements HttpClient {
  async get(url: string, options?: { headers?: Record<string, string> }): Promise<unknown> {
    const response = await fetch(url, {
      method: 'GET',
      headers: options?.headers,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new RelayTempMailError(
        `HTTP ${response.status}: ${errorBody}`,
        'HTTP_ERROR',
        response.status,
        errorBody
      );
    }

    return response.json();
  }
}

/**
 * Raw email response from CF API (snake_case properties).
 */
interface CFRawEmail {
  id: number;
  message_id: string;
  source: string;
  address: string;
  raw: string;
  metadata: any | null;
  created_at: string;
}

/**
 * Raw API response structure.
 */
interface CFRawResponse {
  results: CFRawEmail[];
  count: number;
}

/**
 * Client for interacting with the CloudFlare temp email API.
 *
 * This client handles authentication, request formatting, and response
 * mapping from the CF API's snake_case to camelCase.
 */
export class CFEmailClient {
  private readonly apiUrl: string;
  private readonly token: string;
  private readonly httpClient: HttpClient;

  /**
   * Creates a new CFEmailClient instance.
   *
   * @param apiUrl - Base URL for the CF temp email API
   * @param token - Bearer token for authentication
   * @param httpClient - Optional HTTP client (defaults to fetch-based implementation)
   */
  constructor(apiUrl: string, token: string, httpClient?: HttpClient) {
    this.apiUrl = apiUrl;
    this.token = token;
    this.httpClient = httpClient ?? new DefaultHttpClient();
  }

  /**
   * Retrieves emails from the CF temp email API.
   *
   * @param limit - Maximum number of emails to return (default: 20)
   * @param offset - Pagination offset (default: 0)
   * @returns Promise resolving to an array of Email objects
   * @throws AuthError if authentication fails
   * @throws NetworkError if there's a network problem
   * @throws NotFoundError if the endpoint doesn't exist
   * @throws RateLimitError if rate limited
   */
  async getMails(limit: number = 20, offset: number = 0): Promise<Email[]> {
    const url = new URL(`${this.apiUrl}/api/mails`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
    };

    try {
      const response = await this.httpClient.get(url.toString(), { headers });
      return this.mapCFResponse(response as CFRawResponse);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Maps the raw CF API response to the Email interface.
   *
   * Converts snake_case property names to camelCase.
   *
   * @param response - Raw response from CF API
   * @returns Array of Email objects
   */
  private mapCFResponse(response: CFRawResponse): Email[] {
    return response.results.map((item): Email => ({
      id: item.id,
      messageId: item.message_id,
      source: item.source,
      address: item.address,
      raw: item.raw,
      metadata: item.metadata,
      createdAt: item.created_at,
    }));
  }

  /**
   * Handles errors from HTTP requests.
   *
   * Maps HTTP errors to appropriate error classes.
   *
   * @param error - The caught error
   * @returns Appropriate RelayTempMailError subclass
   */
  private handleError(error: unknown): RelayTempMailError {
    if (error instanceof RelayTempMailError) {
      const statusCode = error.statusCode;

      if (statusCode === 401 || statusCode === 403) {
        return new AuthError(error.message, statusCode, error.response);
      }
      if (statusCode === 404) {
        return new NotFoundError(error.message, error.response);
      }
      if (statusCode === 429) {
        return new RateLimitError(error.message, error.response);
      }

      return error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new NetworkError(error.message);
    }

    if (error instanceof Error) {
      return new NetworkError(error.message);
    }

    return new RelayTempMailError(
      'Unknown error occurred',
      'UNKNOWN_ERROR',
      undefined,
      error
    );
  }
}
