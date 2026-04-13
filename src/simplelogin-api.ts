import { HttpClient } from './http.js';
import type { AliasProvider, RelayAlias } from './types.js';

interface RawSimpleLoginAlias {
  id: number;
  email: string;
  name: string | null;
  enabled: boolean;
  creation_timestamp: number;
  creation_date: string;
  note: string | null;
  nb_block: number;
  nb_forward: number;
  nb_reply: number;
}

interface ListAliasesResponse {
  aliases: RawSimpleLoginAlias[];
}

export class SimpleLoginProvider implements AliasProvider {
  private apiKey: string;
  private httpClient: HttpClient;

  constructor(apiKey: string, apiUrl?: string, httpClient?: HttpClient) {
    this.apiKey = apiKey;
    this.httpClient = httpClient ?? new HttpClient(apiUrl ?? 'https://app.simplelogin.io');
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      'Authentication': this.apiKey,
    };
  }

  async listAliases(): Promise<RelayAlias[]> {
    const allAliases: RelayAlias[] = [];
    let pageId = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.httpClient.request<ListAliasesResponse>(
        'GET',
        `/api/v2/aliases?page_id=${pageId}`,
        { headers: this.getAuthHeaders() }
      );

      const mapped = response.aliases.map((item) => this.mapAliasResponse(item));
      allAliases.push(...mapped);

      // SimpleLogin returns max 20 aliases per page
      hasMore = response.aliases.length === 20;
      pageId++;
    }

    return allAliases;
  }

  async createAlias(): Promise<RelayAlias> {
    const response = await this.httpClient.request<RawSimpleLoginAlias>(
      'POST',
      '/api/alias/random/new',
      {
        headers: this.getAuthHeaders(),
      }
    );

    return this.mapAliasResponse(response);
  }

  async deleteAlias(id: number): Promise<void> {
    await this.httpClient.request<void>(
      'DELETE',
      `/api/aliases/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  private mapAliasResponse(data: RawSimpleLoginAlias): RelayAlias {
    const address = data.email.split('@')[0];
    return {
      id: data.id,
      address,
      fullAddress: data.email,
      enabled: data.enabled,
      createdAt: data.creation_date,
      domain: 4, // SimpleLogin domain identifier
      maskType: 'random',
      description: data.note ?? undefined,
      numForwarded: data.nb_forward,
      numBlocked: data.nb_block,
      numReplied: data.nb_reply,
    };
  }
}
