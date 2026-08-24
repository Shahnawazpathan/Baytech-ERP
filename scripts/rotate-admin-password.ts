/**
 * One-time admin password rotation.
 * Sets admin@baytech.com's password to the value of ADMIN_INITIAL_PASSWORD from .env
 * Usage: npx tsx scripts/rotate-admin-password.ts
 */
import { config } from 'dotenv'
import bcrypt from 'bcrypt'
import { createClient } from '@libsql/client'

config()

async function main() {
  const password = process.env.ADMIN_INITIAL_PASSWORD
  if (!password || password.length < 8) {
    console.error('❌ ADMIN_INITIAL_PASSWORD missing or too short in .env')
    process.exit(1)
  }

  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL
  const token = process.env.TURSO_AUTH_TOKEN
  if (!url) {
    console.error('❌ Database URL not configured')
    process.exit(1)
  }

  const client = createClient({ url, authToken: token })

  const hashed = await bcrypt.hash(password, 10)
  const result = await client.execute({
    sql: 'UPDATE employees SET password = ? WHERE email = ?',
    args: [hashed, 'admin@baytech.com'],
  })

  if (result.rowsAffected > 0) {
    console.log('✅ Admin password rotated successfully for admin@baytech.com')
    console.log('🔑 New password is the ADMIN_INITIAL_PASSWORD value in your .env file')
  } else {
    console.log('⚠️  No employee found with email admin@baytech.com - nothing changed')
    console.log('   The seed in init.ts will create it on first server boot.')
  }
}

main().catch((err) => {
  console.error('❌ Rotation failed:', err.message)
  process.exit(1)
})
