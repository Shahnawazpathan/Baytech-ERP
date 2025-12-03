import { createClient } from '@libsql/client'
import * as fs from 'fs'
import * as path from 'path'

// Turso Database Configuration (Hardcoded)
const TURSO_DATABASE_URL = 'libsql://database-baytech-village-vercel-icfg-onrrmbslrj4je1pg81gzocha.aws-ap-south-1.turso.io'
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjQ3Njc0MjQsImlkIjoiMTc3ODU2NTYtYjZjNS00M2YwLTgyNjktMWY5MDAyYzQ4YWFhIiwicmlkIjoiMGU1NGNmM2MtZjQwMS00ZjUyLThkYmMtN2MyYjhkZmM2OThlIn0.Uw065oL8CPxkOmVPFMY-Qdf0k8eeNY06Cf2zREQrhpiudbQEfO1dk5YYKeY5fBASqusy8dfybrf8_APe7g4qBQ'

async function applySchema() {
  console.log('🔄 Connecting to Turso database...')

  const client = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
  })

  try {
    console.log('📖 Reading migration SQL...')
    const sql = fs.readFileSync(
      path.join(__dirname, 'turso-migrate.sql'),
      'utf-8'
    )

    console.log('🚀 Applying schema to Turso database...')

    // Split SQL by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(stmt => {
        // Remove comment lines but keep the SQL
        return stmt
          .split('\n')
          .filter(line => !line.trim().startsWith('--'))
          .join('\n')
          .trim()
      })
      .filter(stmt => stmt.length > 0)

    console.log(`📝 Found ${statements.length} statements to execute`)

    let successCount = 0
    let errorCount = 0

    for (const statement of statements) {
      try {
        await client.execute(statement)
        successCount++
        console.log(`  ✓ Executed statement ${successCount}`)
      } catch (error: any) {
        errorCount++
        console.error(`  ✗ Error in statement ${successCount + errorCount}:`, error.message)
        console.error(`     Statement: ${statement.substring(0, 150)}...`)
        // Ignore "already exists" errors for idempotency
        if (!error.message?.includes('already exists')) {
          throw error
        }
      }
    }

    console.log(`\n✅ Executed ${successCount} statements successfully${errorCount > 0 ? ` (${errorCount} skipped)` : ''}`)

    console.log('✅ Schema applied successfully to Turso database!')

    // Verify tables were created
    const tables = await client.execute(`
      SELECT name FROM sqlite_master
      WHERE type='table'
      ORDER BY name;
    `)

    console.log('\n📊 Tables in Turso database:')
    tables.rows.forEach(row => {
      console.log(`  - ${row.name}`)
    })

  } catch (error) {
    console.error('❌ Error applying schema:', error)
    process.exit(1)
  } finally {
    await client.close()
  }
}

applySchema()
