import { PrismaClient } from '@prisma/client';
import { loadRootEnv } from '@resolveai/config';

loadRootEnv();
export const prisma = new PrismaClient();
export { PrismaClient } from '@prisma/client';
export * from '@prisma/client';
