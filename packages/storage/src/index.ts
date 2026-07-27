import { createReadStream, promises as fs } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

export interface Storage {
  save(key: string, contents: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  stream(key: string): NodeJS.ReadableStream;
}

export class LocalStorage implements Storage {
  private readonly root: string;
  constructor(root = process.env.KNOWLEDGE_STORAGE_DIR ?? resolve(process.cwd(), '../../storage')) { this.root = resolve(root); }
  private safePath(key: string): string { const path = resolve(this.root, key); if (path !== this.root && !path.startsWith(`${this.root}${sep}`)) throw new Error('Invalid storage key'); return path; }
  async save(key: string, contents: Buffer): Promise<void> { const path = this.safePath(key); await fs.mkdir(dirname(path), { recursive: true }); await fs.writeFile(path, contents, { flag: 'wx' }); }
  async read(key: string): Promise<Buffer> { return fs.readFile(this.safePath(key)); }
  async delete(key: string): Promise<void> { await fs.rm(this.safePath(key), { force: true }); }
  async exists(key: string): Promise<boolean> { try { await fs.access(this.safePath(key)); return true; } catch { return false; } }
  stream(key: string): NodeJS.ReadableStream { return createReadStream(this.safePath(key)); }
}
