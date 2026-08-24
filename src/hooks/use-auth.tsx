'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface User {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  position: string
  department: string
  role: string
  roleId: string
  name: string
  companyId: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>
  logout: () => Promise<void>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check authentication status on mount
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' })

        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
          setIsAuthenticated(true)
        }
      } catch (error) {
        console.error('Error checking authentication:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string): Promise<{ ok: boolean; message?: string }> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json().catch(() => null)

      if (response.ok && data?.success) {
        setUser(data.user)
        setIsAuthenticated(true)
        return { ok: true }
      }

      // Surface the server's specific reason (inactive account, rate limit...)
      return { ok: false, message: data?.error || 'Invalid email or password' }
    } catch (error) {
      console.error('Login error:', error)
      return { ok: false, message: 'Unable to reach the server. Please check your connection.' }
    }
  }

  const logout = async (): Promise<void> => {
    try {
      // Await the cookie clear - navigating before this completes aborts the
      // request and leaves the session cookie alive (the logout bug).
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // Network failure should not trap the user - clear local state anyway
    }
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      login,
      logout,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
