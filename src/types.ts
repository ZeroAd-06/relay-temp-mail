/**
 * TypeScript type definitions for the relay-temp-mail package.
 * 
 * These interfaces define the core data structures used throughout the package,
 * ensuring type safety when interacting with the Firefox Relay and CF temp email APIs.
 */

/**
 * Configuration interface for initializing the RelayClient.
 * 
 * This interface contains all required authentication tokens and API URLs
 * needed to communicate with both Firefox Relay and CloudFlare temp email services.
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

/**
 * Represents a Firefox Relay email alias.
 * 
 * This interface maps to the JSON structure returned by the Firefox Relay API
 * when listing or creating email aliases.
 * 
 * Note: Property names use camelCase even though the API returns snake_case.
 * The package will handle the conversion internally.
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
 * Email object returned by the CloudFlare temp email API.
 * 
 * This interface represents the raw email data as returned from the CF API,
 * including the complete MIME message in the `raw` field.
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
 * Firefox Relay alias information extracted from the MIME content.
 */
export interface ParsedEmail extends Email {
  /**
   * The Firefox Relay alias that this email was sent to.
   * This is extracted from the `raw` MIME content by parsing the `To:` header.
   */
  relayAlias?: string;
}

/**
 * Query options for listing Firefox Relay aliases.
 */
export interface ListAliasesOptions {
  /** Maximum number of aliases to return */
  limit?: number;
  
  /** Offset for pagination (0-indexed) */
  offset?: number;
}

/**
 * Query options for retrieving emails from the CF temp email API.
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