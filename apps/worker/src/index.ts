import { Worker } from 'bullmq';
const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };
const worker = new Worker('resolveai', async (job) => { console.info(JSON.stringify({ event: 'job.completed', jobId: job.id, name: job.name })); }, { connection });
worker.on('failed', (job, error) => console.error(JSON.stringify({ event: 'job.failed', jobId: job?.id, error: error.message })));
console.info('ResolveAI worker ready');
