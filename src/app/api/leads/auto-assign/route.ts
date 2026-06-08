import { NextRequest, NextResponse } from 'next/server'
import { reclaimInactiveLeadsToPool } from '@/lib/lead-pool'

/**
 * Background job endpoint that returns inactive assigned leads to the pool.
 * Kept at the existing route for backwards compatibility with schedulers.
 */
export async function POST(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id') || undefined
    const results = await reclaimInactiveLeadsToPool(companyId)

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
