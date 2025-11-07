import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  libsql: any | undefined
}

// Lazy initialization function
function initializePrisma(): PrismaClient {
  if (typeof window !== 'undefined') {
    throw new Error('Prisma Client cannot be used in the browser')
  }

  // Return cached instance if already initialized
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  // Dynamically import to avoid bundling issues
  const { PrismaLibSQL } = require('@prisma/adapter-libsql')
  const { createClient } = require('@libsql/client/http')

  // Use direct Turso HTTP connection with hardcoded credentials (no native bindings needed)
  const libsql = globalForPrisma.libsql ?? createClient({
    url: process.env.TURSO_DATABASE_URL || 'libsql://baytech-shahnawazpathan.aws-ap-south-1.turso.io',
    authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjI0OTM1OTIsImlkIjoiZmJlMjM5MzktYzc4OC00OWQzLWEzYzEtNjU5YTIyZDNhZTBjIiwicmlkIjoiYzNjY2Y4MDctYmVjOS00ZWNmLWJhZDItNzQ1NjkwMjJkZWYwIn0.iONfkGJQnBcIDl0ncthJnRktWkUBNV9sr2km2eKHEgd0UzNtdSE709py9CgA4CDozdEYvQgct90zw4H9pFqSDw',
  })

  // Create Prisma adapter for libsql
  const adapter = new PrismaLibSQL(libsql)

  // Initialize Prisma Client with Turso adapter
  const client = new PrismaClient({
    adapter,
    log: [],
  })

  // Cache for reuse
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.libsql = libsql
    globalForPrisma.prisma = client
  }

  return client
}

// Export proxy that initializes on first access (truly lazy)
export const db = new Proxy({} as PrismaClient, {
  get(target, prop) {
    const client = initializePrisma()
    return client[prop as keyof PrismaClient]
  },
})