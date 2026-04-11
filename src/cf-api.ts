import type { MailProvider, Email } from './types.js';
import { AuthError, NetworkError, NotFoundError, RateLimitError, RelayTempMailError } from './errors.js';

interface CFRawEmail {
  id: number;
  message_id: string;
  source: string;
  address: string;
  raw: string;
  metadata: any | null;
  created_at: string;
}

interface CFRawResponse {
  results: CFRawEmail[];
  count: number;
}

export class CFTempMailProvider implements MailProvider {
  private readonly apiUrl: string;
  private readonly token: string;
  private readonly httpClient: HttpClient;

  constructor(apiUrl: string, token: string, httpClient?: HttpClient) {
    this.apiUrl = apiUrl.replace(/\/+$/, '');
    this.token = token;
    this.httpClient = httpClient ?? new DefaultHttpClient();
  }

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

/** @deprecated Use CFTempMailProvider instead */
export const CFEmailClient = CFTempMailProvider;

export interface HttpClient {
  get(url: string, options?: { headers?: Record<string, string> }): Promise<unknown>;
}

export class DefaultHttpClient implements HttpClient {
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
