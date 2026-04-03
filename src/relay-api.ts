import { HttpClient } from './http';
import { RelayAlias } from './types';

interface RawAliasResponse {
  id: number;
  address: string;
  full_address: string;
  enabled: boolean;
  created_at: string;
  domain: number;
  mask_type: string;
  description?: string;
  num_forwarded?: number;
  num_blocked?: number;
  last_modified_at?: string;
  last_used_at?: string | null;
  num_level_one_trackers_blocked?: number;
  num_replied?: number;
  num_spam?: number;
  block_list_emails?: boolean;
  generated_for?: string;
  used_on?: string | null;
}

export class RelayAPIClient {
  private csrfToken: string;
  private sessionId: string;
  private httpClient: HttpClient;

  constructor(
    csrfToken: string,
    sessionId: string,
    httpClient?: HttpClient
  ) {
    this.csrfToken = csrfToken;
    this.sessionId = sessionId;
    this.httpClient = httpClient ?? new HttpClient('https://relay.firefox.com');
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      'X-CSRFToken': this.csrfToken,
      'Cookie': `sessionid=${this.sessionId}`,
    };
  }

  async getAliases(): Promise<RelayAlias[]> {
    const response = await this.httpClient.request<RawAliasResponse[]>(
      'GET',
      '/api/v1/relayaddresses/',
      { headers: this.getAuthHeaders() }
    );

    return response.map((item) => this.mapAliasResponse(item));
  }

  async createAlias(): Promise<RelayAlias> {
    const response = await this.httpClient.request<RawAliasResponse>(
      'POST',
      '/api/v1/relayaddresses/',
      { headers: this.getAuthHeaders() }
    );

    return this.mapAliasResponse(response);
  }

  async deleteAlias(id: number): Promise<void> {
    await this.httpClient.request<void>(
      'DELETE',
      `/api/v1/relayaddresses/${id}/`,
      { headers: this.getAuthHeaders() }
    );
  }

  private mapAliasResponse(data: RawAliasResponse): RelayAlias {
    return {
      id: data.id,
      address: data.address,
      fullAddress: data.full_address,
      enabled: data.enabled,
      createdAt: data.created_at,
      domain: data.domain,
      maskType: data.mask_type,
      description: data.description,
      numForwarded: data.num_forwarded,
      numBlocked: data.num_blocked,
      lastModifiedAt: data.last_modified_at,
      lastUsedAt: data.last_used_at,
      numLevelOneTrackersBlocked: data.num_level_one_trackers_blocked,
      numReplied: data.num_replied,
      numSpam: data.num_spam,
      blockListEmails: data.block_list_emails,
      generatedFor: data.generated_for,
      usedOn: data.used_on,
    };
  }
}
