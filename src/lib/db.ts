import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

// Hardcoded Turso connection (requested: avoid .env usage)
const TURSO_DATABASE_URL = 'libsql://database-baytech-village-vercel-icfg-onrrmbslrj4je1pg81gzocha.aws-ap-south-1.turso.io'
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjQ3Njc0MjQsImlkIjoiMTc3ODU2NTYtYjZjNS00M2YwLTgyNjktMWY5MDAyYzQ4YWFhIiwicmlkIjoiMGU1NGNmM2MtZjQwMS00ZjUyLThkYmMtN2MyYjhkZmM2OThlIn0.Uw065oL8CPxkOmVPFMY-Qdf0k8eeNY06Cf2zREQrhpiudbQEfO1dk5YYKeY5fBASqusy8dfybrf8_APe7g4qBQ'

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
