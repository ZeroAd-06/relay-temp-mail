// 测试 DuckDuckGo + CF TempMail 配置下是否有 Base URL 错误
import { TempMailClient } from './dist/index.js';

const client = new TempMailClient({
  aliasProvider: {
    type: 'duckduckgo',
    jwtToken: 'nfsr8ebqkrp9otiokcyxrcyfnitlmcuusxqktbk5orpstvfjydl0uns6qep0mu',
  },
  mailProvider: {
    type: 'cf-temp-mail',
    apiUrl: 'https://temp-email-api.wwwwwwwwwwwwedlihgt.dpdns.org/',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoidG1wZHVja2R1Y2sxQHd3d3d3d3d3d3d3d2VkbGloZ3QuZHBkbnMub3JnIiwiYWRkcmVzc19pZCI6MjA4fQ.Boh3DImmDwuTUFm2KEcBjbzVktASHQ7S_9Hy-gVUv2I',
  },
});

console.log('Testing DuckDuckGo + CF TempMail configuration...\n');

let alias;

// 1. 测试创建别名
try {
  console.log('Step 1: Creating alias via DuckDuckGo...');
  alias = await client.createAlias();
  console.log('✓ Alias created successfully:');
  console.log('  - ID:', alias.id);
  console.log('  - Address:', alias.fullAddress);
} catch (error) {
  console.error('✗ Failed to create alias:');
  console.error('  Error:', error.message);
  console.error('  Code:', error.code);
  console.error('  Stack:', error.stack);
  process.exit(1);
}

console.log('\nStep 2: Waiting for 2 seconds...');
await new Promise(resolve => setTimeout(resolve, 2000));

// 2. 发送一封测试邮件到刚才创建的别名
try {
  console.log('\nStep 3: Sending test email to the alias...');
  const response = await fetch('https://www.codeflicker.ai/api/auth/email/send-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: alias.fullAddress }),
  });
  console.log('  Send email response status:', response.status);
} catch (error) {
  console.error('  Note: Email sending failed (may be expected):', error.message);
}

console.log('\nStep 4: Waiting for 3 seconds for email to arrive...');
await new Promise(resolve => setTimeout(resolve, 3000));

// 3. 测试获取邮件
try {
  console.log('\nStep 5: Getting emails from CF TempMail...');
  const emails = await client.getEmails(alias.fullAddress, { limit: 10 });
  console.log('✓ Emails retrieved successfully:');
  console.log('  Count:', emails.length);
  if (emails.length > 0) {
    console.log('  First email subject:', emails[0].subject);
  }
} catch (error) {
  console.error('✗ Failed to get emails:');
  console.error('  Error:', error.message);
  console.error('  Code:', error.code);
  console.error('  Stack:', error.stack);
  process.exit(1);
}

console.log('\n✓ All tests passed! No base URL bug detected.');
