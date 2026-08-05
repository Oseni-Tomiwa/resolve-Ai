import { createReadStream, promises as fs } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

export interface Storage {
  save(key: string, contents: Buffer, metadata?: Record<string, string>): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  stream(key: string): NodeJS.ReadableStream;
}

export class LocalStorage implements Storage {
  private readonly root: string;
  constructor(root = process.env.KNOWLEDGE_STORAGE_DIR ?? resolve(process.cwd(), '../../storage')) { this.root = resolve(root); }
  private safePath(key: string): string { const path = resolve(this.root, key); if (path !== this.root && !path.startsWith(this.root + sep)) throw new Error('Invalid storage key'); return path; }
  async save(key: string, contents: Buffer): Promise<void> { const path = this.safePath(key); await fs.mkdir(dirname(path), { recursive: true }); await fs.writeFile(path, contents, { flag: 'wx' }); }
  async read(key: string): Promise<Buffer> { return fs.readFile(this.safePath(key)); }
  async delete(key: string): Promise<void> { await fs.rm(this.safePath(key), { force: true }); }
  async exists(key: string): Promise<boolean> { try { await fs.access(this.safePath(key)); return true; } catch { return false; } }
  stream(key: string): NodeJS.ReadableStream { return createReadStream(this.safePath(key)); }
}

export type S3StorageOptions = { endpoint?: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string; forcePathStyle?: boolean };
export class S3Storage implements Storage {
  private readonly client: S3Client;
  constructor(private readonly options: S3StorageOptions) {
    this.client = new S3Client({ region: options.region, endpoint: options.endpoint, forcePathStyle: options.forcePathStyle ?? Boolean(options.endpoint), credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey } });
  }
  async save(key: string, contents: Buffer, metadata?: Record<string, string>): Promise<void> { await this.client.send(new PutObjectCommand({ Bucket: this.options.bucket, Key: key, Body: contents, Metadata: metadata })); }
  async read(key: string): Promise<Buffer> { const result = await this.client.send(new GetObjectCommand({ Bucket: this.options.bucket, Key: key })); if (!result.Body) throw new Error('Object storage returned an empty body'); return Buffer.from(await result.Body.transformToByteArray()); }
  async delete(key: string): Promise<void> { await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key })); }
  async exists(key: string): Promise<boolean> { try { await this.client.send(new HeadObjectCommand({ Bucket: this.options.bucket, Key: key })); return true; } catch { return false; } }
  stream(_key: string): NodeJS.ReadableStream { throw new Error('Streaming S3 objects is not supported by this adapter; use read()'); }
}

export function createStorageFromEnv(env: Record<string, string | undefined> = process.env): Storage {
  if (env.NODE_ENV === 'production' && env.STORAGE_PROVIDER !== 's3') {
    throw new Error('Production storage requires STORAGE_PROVIDER=s3');
  }
  if (env.STORAGE_PROVIDER !== 's3') return new LocalStorage(env.KNOWLEDGE_STORAGE_DIR);
  if (!env.S3_BUCKET || !env.S3_REGION || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) throw new Error('S3 storage is not configured');
  return new S3Storage({ endpoint: env.S3_ENDPOINT, region: env.S3_REGION, bucket: env.S3_BUCKET, accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY });
}
