"use client"

import { useEffect, useRef } from 'react'
import Lenis from 'lenis'

export function useLenis() {
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
    })

    lenisRef.current = lenis

    // Animation frame loop
    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    // Prevent smooth scrolling during page transitions
    const handleRouteChange = () => {
      lenis.stop()
    }

    const handleRouteComplete = () => {
      lenis.start()
    }

    // Listen for route changes (if using Next.js router)
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleRouteChange)
    }

    return () => {
      lenis.destroy()
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleRouteChange)
      }
    }
  }, [])

  const scrollTo = (target: string | number | HTMLElement, options?: any) => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, options)
    }
  }

  const scrollToTop = () => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { duration: 1.5 })
    }
  }

  const scrollToElement = (selector: string, options?: any) => {
    if (lenisRef.current) {
      const element = document.querySelector(selector)
      if (element) {
        lenisRef.current.scrollTo(element, { 
          offset: -100,
          duration: 1.2,
          ...options 
        })
      }
    }
  }

  return {
    lenis: lenisRef.current,
    scrollTo,
    scrollToTop,
    scrollToElement
  }
}