/**
 * relay-temp-mail
 * 
 * A JavaScript/TypeScript package for managing Firefox Relay email aliases
 * and retrieving temporary emails via the CloudFlare temp email API.
 */

// Re-export types from types.ts
export type {
  RelayConfig,
  RelayAlias,
  Email,
  ParsedEmail,
  ListAliasesOptions,
  GetEmailsOptions,
  CFMailsResponse,
  RelayAddressesResponse,
  CreateAliasResponse,
} from './types.js';

// Re-export error classes from errors.ts
export {
  RelayTempMailError,
  NetworkError,
  AuthError,
  NotFoundError,
  ParseError,
  RateLimitError,
} from './errors.js';

// Re-export main class from client.ts
export { RelayClient } from './client.js';
