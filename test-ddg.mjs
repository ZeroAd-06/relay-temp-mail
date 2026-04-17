import { TempMailClient } from './dist/index.js';

const client = new TempMailClient({
  aliasProvider: {
    type: 'duckduckgo-email',
    jwtToken: 'dc4j1bvj2gg1toqxem3c7ngpn0sqkpcbnj49q9qiwwmwlltq1prxsod9odtp2w',
  },
  mailProvider: {
    type: 'cf-temp-mail',
    apiUrl: 'https://temp-email-api.wwwwwwwwwwwwedlihgt.dpdns.org',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoidG1wZHVja2R1Y2sxQHd3d3d3d3d3d3d3d2VkbGloZ3QuZHBkbnMub3JnIiwiYWRkcmVzc19pZCI6MjA4fQ.Boh3DImmDwuTUFm2KEcBjbzVktASHQ7S_9Hy-gVUv2I',
  },
});

// Step 1: Create a DuckDuckGo alias
console.log('Creating DuckDuckGo alias...');
const alias = await client.createAlias();
console.log('Created alias:', alias.fullAddress);

// Step 2: Send a test email via codeflicker
console.log('\nSending test email to', alias.fullAddress);
const sendRes = await fetch('https://www.codeflicker.ai/api/auth/email/send-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: alias.fullAddress }),
});
console.log('Send response:', sendRes.status, await sendRes.text());

// Step 3: Wait for the email to arrive
console.log('\nWaiting 10s for email to arrive...');
await new Promise(r => setTimeout(r, 10000));

// Step 4: Check emails
console.log('\nFetching emails for', alias.fullAddress);
const emails = await client.getEmails(alias.fullAddress, { limit: 5 });
console.log(`Found ${emails.length} email(s)`);
for (const e of emails) {
  console.log('---');
  console.log('From:', e.source);
  console.log('To:', e.address);
  console.log('RelayAlias:', e.relayAlias);
  console.log('Subject:', e.raw.match(/Subject:\s*(.+)/)?.[1] || '(none)');
}

// Step 5: List all aliases
console.log('\nAll stored aliases:');
const allAliases = await client.listAliases();
for (const a of allAliases) {
  console.log(`  [${a.id}] ${a.fullAddress} (created: ${a.createdAt})`);
}
