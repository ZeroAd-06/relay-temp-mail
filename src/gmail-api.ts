import type { MailProvider, Email } from './types.js';
import {
  AuthError,
  NetworkError,
  RateLimitError,
  RelayTempMailError,
} from './errors.js';

interface GmailMessageListResponse {
  messages?: Array<{ id: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
}

interface GmailMessageResponse {
  id: string;
  threadId?: string;
  snippet?: string;
  payload?: GmailMessagePart;
  internalDate?: string;
  sizeEstimate?: number;
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export class GmailProvider implements MailProvider {
  private readonly userId: string;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly refreshToken?: string;
  private accessToken: string;
  private tokenExpiresAt = 0;

  constructor(config: {
    userId?: string;
    accessToken?: string;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
  }) {
    this.userId = config.userId ?? 'me';

    if (config.accessToken) {
      this.accessToken = config.accessToken;
    } else if (config.refreshToken && config.clientId && config.clientSecret) {
      this.accessToken = '';
      this.refreshToken = config.refreshToken;
      this.clientId = config.clientId;
      this.clientSecret = config.clientSecret;
    } else {
      throw new RelayTempMailError(
        'Gmail provider requires either accessToken or (refreshToken + clientId + clientSecret)',
        'INVALID_CONFIG',
      );
    }
  }

  async getMails(limit: number = 20, offset: number = 0): Promise<Email[]> {
    const token = await this.getAccessToken();

    const messageIds = await this.listMessageIds(token, limit, offset);
    if (messageIds.length === 0) {
      return [];
    }

    const emails = await Promise.all(
      messageIds.map((id) => this.getMessage(token, id)),
    );

    return emails.filter((e): e is Email => e !== null);
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      return this.accessToken;
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AuthError(
        `Failed to refresh Gmail access token: ${body}`,
        response.status,
      );
    }

    const data = (await response.json()) as TokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000;

    return this.accessToken;
  }

  private async listMessageIds(
    token: string,
    limit: number,
    offset: number,
  ): Promise<string[]> {
    const totalCount = limit + offset;
    const allIds: string[] = [];
    let pageToken: string | undefined;

    while (allIds.length < totalCount) {
      const url = new URL(
        `https://gmail.googleapis.com/gmail/v1/users/${this.userId}/messages`,
      );
      url.searchParams.set('maxResults', String(Math.min(500, totalCount - allIds.length)));
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await this.authedFetch(token, url.toString());

      const data = (await response.json()) as GmailMessageListResponse;
      if (data.messages) {
        allIds.push(...data.messages.map((m) => m.id));
      }

      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }

    return allIds.slice(offset, offset + limit);
  }

  private async getMessage(
    token: string,
    messageId: string,
  ): Promise<Email | null> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/${this.userId}/messages/${messageId}?format=raw`;

    const response = await this.authedFetch(token, url);

    const data = (await response.json()) as GmailMessageResponse;

    const headers = data.payload?.headers ?? [];
    const fromHeader =
      headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? '';
    const toHeader =
      headers.find((h) => h.name.toLowerCase() === 'to')?.value ?? '';
    const messageIdHeader =
      headers.find((h) => h.name.toLowerCase() === 'message-id')?.value ?? '';

    const rawBase64 = data.payload?.body?.data ?? '';

    let rawMime = '';
    if (rawBase64) {
      rawMime = this.decodeBase64Url(rawBase64);
    }

    return {
      id: this.hashStringToInt(data.id),
      messageId: messageIdHeader || data.id,
      source: fromHeader,
      address: toHeader,
      raw: rawMime,
      metadata: {
        threadId: data.threadId,
        snippet: data.snippet,
        internalDate: data.internalDate,
      },
      createdAt: data.internalDate
        ? new Date(Number(data.internalDate)).toISOString()
        : new Date().toISOString(),
    };
  }

  private async authedFetch(token: string, url: string): Promise<Response> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401 || response.status === 403) {
      const body = await response.text();
      throw new AuthError(
        `Gmail API authentication failed: ${body}`,
        response.status,
      );
    }

    if (response.status === 404) {
      throw new RelayTempMailError(
        'Gmail message not found',
        'NOT_FOUND',
        404,
      );
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new RateLimitError(
        `Gmail API rate limit exceeded${retryAfter ? `, retry after ${retryAfter}s` : ''}`,
      );
    }

    if (!response.ok) {
      const body = await response.text();
      throw new NetworkError(
        `Gmail API error (${response.status}): ${body}`,
        response.status,
      );
    }

    return response;
  }

  private decodeBase64Url(input: string): string {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(base64 + padding);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  private hashStringToInt(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash);
  }
}
