import 'server-only'

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  libsql: any | undefined
}

// Lazy initialization function
function initializePrisma() {
  if (typeof window !== 'undefined') {
    throw new Error('Prisma Client cannot be used in the browser')
  }

  // Turso Database Configuration (Evaluated at runtime with hardcoded fallbacks)
  const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || 'libsql://baytech-shahnawazpathan.aws-ap-south-1.turso.io'
  const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjI0OTM1OTIsImlkIjoiZmJlMjM5MzktYzc4OC00OWQzLWEzYzEtNjU5YTIyZDNhZTBjIiwicmlkIjoiYzNjY2Y4MDctYmVjOS00ZWNmLWJhZDItNzQ1NjkwMjJkZWYwIn0.iONfkGJQnBcIDl0ncthJnRktWkUBNV9sr2km2eKHEgd0UzNtdSE709py9CgA4CDozdEYvQgct90zw4H9pFqSDw'

  // Dynamically import to avoid bundling issues
  const { PrismaLibSQL } = require('@prisma/adapter-libsql')
  const { createClient } = require('@libsql/client/http')

  // Use direct Turso HTTP connection (no native bindings needed)
  const libsql = globalForPrisma.libsql ?? createClient({
    url: TURSO_DATABASE_URL, // Direct remote connection via HTTP
    authToken: TURSO_AUTH_TOKEN,
  })

  // Create Prisma adapter for libsql
  const adapter = new PrismaLibSQL(libsql)

  // Initialize Prisma Client with Turso adapter
  const client = new PrismaClient({
    adapter,
    log: [],
  })

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.libsql = libsql
  }

  return client
}

// Export lazy-initialized db
export const db = globalForPrisma.prisma ?? initializePrisma()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}