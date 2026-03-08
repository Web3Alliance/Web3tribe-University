"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, UserPlus, UserCheck, MessageCircle, Image, Send, Heart, MessageSquare } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface UserProfile {
  id: string
  full_name: string
  email: string
  profile_picture_url?: string
  bio?: string
  country: string
  w3tr_balance: number
  is_following?: boolean
}

interface ForumPost {
  id: string
  content: string
  media_url?: string
  likes_count: number
  comments_count: number
  created_at: string
  user: {
    id: string
    full_name: string
    profile_picture_url?: string
  }
  is_liked?: boolean
}

export default function CommunityPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [users, setUsers] = useState<UserProfile[]>([])
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([])
  const [followingPosts, setFollowingPosts] = useState<ForumPost[]>([])
  const [loading, setLoading] = useState(false)
  const [newPostContent, setNewPostContent] = useState("")
  const [showCreatePost, setShowCreatePost] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/')
    }
  }, [authLoading, user, router])

  // Fetch forum posts on mount
  useEffect(() => {
    if (user) {
      fetchForumPosts()
    }
  }, [user])

  const searchUsers = async () => {
    if (!searchQuery.trim() || !user) return

    setLoading(true)
    try {
      const supabase = createClient()
      
      // Search by full name, email, or partial first name
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, profile_picture_url, bio, country, w3tr_balance')
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .neq('id', user.id)
        .limit(20)

      if (error) throw error
      if (!data) {
        setUsers([])
        return
      }

      // Check if current user follows each user (table might not exist yet)
      try {
        const { data: follows } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', user.id)

        const followingIds = new Set(follows?.map(f => f.following_id) || [])

        const usersWithFollowStatus = data.map(u => ({
          ...u,
          is_following: followingIds.has(u.id)
        }))

        setUsers(usersWithFollowStatus)
      } catch {
        // If user_follows table doesn't exist, just show users without follow status
        setUsers(data.map(u => ({ ...u, is_following: false })))
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to search users",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchForumPosts = async () => {
    if (!user) return

    try {
      const supabase = createClient()
      
      const { data: posts, error } = await supabase
        .from('forum_posts')
        .select(`
          id,
          content,
          media_url,
          likes_count,
          comments_count,
          created_at,
          user_id
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      if (!posts || posts.length === 0) { setForumPosts([]); return }

      // Fetch user data separately to avoid FK join issues
      const userIds = [...new Set(posts.map(p => p.user_id))]
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, profile_picture_url')
        .in('id', userIds)

      const usersMap = new Map(usersData?.map(u => [u.id, u]) || [])

      const { data: likes } = await supabase
        .from('forum_post_likes')
        .select('post_id')
        .eq('user_id', user.id)

      const likedPostIds = new Set(likes?.map(l => l.post_id) || [])

      const postsWithData = posts.map(p => ({
        ...p,
        user: usersMap.get(p.user_id) || { id: p.user_id, full_name: 'Unknown', profile_picture_url: null },
        is_liked: likedPostIds.has(p.id)
      }))

      setForumPosts(postsWithData)
    } catch (error) {
      setForumPosts([])
    }
  }

  const fetchFollowingPosts = async () => {
    if (!user) return

    try {
      const supabase = createClient()
      
      // Get users that current user follows
      const { data: follows } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user.id)

      const followingIds = follows?.map(f => f.following_id) || []

      if (followingIds.length === 0) {
        setFollowingPosts([])
        return
      }

      const { data: posts, error } = await supabase
        .from('forum_posts')
        .select(`
          id,
          content,
          media_url,
          likes_count,
          comments_count,
          created_at,
          user:users(id, full_name, profile_picture_url)
        `)
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const postsWithUser = posts.map(p => ({
        ...p,
        user: Array.isArray(p.user) ? p.user[0] : p.user
      }))

      setFollowingPosts(postsWithUser)
    } catch (error) {
      // Silent error
    }
  }

  const handleFollow = async (userId: string) => {
    if (!user) return

    try {
      const supabase = createClient()
      const isFollowing = users.find(u => u.id === userId)?.is_following

      if (isFollowing) {
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId)
      } else {
        await supabase
          .from('user_follows')
          .insert({ follower_id: user.id, following_id: userId })
      }

      setUsers(users.map(u => 
        u.id === userId ? { ...u, is_following: !isFollowing } : u
      ))

      fetchFollowingPosts()

      toast({
        title: "Success",
        description: isFollowing ? "Unfollowed successfully" : "Following user",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update follow status",
        variant: "destructive",
      })
    }
  }

  const handleMessage = (userId: string) => {
    router.push(`/messages?user=${userId}`)
  }

  const createPost = async () => {
    if (!newPostContent.trim() || !user) return

    setLoading(true)
    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('forum_posts')
        .insert({
          user_id: user.id,
          content: newPostContent.trim()
        })

      if (error) throw error

      setNewPostContent("")
      setShowCreatePost(false)
      fetchForumPosts()

      toast({
        title: "Success",
        description: "Post created successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to create post",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const likePost = async (postId: string) => {
    if (!user) return

    try {
      const supabase = createClient()
      const post = forumPosts.find(p => p.id === postId)

      if (post?.is_liked) {
        // Unlike
        await supabase
          .from('forum_post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)

        await supabase
          .from('forum_posts')
          .update({ likes_count: Math.max(0, (post.likes_count || 0) - 1) })
          .eq('id', postId)
      } else {
        // Like
        await supabase
          .from('forum_post_likes')
          .insert({ post_id: postId, user_id: user.id })

        await supabase
          .from('forum_posts')
          .update({ likes_count: (post?.likes_count || 0) + 1 })
          .eq('id', postId)
      }

      fetchForumPosts()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to like post",
        variant: "destructive",
      })
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold">Community</h1>

        {/* Search Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
                  className="pl-10"
                />
              </div>
              <Button onClick={searchUsers} disabled={loading}>
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search Results */}
        {users.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Search Results</h2>
            {users.map(user => (
              <Card key={user.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.profile_picture_url || "/placeholder.svg"} />
                      <AvatarFallback>{user.full_name[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{user.full_name}</h3>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      <p className="text-sm text-muted-foreground">{user.country}</p>
                      {user.bio && (
                        <p className="text-sm mt-1 line-clamp-2">{user.bio}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant={user.is_following ? "secondary" : "default"}
                        onClick={() => handleFollow(user.id)}
                      >
                        {user.is_following ? (
                          <>
                            <UserCheck className="h-4 w-4 mr-1" />
                            Following
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-1" />
                            Follow
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMessage(user.id)}
                      >
                        <MessageCircle className="h-4 w-4 mr-1" />
                        Message
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Post */}
        {!showCreatePost ? (
          <Button
            onClick={() => setShowCreatePost(true)}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            Create Post
          </Button>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Textarea
                placeholder="Share something with the community..."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <div className="flex gap-2">
                <Button onClick={createPost} disabled={loading || !newPostContent.trim()} className="flex-1">
                  <Send className="h-4 w-4 mr-2" />
                  Post
                </Button>
                <Button variant="outline" onClick={() => {
                  setShowCreatePost(false)
                  setNewPostContent("")
                }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Forum Posts */}
        <Tabs defaultValue="all" className="w-full" onValueChange={(value) => {
          if (value === 'all' && forumPosts.length === 0) fetchForumPosts()
          if (value === 'following' && followingPosts.length === 0) fetchFollowingPosts()
        }}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">All Posts</TabsTrigger>
            <TabsTrigger value="following" className="flex-1">Following</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {forumPosts.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No posts yet
                </CardContent>
              </Card>
            ) : (
              forumPosts.map(post => (
                <Card key={post.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={post.user?.profile_picture_url || "/placeholder.svg"} />
                        <AvatarFallback>{post.user?.full_name?.[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{post.user?.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(post.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{post.content}</p>
                    {post.media_url && (
                      <img 
                        src={post.media_url} 
                        alt="Post media" 
                        className="mt-3 rounded-lg w-full object-cover max-h-96"
                      />
                    )}
                    <div className="flex gap-4 mt-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => likePost(post.id)}
                        className="gap-2"
                      >
                        <Heart className={`h-4 w-4 ${post.is_liked ? 'fill-red-500 text-red-500' : ''}`} />
                        <span className="text-sm">{post.likes_count}</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-2">
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-sm">{post.comments_count}</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="following" className="space-y-4">
            {followingPosts.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No posts from users you follow
                </CardContent>
              </Card>
            ) : (
              followingPosts.map(post => (
                <Card key={post.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={post.user?.profile_picture_url || "/placeholder.svg"} />
                        <AvatarFallback>{post.user?.full_name?.[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{post.user?.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(post.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{post.content}</p>
                    {post.media_url && (
                      <img 
                        src={post.media_url} 
                        alt="Post media" 
                        className="mt-3 rounded-lg w-full object-cover max-h-96"
                      />
                    )}
                    <div className="flex gap-4 mt-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => likePost(post.id)}
                        className="gap-2"
                      >
                        <Heart className={`h-4 w-4 ${post.is_liked ? 'fill-red-500 text-red-500' : ''}`} />
                        <span className="text-sm">{post.likes_count}</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-2">
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-sm">{post.comments_count}</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
