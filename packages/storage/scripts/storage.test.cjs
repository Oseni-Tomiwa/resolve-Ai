const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { LocalStorage, createStorageFromEnv } = require('../dist/index.js');

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'resolveai-storage-'));
  const storage = new LocalStorage(root);
  await storage.save('workspace/document.txt', Buffer.from('hello'));
  assert.equal(await storage.exists('workspace/document.txt'), true);
  assert.equal((await storage.read('workspace/document.txt')).toString(), 'hello');
  await assert.rejects(() => storage.save('../outside.txt', Buffer.from('blocked')), /Invalid storage key/);
  await storage.delete('workspace/document.txt');
  assert.equal(await storage.exists('workspace/document.txt'), false);
  assert.equal(createStorageFromEnv({ NODE_ENV: 'development', STORAGE_PROVIDER: 'local', KNOWLEDGE_STORAGE_DIR: root }) instanceof LocalStorage, true);
  assert.throws(() => createStorageFromEnv({ NODE_ENV: 'production', STORAGE_PROVIDER: 'local', KNOWLEDGE_STORAGE_DIR: root }), /Production storage requires/);
  await fs.rm(root, { recursive: true, force: true });
  console.log('storage tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
