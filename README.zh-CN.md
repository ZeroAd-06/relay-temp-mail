# relay-temp-mail

[English](README.md) | [中文](README.zh-CN.md)

一个模块化的 TypeScript/JavaScript 包，通过可插拔的 Provider 管理邮箱别名和接收临时邮件。

基于 Provider 架构 — 自由组合**别名提供商**与**邮件提供商**。当前内置 Firefox Relay、DuckDuckGo 邮件保护和 CloudFlare 临时邮箱支持。

## 功能特性

- **Provider 架构** — 自由组合别名与邮件提供商
- **Firefox Relay** — 创建、列出、删除邮箱别名
- **DuckDuckGo 邮件保护** — 创建邮箱别名，支持本地存储
- **CloudFlare 临时邮箱** — 通过 API 获取并解析邮件
- **TypeScript 支持** — 所有 API 均有完整类型定义，包括 Provider 接口
- **ESM + CommonJS 支持** — 兼容两种模块系统
- **可扩展** — 实现 `AliasProvider` 或 `MailProvider` 即可接入新服务

## 安装

```bash
npm install @z_06/relay-temp-mail
# 或
pnpm add @z_06/relay-temp-mail
# 或
bun add @z_06/relay-temp-mail
```

## 快速开始

```typescript
import { TempMailClient } from '@z_06/relay-temp-mail';

const client = new TempMailClient({
  aliasProvider: {
    type: 'firefox-relay',
    csrfToken: 'your-csrf-token',
    sessionId: 'your-session-id',
  },
  mailProvider: {
    type: 'cf-temp-mail',
    apiUrl: 'https://your-cf-api.com',
    token: 'your-cf-token',
  },
});

// 创建新别名
const alias = await client.createAlias();
console.log('新别名:', alias.fullAddress);

// 列出所有别名
const aliases = await client.listAliases();

// 获取指定别名的邮件
const emails = await client.getEmails(alias.fullAddress, { limit: 10 });
```

## Providers

本库使用两种可独立组合的 Provider：

| Provider 类型 | 接口 | 当前实现 |
|---|---|---|
| **别名提供商** | `AliasProvider` | `firefox-relay`, `duckduckgo-email` |
| **邮件提供商** | `MailProvider` | `cf-temp-mail` |

### 别名提供商

#### `firefox-relay`

通过 [Firefox Relay](https://relay.firefox.com) 管理邮箱别名。

**配置：**

```typescript
{
  type: 'firefox-relay',
  csrfToken: string;   // relay.firefox.com 的 CSRF token
  sessionId: string;   // relay.firefox.com 的 Session ID
}
```

**获取 Token：**

1. 登录 [relay.firefox.com](https://relay.firefox.com)
2. 打开浏览器开发者工具（F12）
3. 切换到 Application/Storage 标签页
4. 找到 `relay.firefox.com` 的 Cookies
5. 复制 `csrftoken` 和 `sessionid` 的值

#### `duckduckgo-email`

通过 [DuckDuckGo 邮件保护](https://duckduckgo.com/email/) 管理邮箱别名。

由于 DuckDuckGo API 不提供列出或删除别名的接口，该提供商使用本地存储。内置内存存储；可通过实现 `DuckDuckGoAliasStore` 接口自定义持久化（如文件、数据库）。

**配置：**

```typescript
{
  type: 'duckduckgo-email',
  jwtToken: string;             // DuckDuckGo 邮件保护的 JWT token
  store?: DuckDuckGoAliasStore; // 可选自定义存储（默认: 内存存储）
}
```

**获取 JWT Token：**

1. 访问 [duckduckgo.com/email](https://duckduckgo.com/email/) 并注册账户
2. 打开浏览器开发者工具（F12）
3. 在 DuckDuckGo 邮件界面点击"生成新地址"
4. 在网络请求栏中找到发往 `quack.duckduckgo.com` 的请求
5. 从 `Authorization` 请求头中复制 Bearer token

**自定义持久化：**

```typescript
import type { DuckDuckGoAliasStore, RelayAlias } from '@z_06/relay-temp-mail';

class MyFileStore implements DuckDuckGoAliasStore {
  getAll(): RelayAlias[] { /* 从文件读取 */ }
  add(alias: RelayAlias): void { /* 追加到文件 */ }
  remove(id: number): void { /* 从文件中删除 */ }
}

const client = new TempMailClient({
  aliasProvider: {
    type: 'duckduckgo-email',
    jwtToken: 'your-jwt-token',
    store: new MyFileStore(),
  },
  mailProvider: { /* ... */ },
});
```

**重复检测：** DuckDuckGo API 偶尔会返回之前已生成过的地址（仍返回 201）。该提供商会检测这种情况并抛出 `RelayTempMailError`，错误代码为 `DUPLICATE_ALIAS`。

### 邮件提供商

#### `cf-temp-mail`

从 [cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email) 实例获取邮件。

**配置：**

```typescript
{
  type: 'cf-temp-mail',
  apiUrl: string;  // CF 临时邮箱 API 的基础 URL
  token: string;    // API Bearer Token
}
```

**部署后端：**

1. Fork [cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email)
2. 部署到 Cloudflare Workers（一键部署或参考[部署文档](https://temp-mail-docs.awsl.uk)手动部署）
3. 在 Cloudflare Dashboard 中配置域名和 Email Routing 的 catch-all 规则
4. 从管理后台或用户设置中生成 API Token

## API 文档

### TempMailClient

主客户端类。接受 `aliasProvider` 和 `mailProvider` 配置，提供统一接口。

#### 构造函数

```typescript
new TempMailClient(config: TempMailConfig)

interface TempMailConfig {
  aliasProvider: AliasProviderConfig;  // 别名提供商配置（鉴别联合类型）
  mailProvider: MailProviderConfig;    // 邮件提供商配置（鉴别联合类型）
  timeout?: number;                    // 请求超时时间，毫秒（默认: 30000）
}
```

#### 方法

##### `listAliases()`

列出配置的别名提供商中的所有邮箱别名。

```typescript
const aliases = await client.listAliases();
// 返回: RelayAlias[]
```

##### `createAlias()`

通过配置的别名提供商创建新的邮箱别名。

```typescript
const alias = await client.createAlias();
// 返回: RelayAlias
console.log(alias.fullAddress); // 例如: "random123@mozmail.com"
```

##### `deleteAlias(id)`

根据 ID 删除别名。

```typescript
await client.deleteAlias(12345);
```

##### `getEmails(aliasAddress?, options?)`

从配置的邮件提供商获取并解析邮件。如果提供了 `aliasAddress`，则只返回发送到该地址的邮件。

```typescript
// 获取所有邮件（默认数量限制）
const allEmails = await client.getEmails();

// 获取指定别名的邮件
const emails = await client.getEmails('alias@mozmail.com', { limit: 10 });

// 分页获取
const page2 = await client.getEmails('alias@mozmail.com', { limit: 10, offset: 10 });
```

选项：

- `limit` - 返回的最大邮件数量（默认: 20）
- `offset` - 分页偏移量，从 0 开始（默认: 0）

## 自定义 Provider

实现 `AliasProvider` 或 `MailProvider` 接口即可接入新服务：

```typescript
import type { AliasProvider, RelayAlias } from '@z_06/relay-temp-mail';

class MyAliasProvider implements AliasProvider {
  async listAliases(): Promise<RelayAlias[]> { /* ... */ }
  async createAlias(): Promise<RelayAlias> { /* ... */ }
  async deleteAlias(id: number): Promise<void> { /* ... */ }
}
```

```typescript
import type { MailProvider, Email } from '@z_06/relay-temp-mail';

class MyMailProvider implements MailProvider {
  async getMails(limit: number, offset: number): Promise<Email[]> { /* ... */ }
}
```

## 错误处理

本包导出了多个错误类，用于处理不同的失败场景：

```typescript
import {
  RelayTempMailError,
  NetworkError,
  AuthError,
  NotFoundError,
  ParseError,
  RateLimitError,
} from '@z_06/relay-temp-mail';

try {
  const alias = await client.createAlias();
} catch (error) {
  if (error instanceof AuthError) {
    console.error('认证失败:', error.message);
  } else if (error instanceof NetworkError) {
    console.error('网络问题:', error.message);
  } else if (error instanceof RateLimitError) {
    console.error('请求过于频繁，请稍后重试:', error.response?.retryAfter);
  } else if (error instanceof RelayTempMailError) {
    console.error('错误:', error.code, error.message);
  }
}
```

### 错误类

| 类名 | 描述 | 状态码 |
|------|------|--------|
| `RelayTempMailError` | 所有包错误的基类 | - |
| `NetworkError` | 网络连接问题 | - |
| `AuthError` | 认证或授权失败 | 401/403 |
| `NotFoundError` | 请求的资源不存在 | 404 |
| `ParseError` | 邮件 MIME 解析失败 | - |
| `RateLimitError` | API 请求频率超限 | 429 |

所有错误类都继承自 `RelayTempMailError`，并提供以下属性：

- `code` - 机器可读的错误代码
- `statusCode` - HTTP 状态码（如适用）
- `response` - API 返回的原始响应数据（如可用）

## TypeScript

所有类型均已导出，包括 Provider 接口：

```typescript
import type {
  AliasProvider,
  MailProvider,
  TempMailConfig,
  FirefoxRelayConfig,
  DuckDuckGoEmailConfig,
  DuckDuckGoAliasStore,
  CFTempMailConfig,
  RelayAlias,
  Email,
  ParsedEmail,
  GetEmailsOptions,
} from '@z_06/relay-temp-mail';
```

## 从 v1 迁移

<details>
<summary>v1 → v2 迁移指南</summary>

**`RelayClient` → `TempMailClient`**

```typescript
// v1（已废弃）
import { RelayClient } from '@z_06/relay-temp-mail';
const client = new RelayClient({
  csrfToken: '...',
  sessionId: '...',
  cfApiUrl: 'https://...',
  cfToken: '...',
});

// v2
import { TempMailClient } from '@z_06/relay-temp-mail';
const client = new TempMailClient({
  aliasProvider: {
    type: 'firefox-relay',
    csrfToken: '...',
    sessionId: '...',
  },
  mailProvider: {
    type: 'cf-temp-mail',
    apiUrl: 'https://...',
    token: '...',
  },
});
```

**`RelayAPIClient` → `FirefoxRelayProvider`**，**`CFEmailClient` → `CFTempMailProvider`**

旧名称仍作为已废弃别名导出。方法签名不变。

</details>

## 许可证

MIT
