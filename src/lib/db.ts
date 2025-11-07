import 'dotenv/config'; // Load environment variables first
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

console.log('Loading src/lib/db.ts');
console.log('TURSO_DATABASE_URL:', process.env.TURSO_DATABASE_URL);
console.log('TURSO_AUTH_TOKEN:', process.env.TURSO_AUTH_TOKEN ? 'Set' : 'Not set');

// Validate environment variables
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in environment variables');
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  adapter: PrismaLibSQL | undefined
}

// Create or reuse adapter
if (!globalForPrisma.adapter) {
  console.log('Creating new LibSQL adapter...');
  globalForPrisma.adapter = new PrismaLibSQL({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
}

// Create Prisma Client with adapter
if (!globalForPrisma.prisma) {
  console.log('Creating new Prisma client...');
  globalForPrisma.prisma = new PrismaClient({
    adapter: globalForPrisma.adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : [],
  });
}

const db = globalForPrisma.prisma;

export { db };