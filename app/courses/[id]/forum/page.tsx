'use client'

import React from "react"

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Send, ArrowLeft, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/contexts/auth-context'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'

interface ForumMessage {
  id: string
  course_id: string
  user_id: string
  message: string
  created_at: string
  users: {
    full_name: string
    profile_picture_url?: string
  }
}

export default function ClassroomForumPage() {
  const params = useParams()
  const router = useRouter()
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState<ForumMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [courseName, setCourseName] = useState('')
  const [participantCount, setParticipantCount] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    if (!user) {
      router.push('/')
      return
    }

    fetchCourseDetails()
    fetchMessages()
    subscribeToMessages()
  }, [user, params.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchCourseDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('title')
        .eq('id', params.id)
        .single()

      if (error) throw error
      setCourseName(data.title)

      // Get participant count
      const { count } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', params.id)

      setParticipantCount(count || 0)
    } catch (error) {
      console.error('[v0] Error fetching course:', error)
    }
  }

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('forum_messages')
        .select(`
          *,
          users:user_id (
            full_name,
            profile_picture_url
          )
        `)
        .eq('course_id', params.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('[v0] Error fetching messages:', error)
    }
  }

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`forum_${params.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'forum_messages',
          filter: `course_id=eq.${params.id}`,
        },
        async (payload) => {
          // Fetch user details for the new message
          const { data: userData } = await supabase
            .from('users')
            .select('full_name, profile_picture_url')
            .eq('id', payload.new.user_id)
            .single()

          setMessages((prev) => [
            ...prev,
            {
              ...payload.new,
              users: userData,
            } as ForumMessage,
          ])
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !user || sending) return

    setSending(true)

    try {
      const { error } = await supabase.from('forum_messages').insert({
        course_id: params.id,
        user_id: user.id,
        message: newMessage.trim(),
      })

      if (error) throw error
      setNewMessage('')
    } catch (error) {
      console.error('[v0] Error sending message:', error)
      alert('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  if (!user || !profile) {
    return null
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)] max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-14 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">Classroom Forum</h1>
            <p className="text-xs text-muted-foreground truncate">{courseName}</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{participantCount}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div ref={scrollRef} className="py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-2">No messages yet</p>
              <p className="text-sm text-muted-foreground">
                Start a conversation with your classmates!
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const isOwnMessage = message.user_id === user.id
              const initials = message.users.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)

              return (
                <div
                  key={message.id}
                  className={`flex gap-2 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={message.users.profile_picture_url || "/placeholder.svg"} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className={`flex-1 ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col max-w-[75%]`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-medium">
                        {isOwnMessage ? 'You' : message.users.full_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-2 ${
                        isOwnMessage
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.message}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="sticky bottom-16 bg-background border-t p-4">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
            maxLength={500}
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
