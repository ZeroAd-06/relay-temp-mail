export type {
  AliasProvider,
  MailProvider,
  TempMailConfig,
  FirefoxRelayConfig,
  CFTempMailConfig,
  AliasProviderConfig,
  MailProviderConfig,
  RelayAlias,
  Email,
  ParsedEmail,
  ListAliasesOptions,
  GetEmailsOptions,
  CFMailsResponse,
  RelayAddressesResponse,
  CreateAliasResponse,
  RelayConfig,
} from './types.js';

export {
  RelayTempMailError,
  NetworkError,
  AuthError,
  NotFoundError,
  ParseError,
  RateLimitError,
} from './errors.js';

export { TempMailClient, RelayClient } from './client.js';

export { FirefoxRelayProvider, RelayAPIClient } from './relay-api.js';

export { CFTempMailProvider, CFEmailClient } from './cf-api.js';
