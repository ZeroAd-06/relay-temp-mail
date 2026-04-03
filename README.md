# relay-temp-mail

A TypeScript/JavaScript package for managing Firefox Relay email aliases and retrieving temporary emails via a CloudFlare temp email API.

## Features

- **Create Firefox Relay aliases** - Generate new email aliases on demand
- **List existing aliases** - View all your configured email aliases
- **Get emails for specific aliases** - Fetch and parse emails sent to specific addresses
- **Delete aliases** - Clean up unused aliases programmatically
- **TypeScript support** - Full type definitions for all APIs
- **ESM + CommonJS support** - Works with both module systems

## Installation

```bash
npm install relay-temp-mail
# or
pnpm add relay-temp-mail
# or
bun add relay-temp-mail
```

## Quick Start

```typescript
import { RelayClient } from 'relay-temp-mail';

const client = new RelayClient({
  csrfToken: 'your-csrf-token',
  sessionId: 'your-session-id',
  cfApiUrl: 'https://your-cf-api.com',
  cfToken: 'your-cf-token',
});

// Create a new alias
const alias = await client.createAlias();
console.log('New alias:', alias.fullAddress);

// List all aliases
const aliases = await client.listAliases();

// Get emails for a specific alias
const emails = await client.getEmails(alias.fullAddress, { limit: 10 });
```

## Configuration

### Firefox Relay Tokens

To get your `csrfToken` and `sessionId`:

1. Login to [relay.firefox.com](https://relay.firefox.com)
2. Open your browser's developer tools (F12)
3. Go to the Application/Storage tab
4. Find Cookies for `relay.firefox.com`
5. Copy the values for `csrftoken` and `sessionid`

### CF Temp Email

You'll need to set up your own CloudFlare Worker for email handling:

1. Deploy a CF Worker that handles incoming emails
2. Configure the worker to store and serve emails via an API
3. Get your API URL and authentication token

## API Documentation

### RelayClient

The main class for interacting with both Firefox Relay and CloudFlare temp email services.

#### Constructor Options

```typescript
interface RelayConfig {
  csrfToken: string;    // Firefox Relay CSRF token
  sessionId: string;    // Firefox Relay session ID
  cfApiUrl: string;     // CloudFlare temp email API URL
  cfToken: string;      // CloudFlare API token
  timeout?: number;     // Request timeout in ms (default: 30000)
}
```

#### Methods

##### `listAliases()`

Lists all Firefox Relay email aliases.

```typescript
const aliases = await client.listAliases();
// Returns: RelayAlias[]
```

##### `createAlias()`

Creates a new random Firefox Relay email alias.

```typescript
const alias = await client.createAlias();
// Returns: RelayAlias
console.log(alias.fullAddress); // e.g., "random123@mozmail.com"
```

##### `deleteAlias(id)`

Deletes an alias by its ID.

```typescript
await client.deleteAlias(12345);
```

##### `getEmails(aliasAddress?, options?)`

Retrieves and parses emails from the CloudFlare temp email API. If `aliasAddress` is provided, only emails sent to that address are returned.

```typescript
// Get all emails (up to default limit)
const allEmails = await client.getEmails();

// Get emails for a specific alias
const emails = await client.getEmails('alias@mozmail.com', { limit: 10 });

// With pagination
const page2 = await client.getEmails('alias@mozmail.com', { limit: 10, offset: 10 });
```

Options:

- `limit` - Maximum number of emails to return (default: 20)
- `offset` - Offset for pagination, 0-indexed (default: 0)

## Error Handling

The package exports several error classes for handling different failure scenarios:

```typescript
import {
  RelayTempMailError,
  NetworkError,
  AuthError,
  NotFoundError,
  ParseError,
  RateLimitError,
} from 'relay-temp-mail';

try {
  const alias = await client.createAlias();
} catch (error) {
  if (error instanceof AuthError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof NetworkError) {
    console.error('Network problem:', error.message);
  } else if (error instanceof RateLimitError) {
    console.error('Rate limited. Retry after:', error.response?.retryAfter);
  } else if (error instanceof RelayTempMailError) {
    console.error('Relay error:', error.code, error.message);
  }
}
```

### Error Classes

| Class | Description | Status Code |
|-------|-------------|-------------|
| `RelayTempMailError` | Base error class for all package errors | - |
| `NetworkError` | Network connectivity issues | - |
| `AuthError` | Authentication or authorization failures | 401/403 |
| `NotFoundError` | Requested resource not found | 404 |
| `ParseError` | Email MIME parsing failures | - |
| `RateLimitError` | API rate limit exceeded | 429 |

All error classes extend `RelayTempMailError` and provide:

- `code` - Machine-readable error code
- `statusCode` - HTTP status code (if applicable)
- `response` - Raw response data from the API (if available)

## TypeScript

All types are fully exported for use in your TypeScript projects:

```typescript
import type {
  RelayConfig,
  RelayAlias,
  Email,
  ParsedEmail,
  ListAliasesOptions,
  GetEmailsOptions,
} from 'relay-temp-mail';
```

The package is built with strict TypeScript settings and provides comprehensive type definitions for all APIs.

## License

MIT
