"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Send, Search, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  created_at: string
  sender?: {
    id: string
    full_name: string
    profile_picture_url?: string
  }
  receiver?: {
    id: string
    full_name: string
    profile_picture_url?: string
  }
}

interface Conversation {
  user_id: string
  user_name: string
  user_picture?: string
  last_message: string
  last_message_time: string
  unread_count: number
}

export default function MessagesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedUserId = searchParams.get('user')
  const { user, profile, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [followingUsers, setFollowingUsers] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (user) {
      fetchConversations()
    }
  }, [user])

  useEffect(() => {
    if (selectedUserId && user) {
      loadConversation(selectedUserId)
    }
  }, [selectedUserId, user])

  const fetchConversations = async () => {
    if (!user) return

    try {
      const supabase = createClient()
      
      // Get all messages involving the user
      const { data: allMessages, error } = await supabase
        .from('private_messages')
        .select(`
          id,
          sender_id,
          receiver_id,
          content,
          is_read,
          created_at,
          sender:users!private_messages_sender_id_fkey(id, full_name, profile_picture_url),
          receiver:users!private_messages_receiver_id_fkey(id, full_name, profile_picture_url)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Group by conversation partner
      const convMap = new Map<string, Conversation>()

      allMessages.forEach((msg: any) => {
        const isReceiver = msg.receiver_id === user.id
        const partnerId = isReceiver ? msg.sender_id : msg.receiver_id
        const partner = isReceiver ? msg.sender : msg.receiver
        
        if (!convMap.has(partnerId)) {
          convMap.set(partnerId, {
            user_id: partnerId,
            user_name: partner?.full_name || 'Unknown',
            user_picture: partner?.profile_picture_url,
            last_message: msg.content,
            last_message_time: msg.created_at,
            unread_count: 0
          })
        }

        if (isReceiver && !msg.is_read) {
          const conv = convMap.get(partnerId)!
          conv.unread_count++
        }
      })

      setConversations(Array.from(convMap.values()))
    } catch (error) {
      // Silent error
    }
  }

  const loadConversation = async (otherUserId: string) => {
    if (!user) return

    setLoading(true)
    try {
      const supabase = createClient()

      // Get user info
      const { data: userData } = await supabase
        .from('users')
        .select('id, full_name, profile_picture_url')
        .eq('id', otherUserId)
        .single()

      setSelectedUser(userData)

      // Get messages
      const { data, error } = await supabase
        .from('private_messages')
        .select(`
          id,
          sender_id,
          receiver_id,
          content,
          is_read,
          created_at
        `)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })

      if (error) throw error

      setMessages(data || [])

      // Mark messages as read
      await supabase
        .from('private_messages')
        .update({ is_read: true })
        .eq('receiver_id', user.id)
        .eq('sender_id', otherUserId)

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load conversation",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchFollowing = async () => {
    if (!user) return

    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('user_follows')
        .select(`
          following_id,
          following:users!user_follows_following_id_fkey(id, full_name, email, profile_picture_url)
        `)
        .eq('follower_id', user.id)

      if (error) throw error

      const users = data?.map(f => f.following) || []
      setFollowingUsers(users)
    } catch (error) {
      // If table doesn't exist, set empty
      setFollowingUsers([])
    }
  }

  const searchUsers = async () => {
    if (!searchQuery.trim() || !user) return

    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, profile_picture_url')
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .neq('id', user.id)
        .limit(10)

      if (error) throw error

      setSearchResults(data || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to search users",
        variant: "destructive",
      })
    }
  }

  const startConversation = (userId: string) => {
    setShowNewMessage(false)
    setSearchQuery("")
    setSearchResults([])
    router.push(`/messages?user=${userId}`)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !selectedUserId) return

    // Check balance
    if (!profile || profile.w3tr_balance < 1) {
      toast({
        title: "Insufficient Balance",
        description: "You need 1 W3TR to send a message",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('private_messages')
        .insert({
          sender_id: user.id,
          receiver_id: selectedUserId,
          content: newMessage.trim()
        })

      if (error) throw error

      setNewMessage("")
      await loadConversation(selectedUserId)
      fetchConversations()

      toast({
        title: "Message Sent",
        description: "1 W3TR has been deducted from your balance",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to send message",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!selectedUserId) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Messages</h1>
            <Dialog open={showNewMessage} onOpenChange={(open) => {
              setShowNewMessage(open)
              if (open) fetchFollowing()
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  New Message
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>New Message</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
                    />
                    <Button onClick={searchUsers} size="icon">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>

                  {searchResults.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Search Results</p>
                      {searchResults.map(user => (
                        <Card
                          key={user.id}
                          className="cursor-pointer hover:bg-accent transition-colors"
                          onClick={() => startConversation(user.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={user.profile_picture_url || "/placeholder.svg"} />
                                <AvatarFallback>{user.full_name[0]?.toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{user.full_name}</p>
                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : followingUsers.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">People You Follow</p>
                      {followingUsers.map(user => (
                        <Card
                          key={user.id}
                          className="cursor-pointer hover:bg-accent transition-colors"
                          onClick={() => startConversation(user.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={user.profile_picture_url || "/placeholder.svg"} />
                                <AvatarFallback>{user.full_name[0]?.toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{user.full_name}</p>
                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Search for users to start a conversation
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Badge variant="secondary">{profile?.w3tr_balance || 0} W3TR</Badge>
                <span>Each message costs 1 W3TR</span>
              </div>
            </CardContent>
          </Card>

          {conversations.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No conversations yet
              </CardContent>
            </Card>
          ) : (
            conversations.map(conv => (
              <Card 
                key={conv.user_id} 
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => router.push(`/messages?user=${conv.user_id}`)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={conv.user_picture || "/placeholder.svg"} />
                      <AvatarFallback>{conv.user_name[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{conv.user_name}</h3>
                        {conv.unread_count > 0 && (
                          <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {conv.last_message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(conv.last_message_time).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => router.push('/messages')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {selectedUser && (
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={selectedUser.profile_picture_url || "/placeholder.svg"} />
                <AvatarFallback>{selectedUser.full_name[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <h1 className="text-lg font-bold">{selectedUser.full_name}</h1>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full space-y-3">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.sender_id === user.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <p className="text-sm">{msg.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {new Date(msg.created_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background border-t p-4 max-w-lg mx-auto w-full">
        <div className="flex gap-2">
          <Input
            placeholder={`Message (${profile?.w3tr_balance || 0} W3TR available)`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            disabled={loading}
          />
          <Button onClick={sendMessage} disabled={loading || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          1 W3TR will be charged per message
        </p>
      </div>
    </div>
  )
}
