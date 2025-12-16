-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "automation_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "automation_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "automation_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "leadId" TEXT,
    "employeeId" TEXT,
    "status" TEXT NOT NULL,
    "result" TEXT,
    "error" TEXT,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "automation_executions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "automation_executions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "automation_executions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "automation_rules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "slas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "targetTime" INTEGER NOT NULL,
    "warningTime" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "slas_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sla_violations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slaId" TEXT NOT NULL,
    "leadId" TEXT,
    "taskId" TEXT,
    "employeeId" TEXT,
    "companyId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "dueTime" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    "violatedAt" DATETIME,
    "isViolated" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sla_violations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sla_violations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sla_violations_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sla_violations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sla_violations_slaId_fkey" FOREIGN KEY ("slaId") REFERENCES "slas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "email_sequences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "conditions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "email_sequences_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "email_sequences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "email_sequence_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequenceId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "delayHours" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "email_sequence_steps_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "email_sequences" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "email_sequence_enrollments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequenceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "pausedAt" DATETIME,
    CONSTRAINT "email_sequence_enrollments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "email_sequence_enrollments_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "email_sequences" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sent_emails" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stepId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "bodyText" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" DATETIME,
    "clickedAt" DATETIME,
    "error" TEXT,
    CONSTRAINT "sent_emails_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sent_emails_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "email_sequence_steps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "follow_up_reminders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "notes" TEXT,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "follow_up_reminders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "follow_up_reminders_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "follow_up_reminders_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
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
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "leads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_leads" ("address", "assignedAt", "assignedToId", "companyId", "contactedAt", "createdAt", "creditScore", "email", "firstName", "id", "income", "isActive", "lastName", "leadNumber", "loanAmount", "metadata", "notes", "phone", "priority", "propertyType", "propertyValue", "source", "status", "tags", "updatedAt") SELECT "address", "assignedAt", "assignedToId", "companyId", "contactedAt", "createdAt", "creditScore", "email", "firstName", "id", "income", "isActive", "lastName", "leadNumber", "loanAmount", "metadata", "notes", "phone", "priority", "propertyType", "propertyValue", "source", "status", "tags", "updatedAt" FROM "leads";
DROP TABLE "leads";
ALTER TABLE "new_leads" RENAME TO "leads";
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
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "automation_rules_companyId_isActive_idx" ON "automation_rules"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "automation_rules_trigger_isActive_idx" ON "automation_rules"("trigger", "isActive");

-- CreateIndex
CREATE INDEX "automation_executions_ruleId_executedAt_idx" ON "automation_executions"("ruleId", "executedAt");

-- CreateIndex
CREATE INDEX "automation_executions_leadId_executedAt_idx" ON "automation_executions"("leadId", "executedAt");

-- CreateIndex
CREATE INDEX "automation_executions_status_executedAt_idx" ON "automation_executions"("status", "executedAt");

-- CreateIndex
CREATE INDEX "slas_companyId_isActive_idx" ON "slas"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "slas_entityType_isActive_idx" ON "slas"("entityType", "isActive");

-- CreateIndex
CREATE INDEX "sla_violations_slaId_isViolated_idx" ON "sla_violations"("slaId", "isViolated");

-- CreateIndex
CREATE INDEX "sla_violations_leadId_isViolated_idx" ON "sla_violations"("leadId", "isViolated");

-- CreateIndex
CREATE INDEX "sla_violations_companyId_dueTime_idx" ON "sla_violations"("companyId", "dueTime");

-- CreateIndex
CREATE INDEX "sla_violations_isViolated_dueTime_idx" ON "sla_violations"("isViolated", "dueTime");

-- CreateIndex
CREATE INDEX "email_sequences_companyId_isActive_idx" ON "email_sequences"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "email_sequences_trigger_isActive_idx" ON "email_sequences"("trigger", "isActive");

-- CreateIndex
CREATE INDEX "email_sequence_steps_sequenceId_stepNumber_idx" ON "email_sequence_steps"("sequenceId", "stepNumber");

-- CreateIndex
CREATE UNIQUE INDEX "email_sequence_steps_sequenceId_stepNumber_key" ON "email_sequence_steps"("sequenceId", "stepNumber");

-- CreateIndex
CREATE INDEX "email_sequence_enrollments_sequenceId_status_idx" ON "email_sequence_enrollments"("sequenceId", "status");

-- CreateIndex
CREATE INDEX "email_sequence_enrollments_leadId_status_idx" ON "email_sequence_enrollments"("leadId", "status");

-- CreateIndex
CREATE INDEX "email_sequence_enrollments_status_enrolledAt_idx" ON "email_sequence_enrollments"("status", "enrolledAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_sequence_enrollments_sequenceId_leadId_key" ON "email_sequence_enrollments"("sequenceId", "leadId");

-- CreateIndex
CREATE INDEX "sent_emails_stepId_sentAt_idx" ON "sent_emails"("stepId", "sentAt");

-- CreateIndex
CREATE INDEX "sent_emails_leadId_sentAt_idx" ON "sent_emails"("leadId", "sentAt");

-- CreateIndex
CREATE INDEX "sent_emails_status_sentAt_idx" ON "sent_emails"("status", "sentAt");

-- CreateIndex
CREATE INDEX "sent_emails_toEmail_idx" ON "sent_emails"("toEmail");

-- CreateIndex
CREATE INDEX "follow_up_reminders_leadId_status_idx" ON "follow_up_reminders"("leadId", "status");

-- CreateIndex
CREATE INDEX "follow_up_reminders_employeeId_status_dueDate_idx" ON "follow_up_reminders"("employeeId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "follow_up_reminders_companyId_dueDate_idx" ON "follow_up_reminders"("companyId", "dueDate");

-- CreateIndex
CREATE INDEX "follow_up_reminders_status_dueDate_idx" ON "follow_up_reminders"("status", "dueDate");

-- CreateIndex
CREATE INDEX "follow_up_reminders_dueDate_status_idx" ON "follow_up_reminders"("dueDate", "status");

-- CreateIndex
CREATE INDEX "attendance_employeeId_idx" ON "attendance"("employeeId");

-- CreateIndex
CREATE INDEX "attendance_companyId_idx" ON "attendance"("companyId");

-- CreateIndex
CREATE INDEX "attendance_checkInTime_idx" ON "attendance"("checkInTime");

-- CreateIndex
CREATE INDEX "attendance_companyId_checkInTime_idx" ON "attendance"("companyId", "checkInTime");

-- CreateIndex
CREATE INDEX "attendance_employeeId_checkInTime_idx" ON "attendance"("employeeId", "checkInTime");

-- CreateIndex
CREATE INDEX "attendance_status_idx" ON "attendance"("status");

-- CreateIndex
CREATE INDEX "attendance_companyId_status_idx" ON "attendance"("companyId", "status");

-- CreateIndex
CREATE INDEX "attendance_companyId_employeeId_checkInTime_idx" ON "attendance"("companyId", "employeeId", "checkInTime");

-- CreateIndex
CREATE INDEX "attendance_employeeId_status_idx" ON "attendance"("employeeId", "status");

-- CreateIndex
CREATE INDEX "attendance_companyId_status_checkInTime_idx" ON "attendance"("companyId", "status", "checkInTime");

-- CreateIndex
CREATE INDEX "employees_companyId_idx" ON "employees"("companyId");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE INDEX "employees_departmentId_idx" ON "employees"("departmentId");

-- CreateIndex
CREATE INDEX "employees_roleId_idx" ON "employees"("roleId");

-- CreateIndex
CREATE INDEX "employees_companyId_status_idx" ON "employees"("companyId", "status");

-- CreateIndex
CREATE INDEX "employees_companyId_departmentId_idx" ON "employees"("companyId", "departmentId");

-- CreateIndex
CREATE INDEX "employees_companyId_roleId_idx" ON "employees"("companyId", "roleId");

-- CreateIndex
CREATE INDEX "employees_email_idx" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_companyId_departmentId_status_idx" ON "employees"("companyId", "departmentId", "status");

-- CreateIndex
CREATE INDEX "employees_managerId_idx" ON "employees"("managerId");

-- CreateIndex
CREATE INDEX "lead_history_leadId_createdAt_idx" ON "lead_history"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "lead_history_employeeId_idx" ON "lead_history"("employeeId");

-- CreateIndex
CREATE INDEX "notifications_employeeId_isRead_idx" ON "notifications"("employeeId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_companyId_createdAt_idx" ON "notifications"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_employeeId_createdAt_idx" ON "notifications"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "tasks_assignedToId_status_idx" ON "tasks"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "tasks_companyId_status_idx" ON "tasks"("companyId", "status");

-- CreateIndex
CREATE INDEX "tasks_dueDate_idx" ON "tasks"("dueDate");

-- CreateIndex
CREATE INDEX "tasks_companyId_assignedToId_status_idx" ON "tasks"("companyId", "assignedToId", "status");

-- CreateIndex
CREATE INDEX "tasks_status_dueDate_idx" ON "tasks"("status", "dueDate");

-- CreateIndex
CREATE INDEX "tasks_companyId_dueDate_idx" ON "tasks"("companyId", "dueDate");
