import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { createTransport } from 'nodemailer'
import { createHash, randomBytes, timingSafeEqual } from 'crypto'

export const runtime = 'nodejs'

// Simple per-email rate limit to prevent SMTP email bombing
const resetRequests = new Map<string, { count: number; resetAt: number }>()
const MAX_REQUESTS_PER_WINDOW = 3
const WINDOW_MS = 15 * 60 * 1000

function checkResetRateLimit(email: string): boolean {
  const now = Date.now()
  const entry = resetRequests.get(email)

  if (resetRequests.size > 5000) {
    for (const [k, v] of resetRequests) {
      if (v.resetAt <= now) resetRequests.delete(k)
    }
  }

  if (!entry || entry.resetAt <= now) {
    resetRequests.set(email, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  entry.count += 1
  return entry.count <= MAX_REQUESTS_PER_WINDOW
}

/** Hash reset tokens before storage - a DB dump must not yield live reset links. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

const GENERIC_SUCCESS = {
  success: true,
  message: 'If an account with this email exists, a password reset link has been sent to your email.',
}

function dummyWork(): void {
  // Equalize timing when the email does not exist
  hashToken(randomBytes(32).toString('base64url'))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email : ''
    const normalizedEmail = email.trim().toLowerCase()

    // Validate the email
    if (!normalizedEmail) {
      return Response.json({ success: false, error: 'Email is required' }, { status: 400 })
    }

    if (!checkResetRateLimit(normalizedEmail)) {
      // Same generic message so attackers learn nothing
      return Response.json(GENERIC_SUCCESS)
    }

    // Check if the user exists in the database
    const user = await db.employee.findUnique({
      where: { email: normalizedEmail },
    })

    const mailConfigured =
      Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS) && Boolean(user)

    if (!user || !mailConfigured) {
      if (!user) dummyWork()
      if (!mailConfigured && user) {
        console.error('Password reset email is not configured')
      }
      return Response.json(GENERIC_SUCCESS)
    }

    // Create a transporter using custom SMTP settings - certificate validation stays ON
    const transporter = createTransport({
      host: process.env.SMTP_HOST || 'mail.baytech-uae.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    const resetToken = randomBytes(32).toString('base64url')

    // Set token to expire in 1 hour
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    // Invalidate any previous live tokens for this email, then store the new one hashed.
    // Single transaction prevents multiple simultaneous valid links.
    await db.$transaction([
      db.passwordResetToken.deleteMany({
        where: { email: normalizedEmail, usedAt: null },
      }),
      db.passwordResetToken.create({
        data: {
          email: normalizedEmail,
          token: hashToken(resetToken),
          expiresAt,
        },
      }),
    ])

    // Periodically purge expired/used tokens
    await db.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }).catch(() => undefined)

    // Create the reset link
    const appUrl = process.env.APP_URL || request.nextUrl.origin
    const resetLink = `${appUrl.replace(/\/$/, '')}/reset-password?token=${resetToken}`

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: normalizedEmail,
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
            <p>&copy; ${new Date().getFullYear()} Baytech UAE. All rights reserved.</p>
          </div>
        </div>
      `
    }

    // Send the email
    try {
      await transporter.sendMail(mailOptions)
    } catch (emailError) {
      console.error('Error sending email:', emailError)
      // Still return success for security reasons (to prevent enumeration)
    }

    return Response.json(GENERIC_SUCCESS)
  } catch (error) {
    console.error('Error in forgot password API:', error)
    return Response.json({
      success: false,
      error: 'An error occurred while sending the reset email.'
    }, { status: 500 })
  }
}
