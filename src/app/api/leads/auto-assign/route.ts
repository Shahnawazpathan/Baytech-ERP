import { NextRequest, NextResponse } from 'next/server'
import { reclaimInactiveLeadsToPool } from '@/lib/lead-pool'
import { getSessionUser } from '@/lib/auth'

/**
 * Manual trigger for returning inactive assigned leads to the pool.
 * Requires an authenticated admin/manager session; scoped to their company.
 * (The scheduled background job runs this function directly inside server.ts.)
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const roleLower = sessionUser.role.toLowerCase()
    if (!roleLower.includes('admin') && !roleLower.includes('manager')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const results = await reclaimInactiveLeadsToPool(sessionUser.companyId)

    return NextResponse.json({
      success: true,
      message: 'Inactive lead pool reclamation completed',
      returnedToPoolCount: results.filter((r) => r.status === 'returned_to_pool').length,
      results,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to return inactive leads to pool' },
      { status: 500 }
    )
  }
}
