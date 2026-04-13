# relay-temp-mail

[English](README.md) | [中文](README.zh-CN.md)

一个用于管理邮箱别名和接收临时邮件的 TypeScript/JavaScript 包。支持多种提供者，包括 Firefox Relay、SimpleLogin、DuckDuckGo Email Protection、CloudFlare Temp Mail 和 Gmail。

## 功能特性

- **基于提供者的架构** - 灵活的别名提供者和邮件提供者组合
- **Firefox Relay 集成** - 创建、列出和删除邮箱别名
- **SimpleLogin 集成** - 创建、列出和删除邮箱别名
- **DuckDuckGo Email Protection** - 创建带本地存储的邮箱别名
- **CloudFlare Temp Mail** - 通过 API 检索和解析邮件
- **Gmail 集成** - 通过 Gmail API 检索邮件，支持 OAuth2
- **TypeScript 支持** - 所有 API 都有完整的类型定义
- **ESM + CommonJS 支持** - 兼容两种模块系统
- **可扩展** - 通过实现标准接口添加自定义提供者

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

## 提供者

| 类型 | 类别 | 描述 | 功能 |
|------|------|------|------|
| `firefox-relay` | 别名提供者 | Firefox Relay 邮箱别名 | 创建、列出、删除别名 |
| `simplelogin` | 别名提供者 | SimpleLogin 邮箱别名 | 创建、列出、删除别名 |
| `duckduckgo` | 别名提供者 | DuckDuckGo 邮箱保护 | 创建带本地存储的别名 |
| `cf-temp-mail` | 邮件提供者 | CloudFlare 临时邮箱 | 通过 API 检索和解析邮件 |
| `gmail` | 邮件提供者 | Gmail 邮箱 | 通过 Gmail API 检索邮件，支持 OAuth2 |

## 配置

### Firefox Relay Token

获取 `csrfToken` 和 `sessionId` 的方法：

1. 登录 [relay.firefox.com](https://relay.firefox.com)
2. 打开浏览器开发者工具 (F12)
3. 切换到 Application/Storage 标签页
4. 找到 `relay.firefox.com` 的 Cookies
5. 复制 `csrftoken` 和 `sessionid` 的值

### SimpleLogin Token

获取 API Key 的方法：

1. 登录 [simplelogin.io](https://simplelogin.io)
2. 进入设置页面
3. 生成新的 API Key

### DuckDuckGo Email Protection Token

获取 JWT Token 的方法：

1. 安装 DuckDuckGo 浏览器扩展
2. 开启 Email Protection
3. 从扩展中提取 JWT Token

### CF 临时邮箱

本项目使用 [cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email) 作为临时邮箱后端，你需要先部署该服务才能使用。

#### 快速部署步骤

1. **Fork 仓库**
   - 访问 [cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email)
   - 点击右上角 "Fork" 按钮，将仓库复制到你的 GitHub 账户

2. **一键部署到 Cloudflare**
   - 点击仓库 README 中的 "Deploy to Cloudflare Workers" 按钮
   - 或参考[部署文档](https://temp-mail-docs.awsl.uk)进行手动部署

3. **配置域名和邮件路由**
   - 在 Cloudflare Dashboard 中添加你的域名
   - 配置 Email Routing（邮件路由）
   - 创建 catch-all 规则将所有邮件转发到 Worker

4. **获取 API 地址和 Token**
   - 部署完成后，你的 API 地址格式为：`https://<你的worker名称>.<你的子域>.workers.dev`
   - 登录前端界面（部署后会有 Pages 地址）
   - 在用户设置或 Admin 后台生成 API Token
   - 将 API 地址和 Token 填入配置

### Gmail OAuth2

配置 Gmail 提供者需要 OAuth2 凭证：

```typescript
const client = new TempMailClient({
  aliasProvider: {
    type: 'firefox-relay',
    csrfToken: '...',
    sessionId: '...',
  },
  mailProvider: {
    type: 'gmail',
    userId: 'me',
    accessToken: 'your-access-token',
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    refreshToken: 'your-refresh-token',
  },
});
```

## API 文档

### TempMailClient

用于与别名提供者和邮件提供者交互的主类。

#### 构造函数选项

```typescript
interface TempMailConfig {
  aliasProvider: AliasProviderConfig;  // 别名提供者配置
  mailProvider: MailProviderConfig;    // 邮件提供者配置
  timeout?: number;                     // 请求超时时间，毫秒（默认: 30000）
}
```

#### 方法

##### `listAliases()`

列出所有邮箱别名。

```typescript
const aliases = await client.listAliases();
// 返回: RelayAlias[]
```

##### `createAlias()`

创建一个新的随机邮箱别名。

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

检索和解析邮件。如果提供了 `aliasAddress`，则只返回发送到该地址的邮件。

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

## 自定义提供者

你可以通过实现标准接口来创建自定义提供者：

```typescript
import type { AliasProvider, RelayAlias } from '@z_06/relay-temp-mail';

class MyCustomAliasProvider implements AliasProvider {
  async listAliases(): Promise<RelayAlias[]> {
    // 实现列出别名逻辑
  }

  async createAlias(): Promise<RelayAlias> {
    // 实现创建别名逻辑
  }

  async deleteAlias(id: number): Promise<void> {
    // 实现删除别名逻辑
  }
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
    console.error('Relay 错误:', error.code, error.message);
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
| `RateLimitError` | API 请求频率限制超出 | 429 |

所有错误类都继承自 `RelayTempMailError`，并提供以下属性：

- `code` - 机器可读的错误代码
- `statusCode` - HTTP 状态码（如适用）
- `response` - API 返回的原始响应数据（如可用）

## TypeScript

所有类型都已导出，可在 TypeScript 项目中使用：

```typescript
import type {
  TempMailConfig,
  AliasProviderConfig,
  MailProviderConfig,
  FirefoxRelayConfig,
  SimpleLoginConfig,
  DuckDuckGoConfig,
  CFTempMailConfig,
  GmailConfig,
  RelayAlias,
  Email,
  ParsedEmail,
  ListAliasesOptions,
  GetEmailsOptions,
} from '@z_06/relay-temp-mail';
```

本包使用严格的 TypeScript 设置构建，为所有 API 提供全面的类型定义。

## 从 v1 迁移

v2 引入了基于提供者的架构。以下是迁移指南：

### v1 代码（已废弃）

```typescript
import { RelayClient } from '@z_06/relay-temp-mail';

const client = new RelayClient({
  csrfToken: '...',
  sessionId: '...',
  cfApiUrl: '...',
  cfToken: '...',
});
```

### v2 代码（推荐）

```typescript
import { TempMailClient } from '@z_06/relay-temp-mail';

const client = new TempMailClient({
  aliasProvider: {
    type: 'firefox-relay',
    csrfToken: '...',
    sessionId: '...',
  },
  mailProvider: {
    type: 'cf-temp-mail',
    apiUrl: '...',
    token: '...',
  },
});
```

### 主要变化

1. **新类名**: `TempMailClient` 替换了 `RelayClient`（`RelayClient` 仍然可用但已标记为废弃）
2. **配置结构**: 从扁平配置改为分层的提供者配置
3. **更多选择**: 现在支持 SimpleLogin、DuckDuckGo 和 Gmail 作为替代提供者

## 许可证

MIT
