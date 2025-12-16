-- Fix lastName column to allow NULL values in Turso database
-- Run this using: turso db shell <your-db-name> < fix-lastname-nullable.sql

-- SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table
-- But first, let's check if lastName is already nullable

-- Create a backup of leads table (optional but recommended)
CREATE TABLE IF NOT EXISTS leads_backup AS SELECT * FROM leads;

-- Step 1: Create new leads table with correct schema
CREATE TABLE leads_new (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadNumber" TEXT NOT NULL UNIQUE,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,  -- This is now nullable
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "loanAmount" REAL,
    "propertyType" TEXT,
    "propertyValue" REAL,
    "creditScore" INTEGER,
    "income" REAL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assignedToId" TEXT,
    "companyId" TEXT NOT NULL,
    "notes" TEXT,
    "tags" TEXT,
    "metadata" TEXT,
    "assignedAt" DATETIME,
    "contactedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("assignedToId") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Step 2: Copy all data from old table to new table
INSERT INTO leads_new SELECT * FROM leads;

-- Step 3: Drop old table
DROP TABLE leads;

-- Step 4: Rename new table to leads
ALTER TABLE leads_new RENAME TO leads;

-- Step 5: Recreate indexes
CREATE UNIQUE INDEX "leads_leadNumber_key" ON "leads"("leadNumber");
CREATE INDEX "leads_assignedToId_idx" ON "leads"("assignedToId");
CREATE INDEX "leads_status_idx" ON "leads"("status");
CREATE INDEX "leads_priority_idx" ON "leads"("priority");
CREATE INDEX "leads_companyId_idx" ON "leads"("companyId");
CREATE INDEX "leads_companyId_status_idx" ON "leads"("companyId", "status");
CREATE INDEX "leads_companyId_priority_idx" ON "leads"("companyId", "priority");
CREATE INDEX "leads_assignedToId_status_createdAt_idx" ON "leads"("assignedToId", "status", "createdAt");
CREATE INDEX "leads_companyId_status_assignedToId_idx" ON "leads"("companyId", "status", "assignedToId");
CREATE INDEX "leads_companyId_createdAt_idx" ON "leads"("companyId", "createdAt");
CREATE INDEX "leads_assignedToId_contactedAt_idx" ON "leads"("assignedToId", "contactedAt");
CREATE INDEX "leads_status_assignedAt_idx" ON "leads"("status", "assignedAt");
CREATE INDEX "leads_status_assignedAt_createdAt_idx" ON "leads"("status", "assignedAt", "createdAt");
CREATE INDEX "leads_companyId_assignedToId_status_idx" ON "leads"("companyId", "assignedToId", "status");
CREATE INDEX "leads_isActive_status_priority_idx" ON "leads"("isActive", "status", "priority");

-- Verify the change
SELECT sql FROM sqlite_master WHERE type='table' AND name='leads';
