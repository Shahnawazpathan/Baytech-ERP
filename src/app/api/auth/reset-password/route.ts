import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/** Reset tokens are stored hashed - hash before lookup. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const token = typeof body?.token === 'string' ? body.token : ''
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

    // Validate inputs
    if (!token || !newPassword) {
      return Response.json({
        success: false,
        error: 'Token and new password are required'
      }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return Response.json({
        success: false,
        error: 'Password must be at least 8 characters long'
      }, { status: 400 })
    }

    const tokenHash = hashToken(token)

    // Atomically claim the token: only one concurrent request can flip usedAt
    // from null to a timestamp. This closes the TOCTOU race where two requests
    // could both read "unused" and both reset the password.
    const claimed = await db.passwordResetToken.updateMany({
      where: {
        token: tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    })

    if (claimed.count === 0) {
      return Response.json({
        success: false,
        error: 'Invalid or expired reset token. Please request a new one.'
      }, { status: 400 })
    }

    // Find the reset token record we just claimed
    const resetTokenRecord = await db.passwordResetToken.findUnique({
      where: { token: tokenHash },
    })

    // Find the user by email
    const user = await db.employee.findUnique({
      where: { email: resetTokenRecord!.email },
    })

    if (!user) {
      return Response.json({
        success: false,
        error: 'User associated with this reset token no longer exists.'
      }, { status: 400 })
    }

    try {
      // Hash the new password and update
      const hashedPassword = await bcrypt.hash(newPassword, 10)

      await db.employee.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      })

      // Token is single-use - remove it entirely
      await db.passwordResetToken.delete({
        where: { token: tokenHash },
      }).catch(() => undefined)

      return Response.json({
        success: true,
        message: 'Password has been reset successfully! You can now log in with your new password.'
      })
    } catch (error) {
      // Release the claim so the user can retry after a transient failure
      await db.passwordResetToken.update({
        where: { token: tokenHash },
        data: { usedAt: null },
      }).catch(() => undefined)
      throw error
    }
  } catch (error) {
    console.error('Error in reset password API:', error)
    return Response.json({
      success: false,
      error: 'An error occurred while resetting the password.'
    }, { status: 500 })
  }
}
