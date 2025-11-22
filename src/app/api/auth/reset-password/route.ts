import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json()

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

    // Find the reset token in the database
    const resetTokenRecord = await db.passwordResetToken.findUnique({
      where: {
        token: token
      }
    })

    // Check if token exists
    if (!resetTokenRecord) {
      return Response.json({
        success: false,
        error: 'Invalid or expired reset token.'
      }, { status: 400 })
    }

    // Check if token is expired
    const currentTime = new Date()
    if (resetTokenRecord.expiresAt < currentTime) {
      // Delete the expired token
      await db.passwordResetToken.delete({
        where: { token: token }
      })

      return Response.json({
        success: false,
        error: 'Reset token has expired. Please request a new one.'
      }, { status: 400 })
    }

    // Check if token has already been used
    if (resetTokenRecord.usedAt) {
      return Response.json({
        success: false,
        error: 'Reset token has already been used.'
      }, { status: 400 })
    }

    // Find the user by email
    const user = await db.employee.findUnique({
      where: {
        email: resetTokenRecord.email
      }
    })

    if (!user) {
      return Response.json({
        success: false,
        error: 'User associated with this reset token no longer exists.'
      }, { status: 400 })
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update the user's password
    await db.employee.update({
      where: {
        id: user.id
      },
      data: {
        password: hashedPassword
      }
    })

    // Mark the reset token as used
    await db.passwordResetToken.update({
      where: {
        token: token
      },
      data: {
        usedAt: new Date()
      }
    })

    return Response.json({
      success: true,
      message: 'Password has been reset successfully! You can now log in with your new password.'
    })
  } catch (error) {
    console.error('Error in reset password API:', error)
    return Response.json({
      success: false,
      error: 'An error occurred while resetting the password.'
    }, { status: 500 })
  }
}