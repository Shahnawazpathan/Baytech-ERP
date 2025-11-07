import { createClient } from '@libsql/client'

// Turso Database Configuration (Hardcoded)
const TURSO_DATABASE_URL = 'libsql://baytech-shahnawazpathan.aws-ap-south-1.turso.io'
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjI0OTM1OTIsImlkIjoiZmJlMjM5MzktYzc4OC00OWQzLWEzYzEtNjU5YTIyZDNhZTBjIiwicmlkIjoiYzNjY2Y4MDctYmVjOS00ZWNmLWJhZDItNzQ1NjkwMjJkZWYwIn0.iONfkGJQnBcIDl0ncthJnRktWkUBNV9sr2km2eKHEgd0UzNtdSE709py9CgA4CDozdEYvQgct90zw4H9pFqSDw'

async function verify() {
  console.log('🔍 Verifying Turso database...')

  const client = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
  })

  try {
    const tables = await client.execute(`
      SELECT name FROM sqlite_master
      WHERE type='table'
      ORDER BY name;
    `)

    console.log('\n📊 Tables in Turso database:')
    if (tables.rows.length === 0) {
      console.log('  ⚠️  No tables found!')
    } else {
      tables.rows.forEach((row: any) => {
        console.log(`  - ${row.name}`)
      })
    }

  } catch (error) {
    console.error('❌ Error verifying database:', error)
    process.exit(1)
  } finally {
    await client.close()
  }
}

verify()
