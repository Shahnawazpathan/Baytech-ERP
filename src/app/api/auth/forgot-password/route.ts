import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { createTransport } from 'nodemailer'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    // Validate the email
    if (!email) {
      return Response.json({
        success: false,
        error: 'Email is required'
      }, { status: 400 })
    }

    // Check if the user exists in the database
    const user = await db.employee.findUnique({
      where: {
        email: email
      }
    })

    if (!user) {
      // For security reasons, return success even if the email doesn't exist
      // This prevents email enumeration attacks
      return Response.json({
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent to your email.'
      })
    }

    // Create a transporter using custom SMTP settings for baytech-uae.com
    const transporter = createTransport({
      host: process.env.SMTP_HOST || 'mail.baytech-uae.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER || 'info@baytech-uae.com',
        pass: process.env.EMAIL_PASS || 'Info2025@',
      },
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false
      }
    })

    // Generate a random token for password reset
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

    // Set token to expire in 1 hour
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    // Create the reset link
    const resetLink = `https://baytech-erp.vercel.app/reset-password?token=${resetToken}`

    // Store the reset token in the database
    await db.passwordResetToken.create({
      data: {
        email: email,
        token: resetToken,
        expiresAt: expiresAt
      }
    })

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER || 'info@baytech-uae.com',
      to: email,
      subject: 'Password Reset Request - Baytech ERP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 20px 0;">
            <h2 style="color: #333;">Baytech ERP Password Reset</h2>
          </div>
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p>Hello,</p>
            <p>You have requested to reset your password for your Baytech ERP account.</p>
            <p>Please click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
            </div>
            <p>If you did not request a password reset, please ignore this email.</p>
            <p>This link will expire in 1 hour for security reasons.</p>
          </div>
          <div style="text-align: center; padding: 20px 0; color: #777; font-size: 14px;">
            <p>&copy; 2025 Baytech UAE. All rights reserved.</p>
          </div>
        </div>
      `
    }

    // Send the email
    try {
      await transporter.sendMail(mailOptions)
    } catch (emailError) {
      console.error('Error sending email:', emailError)
      // In a real application, you might want to return a more specific error
      // For now, we still return success for security reasons (to prevent enumeration)
    }

    return Response.json({
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent to your email.'
    })
  } catch (error) {
    console.error('Error in forgot password API:', error)
    return Response.json({
      success: false,
      error: 'An error occurred while sending the reset email.'
    }, { status: 500 })
  }
}
