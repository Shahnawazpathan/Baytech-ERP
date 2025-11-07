import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

// Turso Database Configuration (Hardcoded)
const TURSO_DATABASE_URL = 'libsql://baytech-shahnawazpathan.aws-ap-south-1.turso.io'
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjI0OTM1OTIsImlkIjoiZmJlMjM5MzktYzc4OC00OWQzLWEzYzEtNjU5YTIyZDNhZTBjIiwicmlkIjoiYzNjY2Y4MDctYmVjOS00ZWNmLWJhZDItNzQ1NjkwMjJkZWYwIn0.iONfkGJQnBcIDl0ncthJnRktWkUBNV9sr2km2eKHEgd0UzNtdSE709py9CgA4CDozdEYvQgct90zw4H9pFqSDw'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  libsql: any | undefined
}

// Use Turso with embedded replicas for better Prisma compatibility
// This creates a local cache that syncs with the remote Turso database
const libsql = globalForPrisma.libsql ?? createClient({
  url: 'file:local.db', // Local embedded replica
  syncUrl: TURSO_DATABASE_URL, // Remote Turso database
  authToken: TURSO_AUTH_TOKEN,
  syncInterval: 60, // Sync every 60 seconds
})

// Create Prisma adapter for libsql
const adapter = new PrismaLibSQL(libsql)

// Initialize Prisma Client with Turso adapter
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: [],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
  globalForPrisma.libsql = libsql
}