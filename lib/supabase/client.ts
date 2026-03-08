import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseBrowserClient() {
  if (client) {
    return client
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

  client = createBrowserClient(url, key)

  return client
}

// Export as createClient for compatibility
export function createClient() {
  return getSupabaseBrowserClient()
}

// Export instance for direct usage
export const supabase = getSupabaseBrowserClient()
