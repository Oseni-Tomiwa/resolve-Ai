const { config } = require('dotenv');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const envFilePath = resolve(__dirname, '../../../.env');
config({ path: envFilePath, override: false });
console.info(JSON.stringify({ event: 'prisma.environment', cwd: process.cwd(), envFilePath, databaseUrlConfigured: Boolean(process.env.DATABASE_URL), nodeEnv: process.env.NODE_ENV ?? 'undefined' }));

const prismaBinary = resolve(__dirname, '../node_modules/.bin/prisma');
const result = spawnSync(prismaBinary, process.argv.slice(2), { env: process.env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
