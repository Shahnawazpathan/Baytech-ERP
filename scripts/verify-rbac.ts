import { createClient } from '@libsql/client'
import { config } from 'dotenv'

config()

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  const roles = await client.execute("SELECT id, name FROM roles WHERE companyId = 'default-company'")
  console.log('\n=== Role -> Permission counts ===')
  for (const role of roles.rows) {
    const roleId = String(role.id)
    const roleName = String(role.name)
    const cnt = await client.execute({
      sql: 'SELECT COUNT(*) as c FROM role_permissions WHERE roleId = ?',
      args: [roleId],
    })
    const distinct = await client.execute({
      sql: 'SELECT COUNT(DISTINCT permissionId) as c FROM role_permissions WHERE roleId = ?',
      args: [roleId],
    })
    const total = Number((cnt.rows[0] as any).c)
    const uniq = Number((distinct.rows[0] as any).c)
    const icon = uniq > 0 ? 'ok' : 'MISSING'
    console.log(`${icon}  ${roleName}: ${uniq} unique (${total - uniq} duplicates)`)
  }

  const permCount = await client.execute("SELECT COUNT(*) as c FROM permissions WHERE companyId = 'default-company'")
  console.log(`\nTotal distinct permissions defined: ${Number((permCount.rows[0] as any).c)}`)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
