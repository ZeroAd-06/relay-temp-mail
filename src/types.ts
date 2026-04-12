/**
 * TypeScript type definitions for the relay-temp-mail package.
 *
 * These interfaces define the core data structures used throughout the package,
 * including the provider abstraction layer for extensible email alias and mail
 * access providers.
 */

// ============================================================================
// Provider Interfaces (Core Abstraction)
// ============================================================================

/**
 * Abstract interface for alias email providers.
 *
 * An alias provider creates and manages email aliases that forward to a real
 * email address. Different providers (Firefox Relay, SimpleLogin, DuckDuckGo
 * Email Protection, etc.) can implement this interface.
 */
export interface AliasProvider {
  /**
   * Lists all email aliases managed by this provider.
   *
   * @returns Promise resolving to an array of RelayAlias objects
   */
  listAliases(): Promise<RelayAlias[]>;

  /**
   * Creates a new email alias.
   *
   * @returns Promise resolving to the newly created RelayAlias
   */
  createAlias(): Promise<RelayAlias>;

  /**
   * Deletes an email alias by its ID.
   *
   * @param id - The unique identifier of the alias to delete
   */
  deleteAlias(id: number): Promise<void>;
}

/**
 * Abstract interface for mail access providers.
 *
 * A mail provider retrieves raw emails from a mailbox via API. Different
 * providers (CF Temp Mail, IMAP, etc.) can implement this interface.
 */
export interface MailProvider {
  /**
   * Retrieves emails from the mail provider.
   *
   * @param limit - Maximum number of emails to return
   * @param offset - Pagination offset (0-indexed)
   * @returns Promise resolving to an array of Email objects
   */
  getMails(limit: number, offset: number): Promise<Email[]>;
}

// ============================================================================
// Provider Configuration (Discriminated Unions)
// ============================================================================

/**
 * Configuration for the Firefox Relay alias provider.
 */
export interface FirefoxRelayConfig {
  /** Discriminant identifying this provider type */
  type: 'firefox-relay';

  /** CSRF token for Firefox Relay API authentication */
  csrfToken: string;

  /** Session ID for Firefox Relay API authentication */
  sessionId: string;
}

/**
 * Union type for all supported alias provider configurations.
 *
 * Currently only supports 'firefox-relay'. More providers (simplelogin,
 * duckduckgo, etc.) can be added here in the future.
 */
export type AliasProviderConfig = FirefoxRelayConfig;

/**
 * Configuration for the CloudFlare temp mail provider.
 */
export interface CFTempMailConfig {
  /** Discriminant identifying this provider type */
  type: 'cf-temp-mail';

  /** Base URL for the CloudFlare temp email API */
  apiUrl: string;

  /** Bearer token for CloudFlare temp email API authentication */
  token: string;
}

/**
 * Union type for all supported mail provider configurations.
 *
 * Currently only supports 'cf-temp-mail'. More providers (imap, pop3, etc.)
 * can be added here in the future.
 */
export type MailProviderConfig = CFTempMailConfig;

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * Configuration interface for initializing the TempMailClient.
 *
 * Uses a provider-based architecture where alias and mail providers are
 * specified by their type and provider-specific configuration. This allows
 * the library to grow to support additional providers without breaking changes.
 *
 * @example
 * ```typescript
 * const client = new TempMailClient({
 *   aliasProvider: {
 *     type: 'firefox-relay',
 *     csrfToken: '...',
 *     sessionId: '...',
 *   },
 *   mailProvider: {
 *     type: 'cf-temp-mail',
 *     apiUrl: 'https://...',
 *     token: '...',
 *   },
 *   timeout: 30000,
 * });
 * ```
 */
export interface TempMailConfig {
  /** Alias email provider configuration */
  aliasProvider: AliasProviderConfig;

  /** Mail access provider configuration */
  mailProvider: MailProviderConfig;

  /** Optional timeout for HTTP requests in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * @deprecated Use TempMailConfig instead. Will be removed in the next major version.
 *
 * Legacy configuration interface kept for backward compatibility.
 */
export interface RelayConfig {
  /** CSRF token for Firefox Relay API authentication */
  csrfToken: string;

  /** Session ID for Firefox Relay API authentication */
  sessionId: string;

  /** Base URL for the CloudFlare temp email API */
  cfApiUrl: string;

  /** Bearer token for CloudFlare temp email API authentication */
  cfToken: string;

  /** Optional timeout for HTTP requests in milliseconds */
  timeout?: number;
}

// ============================================================================
// Data Types
// ============================================================================

/**
 * Represents an email alias.
 *
 * This interface maps to the JSON structure returned by alias providers
 * when listing or creating email aliases.
 *
 * Note: Property names use camelCase even though the underlying API may
 * return snake_case. The provider implementation handles the conversion.
 */
export interface RelayAlias {
  /** Unique identifier for the alias */
  id: number;

  /** The alias username (part before @) */
  address: string;

  /** Complete email address including domain */
  fullAddress: string;

  /** Whether the alias is currently enabled for receiving emails */
  enabled: boolean;

  /** ISO timestamp when the alias was created */
  createdAt: string;

  /** Domain identifier (2 for mozmail.com) */
  domain: number;

  /** Type of alias generation (e.g., "random") */
  maskType: string;

  /** Optional description for the alias */
  description?: string;

  /** Number of emails forwarded through this alias */
  numForwarded?: number;

  /** Number of emails blocked by this alias */
  numBlocked?: number;

  /** Optional timestamp when alias was last modified */
  lastModifiedAt?: string;

  /** Optional timestamp when alias was last used */
  lastUsedAt?: string | null;

  /** Number of level one trackers blocked */
  numLevelOneTrackersBlocked?: number;

  /** Number of replies sent from this alias */
  numReplied?: number;

  /** Number of spam emails marked */
  numSpam?: number;

  /** Whether the alias blocks list emails */
  blockListEmails?: boolean;

  /** Service the alias was generated for (optional) */
  generatedFor?: string;

  /** Where the alias is used (optional) */
  usedOn?: string | null;
}

/**
 * Email object returned by mail providers.
 *
 * This interface represents the raw email data as returned from a mail
 * provider, including the complete MIME message in the `raw` field.
 */
export interface Email {
  /** Unique identifier for the email */
  id: number;

  /** Original message ID from the email headers */
  messageId: string;

  /** Source email address that sent this email */
  source: string;

  /** Destination email address that received this email */
  address: string;

  /** Raw MIME content of the email */
  raw: string;

  /** Metadata associated with the email (can be any type) */
  metadata: any | null;

  /** ISO timestamp when the email was created/received */
  createdAt: string;
}

/**
 * Email object with parsed alias information.
 *
 * This interface extends the base Email interface and adds the parsed
 * alias information extracted from the MIME content.
 */
export interface ParsedEmail extends Email {
  /**
   * The alias that this email was sent to.
   * This is extracted from the `raw` MIME content by parsing the `To:` header.
   */
  relayAlias?: string;
}

/**
 * Query options for listing aliases.
 */
export interface ListAliasesOptions {
  /** Maximum number of aliases to return */
  limit?: number;

  /** Offset for pagination (0-indexed) */
  offset?: number;
}

/**
 * Query options for retrieving emails from a mail provider.
 */
export interface GetEmailsOptions {
  /** Maximum number of emails to return */
  limit?: number;

  /** Offset for pagination (0-indexed) */
  offset?: number;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response structure from the CloudFlare temp email API for listing emails.
 *
 * This matches the JSON structure returned by the `/api/mails` endpoint.
 */
export interface CFMailsResponse {
  /** Array of email objects */
  results: Email[];

  /** Total number of emails available (for pagination) */
  count: number;
}

/**
 * Response type for listing Firefox Relay aliases.
 *
 * The Firefox Relay API returns an array of alias objects directly.
 */
export type RelayAddressesResponse = RelayAlias[];

/**
 * Response type for creating a new Firefox Relay alias.
 *
 * The Firefox Relay API returns a single alias object when creating a new alias.
 */
export type CreateAliasResponse = RelayAlias;
