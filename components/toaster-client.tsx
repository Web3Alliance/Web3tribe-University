'use client'

import dynamic from 'next/dynamic'

// Lazy load Toaster for better initial load performance
const Toaster = dynamic(
  () => import('@/components/ui/toaster').then((mod) => ({ default: mod.Toaster })),
  { ssr: false }
)

export function ToasterClient() {
  return <Toaster />
}
