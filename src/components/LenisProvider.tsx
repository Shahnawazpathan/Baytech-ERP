"use client"

import { useEffect, useRef, ReactNode } from 'react'
import Lenis from 'lenis'

interface LenisProviderProps {
  children: ReactNode
}

export function LenisProvider({ children }: LenisProviderProps) {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    // Initialize Lenis
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
      autoResize: true,
      syncTouch: true,
    })

    lenisRef.current = lenis

    // Animation frame loop
    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    // Add scroll data as CSS custom properties
    lenis.on('scroll', ({ scroll, limit, velocity, direction, progress }) => {
      document.documentElement.style.setProperty('--lenis-scroll', `${scroll}`)
      document.documentElement.style.setProperty('--lenis-progress', `${progress}`)
      document.documentElement.style.setProperty('--lenis-velocity', `${velocity}`)
      document.documentElement.style.setProperty('--lenis-direction', `${direction}`)
    })

    return () => {
      lenis.destroy()
    }
  }, [])

  return <>{children}</>
}