import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

// Using environment variables for connection
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  throw new Error('Database configuration is missing. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.')
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  adapter: PrismaLibSQL | undefined
}

// Create or reuse adapter
if (!globalForPrisma.adapter) {
  globalForPrisma.adapter = new PrismaLibSQL({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN
  });
}

// Create Prisma Client with adapter
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient({
    adapter: globalForPrisma.adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

const db = globalForPrisma.prisma;

export { db };
