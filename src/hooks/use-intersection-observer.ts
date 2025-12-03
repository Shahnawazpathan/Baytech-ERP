import { useEffect, useRef, useState } from 'react'

interface UseIntersectionObserverProps {
  threshold?: number
  root?: Element | null
  rootMargin?: string
  freezeOnceVisible?: boolean
}

export function useIntersectionObserver({
  threshold = 0,
  root = null,
  rootMargin = '0px',
  freezeOnceVisible = false,
}: UseIntersectionObserverProps = {}): [React.RefObject<HTMLDivElement | null>, boolean] {
  const [isIntersecting, setIntersecting] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const frozen = useRef(false)

  useEffect(() => {
    const node = ref?.current
    const hasIOSupport = !!window.IntersectionObserver

    if (!hasIOSupport || frozen.current || !node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isElementIntersecting = entry?.isIntersecting
        setIntersecting(isElementIntersecting)

        if (isElementIntersecting && freezeOnceVisible) {
          frozen.current = true
        }
      },
      { threshold, root, rootMargin }
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [threshold, root, rootMargin, freezeOnceVisible])

  return [ref, isIntersecting]
}
