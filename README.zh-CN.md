# relay-temp-mail

[English](README.md) | [中文](README.zh-CN.md)

一个用于管理 Firefox Relay 邮箱别名和通过 Cloudflare 临时邮箱 API 接收邮件的 TypeScript/JavaScript 包。

## 功能特性

- **创建 Firefox Relay 别名** - 按需生成新的邮箱别名
- **列出已有别名** - 查看所有已配置的邮箱别名
- **获取指定别名的邮件** - 获取并解析发送到特定地址的邮件
- **删除别名** - 以编程方式清理未使用的别名
- **TypeScript 支持** - 所有 API 都有完整的类型定义
- **支持 ESM + CommonJS** - 兼容两种模块系统

## 安装

```bash
npm install relay-temp-mail
# 或
pnpm add relay-temp-mail
# 或
bun add relay-temp-mail
```

## 快速开始

```typescript
import { RelayClient } from 'relay-temp-mail';

const client = new RelayClient({
  csrfToken: 'your-csrf-token',
  sessionId: 'your-session-id',
  cfApiUrl: 'https://your-cf-api.com',
  cfToken: 'your-cf-token',
});

// 创建新别名
const alias = await client.createAlias();
console.log('新别名:', alias.fullAddress);

// 列出所有别名
const aliases = await client.listAliases();

// 获取指定别名的邮件
const emails = await client.getEmails(alias.fullAddress, { limit: 10 });
```

## 配置

### Firefox Relay Token

获取 `csrfToken` 和 `sessionId` 的方法：

1. 登录 [relay.firefox.com](https://relay.firefox.com)
2. 打开浏览器开发者工具 (F12)
3. 切换到 Application/Storage 标签页
4. 找到 `relay.firefox.com` 的 Cookies
5. 复制 `csrftoken` 和 `sessionid` 的值

### CF 临时邮箱

本项目使用 [cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email) 作为临时邮箱后端，你需要先部署该服务才能使用。

#### 快速部署步骤

1. **Fork 仓库**
   - 访问 [cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email)
   - 点击右上角 "Fork" 按钮，将仓库复制到你的 GitHub 账户

2. **一键部署到 Cloudflare**
   - 点击仓库 README 中的 "Deploy to Cloudflare Workers" 按钮
   - 或参考 [部署文档](https://temp-mail-docs.awsl.uk) 进行手动部署

3. **配置域名和邮件路由**
   - 在 Cloudflare Dashboard 中添加你的域名
   - 配置 Email Routing（邮件路由）
   - 创建 catch-all 规则将所有邮件转发到 Worker

4. **获取 API 地址和 Token**
   - 部署完成后，你的 API 地址格式为：`https://<你的worker名称>.<你的子域>.workers.dev`
   - 登录前端界面（部署后会有 Pages 地址）
   - 在用户设置或 Admin 后台生成 API Token
   - 将 API 地址和 Token 填入 `RelayClient` 配置

#### 获取 `cfApiUrl` 和 `cfToken`

```typescript
const client = new RelayClient({
  csrfToken: 'your-csrf-token',
  sessionId: 'your-session-id',
  cfApiUrl: 'https://your-worker-name.your-subdomain.workers.dev', // CF Worker API 地址
  cfToken: 'your-api-token', // 在 Admin 后台或用户设置中生成
});
```

更多详细配置请参考 [cloudflare_temp_email 官方文档](https://temp-mail-docs.awsl.uk)。

## API 文档

### RelayClient

用于与 Firefox Relay 和 Cloudflare 临时邮箱服务交互的主类。

#### 构造函数选项

```typescript
interface RelayConfig {
  csrfToken: string;    // Firefox Relay CSRF token
  sessionId: string;    // Firefox Relay session ID
  cfApiUrl: string;     // Cloudflare 临时邮箱 API 地址
  cfToken: string;      // Cloudflare API token
  timeout?: number;     // 请求超时时间，毫秒（默认: 30000）
}
```

#### 方法

##### `listAliases()`

列出所有 Firefox Relay 邮箱别名。

```typescript
const aliases = await client.listAliases();
// 返回: RelayAlias[]
```

##### `createAlias()`

创建一个新的随机 Firefox Relay 邮箱别名。

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

从 Cloudflare 临时邮箱 API 检索和解析邮件。如果提供了 `aliasAddress`，则只返回发送到该地址的邮件。

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
} from 'relay-temp-mail';

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
| `RateLimitError` | API 请求频率限制 exceeded | 429 |

所有错误类都继承自 `RelayTempMailError`，并提供以下属性：

- `code` - 机器可读的错误代码
- `statusCode` - HTTP 状态码（如适用）
- `response` - API 返回的原始响应数据（如可用）

## TypeScript

所有类型都已导出，可在 TypeScript 项目中使用：

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

本包使用严格的 TypeScript 设置构建，为所有 API 提供全面的类型定义。

## 许可证

MIT
