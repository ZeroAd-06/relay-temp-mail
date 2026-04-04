/**
 * Main client for the relay-temp-mail package.
 *
 * This module provides the RelayClient class which integrates all components
 * (CF API, Relay API, Parser) into a unified interface.
 */

import { CFEmailClient } from './cf-api.js';
import { HttpClient } from './http.js';
import { EmailParser } from './parser.js';
import { RelayAPIClient } from './relay-api.js';
import type {
  RelayConfig,
  RelayAlias,
  ParsedEmail,
  GetEmailsOptions,
} from './types.js';

/**
 * Main client for interacting with Firefox Relay and CloudFlare temp email services.
 *
 * RelayClient integrates all components to provide a unified interface for:
 * - Managing Firefox Relay email aliases
 * - Retrieving and parsing emails from CloudFlare temp email API
 *
 * @example
 * ```typescript
 * const client = new RelayClient({
 *   csrfToken: '...',
 *   sessionId: '...',
 *   cfApiUrl: 'https://...',
 *   cfToken: '...',
 *   timeout: 30000
 * });
 *
 * const aliases = await client.listAliases();
 * const emails = await client.getEmails('alias@mozmail.com', { limit: 10 });
 * ```
 */
export class RelayClient {
  private readonly relayApi: RelayAPIClient;
  private readonly cfApi: CFEmailClient;
  private readonly parser: EmailParser;

  /**
   * Creates a new RelayClient instance.
   *
   * @param config - Configuration object containing authentication tokens and API URLs
   */
  constructor(config: RelayConfig) {
    const timeout = config.timeout ?? 30000;

    const relayHttpClient = new HttpClient('https://relay.firefox.com', timeout);
    this.relayApi = new RelayAPIClient(
      config.csrfToken,
      config.sessionId,
      relayHttpClient
    );

    this.cfApi = new CFEmailClient(config.cfApiUrl, config.cfToken);
    this.parser = new EmailParser();
  }

  /**
   * Lists all Firefox Relay email aliases.
   *
   * @returns Promise resolving to an array of RelayAlias objects
   * @throws AuthError if authentication fails
   * @throws NetworkError if there's a network problem
   */
  async listAliases(): Promise<RelayAlias[]> {
    return this.relayApi.getAliases();
  }

  /**
   * Creates a new Firefox Relay email alias.
   *
   * @returns Promise resolving to the newly created RelayAlias
   * @throws AuthError if authentication fails
   * @throws NetworkError if there's a network problem
   */
  async createAlias(): Promise<RelayAlias> {
    return this.relayApi.createAlias();
  }

  /**
   * Deletes a Firefox Relay email alias.
   *
   * @param id - The ID of the alias to delete
   * @throws AuthError if authentication fails
   * @throws NotFoundError if the alias doesn't exist
   * @throws NetworkError if there's a network problem
   */
  async deleteAlias(id: number): Promise<void> {
    return this.relayApi.deleteAlias(id);
  }

  /**
   * Retrieves and parses emails from the CloudFlare temp email API.
   *
   * If aliasAddress is provided, only emails sent to that address are returned.
   *
   * @param aliasAddress - Optional email address to filter by
   * @param options - Query options for pagination
   * @returns Promise resolving to an array of ParsedEmail objects
   * @throws AuthError if authentication fails
   * @throws NetworkError if there's a network problem
   */
  async getEmails(
    aliasAddress?: string,
    options?: GetEmailsOptions
  ): Promise<ParsedEmail[]> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const emails = await this.cfApi.getMails(limit, offset);

    const parsedEmails: ParsedEmail[] = emails.map((email) => {
      const parsed = this.parser.parseEmail(email.raw);
      return {
        ...parsed,
        id: email.id,
        messageId: email.messageId,
        source: email.source,
        address: email.address,
        createdAt: email.createdAt,
        metadata: email.metadata,
      };
    });

    if (aliasAddress) {
      const normalizedAlias = aliasAddress.toLowerCase();
      return parsedEmails.filter(
        (email) =>
          email.relayAlias?.toLowerCase() === normalizedAlias ||
          email.address.toLowerCase() === normalizedAlias
      );
    }

    return parsedEmails;
  }
}
