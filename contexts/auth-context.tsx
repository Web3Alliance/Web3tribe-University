'use client'

import React from "react"
import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { supabase } from '@/lib/supabase/client' // Declare the supabase variable
import { User } from '@supabase/supabase-js'

interface UserProfile {
  id: string
  email: string
  full_name: string
  country: string
  bio?: string
  profile_picture_url?: string
  wallet_address?: string
  w3tr_balance: number
  pi_balance: number
  is_tutor: boolean
  is_admin: boolean
  email_verified: boolean
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signUp: (email: string, password: string, fullName: string, country: string) => Promise<{ error?: string }>
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error?: string }>
  uploadProfilePicture: (file: File) => Promise<{ error?: string, url?: string }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setLoading(false)
      return
    }
    
    try {
      const supabaseClient = getSupabaseBrowserClient()
      const { data, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (!error && data) {
        setProfile(data)
      }
    } catch (error) {
      // Silent error - profile will remain null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setLoading(false)
      return
    }

    let mounted = true

    const initAuth = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        const currentUser = session?.user ?? null
        setUser(currentUser)
        
        if (currentUser) {
          // Fetch profile in background, don't block loading
          fetchProfile(currentUser.id)
        } else {
          setLoading(false)
        }
      } catch (error) {
        if (mounted) setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signUp = useCallback(async (email: string, password: string, fullName: string, country: string) => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return { error: 'Database not configured. Please set up Supabase integration.' }
    }
    
    try {
      const supabaseClient = getSupabaseBrowserClient()
      const { error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
            country: country,
          },
        },
      })

      if (error) throw error

      // Note: User profile is automatically created by the database trigger (handle_new_user)
      // No need to manually insert into users table

      return {}
    } catch (error: any) {
      return { error: error.message }
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return { error: 'Database not configured. Please set up Supabase integration.' }
    }
    
    try {
      const supabaseClient = getSupabaseBrowserClient()
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      return {}
    } catch (error: any) {
      return { error: error.message }
    }
  }, [])

  const signOut = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const supabaseClient = getSupabaseBrowserClient()
      await supabaseClient.auth.signOut()
    }
    setUser(null)
    setProfile(null)
  }, [])

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return { error: 'Not authenticated' }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return { error: 'Database not configured' }
    }

    try {
      const supabaseClient = getSupabaseBrowserClient()
      const { error } = await supabaseClient
        .from('users')
        .update(updates)
        .eq('id', user.id)

      if (error) throw error

      // Refresh profile
      await fetchProfile(user.id)
      return {}
    } catch (error: any) {
      return { error: error.message }
    }
  }, [user])

  const uploadProfilePicture = useCallback(async (file: File) => {
    if (!user) return { error: 'Not authenticated' }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return { error: 'Database not configured' }
    }

    try {
      const supabaseClient = getSupabaseBrowserClient()
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      const { error: uploadError } = await supabaseClient.storage
        .from('profile-pictures')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabaseClient.storage
        .from('profile-pictures')
        .getPublicUrl(filePath)

      // Update profile with new picture URL
      await updateProfile({ profile_picture_url: publicUrl })

      return { url: publicUrl }
    } catch (error: any) {
      return { error: error.message }
    }
  }, [user, updateProfile])

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      // Don't set loading to true as it causes the page to show loading spinner
      // Just refetch the profile data
      try {
        const supabaseClient = getSupabaseBrowserClient()
        const { data, error } = await supabaseClient
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) throw error
        setProfile(data)
      } catch (error) {
        // Silent error
      }
    }
  }, [user?.id])

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    uploadProfilePicture,
    refreshProfile,
  }), [user, profile, loading, signUp, signIn, signOut, updateProfile, uploadProfilePicture, refreshProfile])

  return (
    <AuthContext.Provider value={contextValue}>
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
