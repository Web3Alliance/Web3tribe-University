"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, UserPlus, UserCheck, MessageCircle, Send, Heart, MessageSquare, ChevronDown, ChevronUp, CornerDownRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

interface Reply {
  id: string
  content: string
  created_at: string
  user: { id: string; full_name: string; profile_picture_url?: string }
}

interface Comment {
  id: string
  content: string
  created_at: string
  likes_count: number
  replies_count: number
  is_liked?: boolean
  user: { id: string; full_name: string; profile_picture_url?: string }
  replies?: Reply[]
  showReplies?: boolean
  loadingReplies?: boolean
}

interface ForumPost {
  id: string
  content: string
  media_url?: string
  likes_count: number
  comments_count: number
  created_at: string
  user: { id: string; full_name: string; profile_picture_url?: string }
  is_liked?: boolean
  comments?: Comment[]
  showComments?: boolean
  loadingComments?: boolean
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
  const [newComments, setNewComments] = useState<Record<string, string>>({})
  const [newReplies, setNewReplies] = useState<Record<string, string>>({})
  const [showReplyInput, setShowReplyInput] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!authLoading && !user) router.replace('/')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && !authLoading) fetchForumPosts()
  }, [user, authLoading])

  const searchUsers = async () => {
    if (!searchQuery.trim() || !user) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, profile_picture_url, bio, country, w3tr_balance')
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .neq('id', user.id).limit(20)
      if (error) throw error
      if (!data) { setUsers([]); return }
      try {
        const { data: follows } = await supabase.from('user_follows').select('following_id').eq('follower_id', user.id)
        const followingIds = new Set(follows?.map(f => f.following_id) || [])
        setUsers(data.map(u => ({ ...u, is_following: followingIds.has(u.id) })))
      } catch {
        setUsers(data.map(u => ({ ...u, is_following: false })))
      }
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to search users", variant: "destructive" })
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
        .select(`id, content, media_url, likes_count, comments_count, created_at, user:users(id, full_name, profile_picture_url)`)
        .order('created_at', { ascending: false }).limit(50)
      if (error) throw error
      const { data: likes } = await supabase.from('forum_post_likes').select('post_id').eq('user_id', user.id)
      const likedPostIds = new Set(likes?.map(l => l.post_id) || [])
      setForumPosts(posts.map(p => ({
        ...p,
        user: Array.isArray(p.user) ? p.user[0] : p.user,
        is_liked: likedPostIds.has(p.id),
        showComments: false, comments: [],
      })))
    } catch (error) {}
  }

  const fetchFollowingPosts = async () => {
    if (!user) return
    try {
      const supabase = createClient()
      const { data: follows } = await supabase.from('user_follows').select('following_id').eq('follower_id', user.id)
      const followingIds = follows?.map(f => f.following_id) || []
      if (followingIds.length === 0) { setFollowingPosts([]); return }
      const { data: posts, error } = await supabase
        .from('forum_posts')
        .select(`id, content, media_url, likes_count, comments_count, created_at, user:users(id, full_name, profile_picture_url)`)
        .in('user_id', followingIds).order('created_at', { ascending: false }).limit(50)
      if (error) throw error
      setFollowingPosts(posts.map(p => ({
        ...p,
        user: Array.isArray(p.user) ? p.user[0] : p.user,
        showComments: false, comments: [],
      })))
    } catch (error) {}
  }

  const fetchComments = async (postId: string) => {
    if (!user) return
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('forum_post_comments')
        .select(`id, content, created_at, likes_count, replies_count, user:users(id, full_name, profile_picture_url)`)
        .eq('post_id', postId).order('created_at', { ascending: true })
      if (error) throw error
      const { data: commentLikes } = await supabase.from('forum_comment_likes').select('comment_id').eq('user_id', user.id)
      const likedCommentIds = new Set(commentLikes?.map(l => l.comment_id) || [])
      const comments = data.map((c: any) => ({
        ...c,
        user: Array.isArray(c.user) ? c.user[0] : c.user,
        is_liked: likedCommentIds.has(c.id),
        replies: [], showReplies: false,
      }))
      setForumPosts(prev => prev.map(p => p.id === postId ? { ...p, comments, loadingComments: false } : p))
      setFollowingPosts(prev => prev.map(p => p.id === postId ? { ...p, comments, loadingComments: false } : p))
    } catch (error) {
      setForumPosts(prev => prev.map(p => p.id === postId ? { ...p, loadingComments: false } : p))
    }
  }

  const fetchReplies = async (postId: string, commentId: string) => {
    if (!user) return
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('forum_comment_replies')
        .select(`id, content, created_at, user:users(id, full_name, profile_picture_url)`)
        .eq('comment_id', commentId).order('created_at', { ascending: true })
      if (error) throw error
      const replies = data.map((r: any) => ({ ...r, user: Array.isArray(r.user) ? r.user[0] : r.user }))
      const updateComments = (posts: ForumPost[]) =>
        posts.map(p => p.id === postId ? {
          ...p,
          comments: p.comments?.map(c => c.id === commentId ? { ...c, replies, loadingReplies: false } : c)
        } : p)
      setForumPosts(prev => updateComments(prev))
      setFollowingPosts(prev => updateComments(prev))
    } catch (error) {}
  }

  const toggleComments = async (postId: string) => {
    const post = forumPosts.find(p => p.id === postId) || followingPosts.find(p => p.id === postId)
    if (!post) return
    if (!post.showComments) {
      setForumPosts(prev => prev.map(p => p.id === postId ? { ...p, showComments: true, loadingComments: true } : p))
      setFollowingPosts(prev => prev.map(p => p.id === postId ? { ...p, showComments: true, loadingComments: true } : p))
      await fetchComments(postId)
    } else {
      setForumPosts(prev => prev.map(p => p.id === postId ? { ...p, showComments: false } : p))
      setFollowingPosts(prev => prev.map(p => p.id === postId ? { ...p, showComments: false } : p))
    }
  }

  const toggleReplies = async (postId: string, commentId: string) => {
    const post = forumPosts.find(p => p.id === postId) || followingPosts.find(p => p.id === postId)
    const comment = post?.comments?.find(c => c.id === commentId)
    if (!comment) return
    const updateComments = (posts: ForumPost[], show: boolean) =>
      posts.map(p => p.id === postId ? {
        ...p,
        comments: p.comments?.map(c => c.id === commentId ? { ...c, showReplies: show, loadingReplies: show } : c)
      } : p)
    if (!comment.showReplies) {
      setForumPosts(prev => updateComments(prev, true))
      setFollowingPosts(prev => updateComments(prev, true))
      await fetchReplies(postId, commentId)
    } else {
      setForumPosts(prev => updateComments(prev, false))
      setFollowingPosts(prev => updateComments(prev, false))
    }
  }

  const submitComment = async (postId: string) => {
    const content = newComments[postId]?.trim()
    if (!content || !user) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('forum_post_comments').insert({ post_id: postId, user_id: user.id, content })
      if (error) throw error
      const post = forumPosts.find(p => p.id === postId) || followingPosts.find(p => p.id === postId)
      await supabase.from('forum_posts').update({ comments_count: (post?.comments_count || 0) + 1 }).eq('id', postId)
      setNewComments(prev => ({ ...prev, [postId]: '' }))
      await fetchComments(postId)
      setForumPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p))
      setFollowingPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p))
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to post comment", variant: "destructive" })
    }
  }

  const submitReply = async (postId: string, commentId: string) => {
    const content = newReplies[commentId]?.trim()
    if (!content || !user) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('forum_comment_replies').insert({ comment_id: commentId, user_id: user.id, content })
      if (error) throw error
      const post = forumPosts.find(p => p.id === postId) || followingPosts.find(p => p.id === postId)
      const comment = post?.comments?.find(c => c.id === commentId)
      await supabase.from('forum_post_comments').update({ replies_count: (comment?.replies_count || 0) + 1 }).eq('id', commentId)
      setNewReplies(prev => ({ ...prev, [commentId]: '' }))
      setShowReplyInput(prev => ({ ...prev, [commentId]: false }))
      const updateComments = (posts: ForumPost[]) =>
        posts.map(p => p.id === postId ? {
          ...p,
          comments: p.comments?.map(c => c.id === commentId ? { ...c, replies_count: (c.replies_count || 0) + 1, showReplies: true } : c)
        } : p)
      setForumPosts(prev => updateComments(prev))
      setFollowingPosts(prev => updateComments(prev))
      await fetchReplies(postId, commentId)
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to post reply", variant: "destructive" })
    }
  }

  const likeComment = async (postId: string, commentId: string) => {
    if (!user) return
    try {
      const supabase = createClient()
      const post = forumPosts.find(p => p.id === postId) || followingPosts.find(p => p.id === postId)
      const comment = post?.comments?.find(c => c.id === commentId)
      if (comment?.is_liked) {
        await supabase.from('forum_comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id)
        await supabase.from('forum_post_comments').update({ likes_count: Math.max(0, (comment.likes_count || 0) - 1) }).eq('id', commentId)
      } else {
        await supabase.from('forum_comment_likes').insert({ comment_id: commentId, user_id: user.id })
        await supabase.from('forum_post_comments').update({ likes_count: (comment?.likes_count || 0) + 1 }).eq('id', commentId)
      }
      const updateComments = (posts: ForumPost[]) =>
        posts.map(p => p.id === postId ? {
          ...p,
          comments: p.comments?.map(c => c.id === commentId ? {
            ...c,
            is_liked: !c.is_liked,
            likes_count: c.is_liked ? Math.max(0, (c.likes_count || 0) - 1) : (c.likes_count || 0) + 1
          } : c)
        } : p)
      setForumPosts(prev => updateComments(prev))
      setFollowingPosts(prev => updateComments(prev))
    } catch (error) {
      toast({ title: "Error", description: "Failed to like comment", variant: "destructive" })
    }
  }

  const handleFollow = async (userId: string) => {
    if (!user) return
    try {
      const supabase = createClient()
      const isFollowing = users.find(u => u.id === userId)?.is_following
      if (isFollowing) {
        await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', userId)
      } else {
        await supabase.from('user_follows').insert({ follower_id: user.id, following_id: userId })
      }
      setUsers(users.map(u => u.id === userId ? { ...u, is_following: !isFollowing } : u))
      fetchFollowingPosts()
      toast({ title: "Success", description: isFollowing ? "Unfollowed successfully" : "Following user" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to update follow status", variant: "destructive" })
    }
  }

  const handleMessage = (userId: string) => router.push(`/messages?user=${userId}`)

  const createPost = async () => {
    if (!newPostContent.trim() || !user) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('forum_posts').insert({ user_id: user.id, content: newPostContent.trim() })
      if (error) throw error
      setNewPostContent("")
      setShowCreatePost(false)
      fetchForumPosts()
      toast({ title: "Success", description: "Post created successfully" })
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to create post", variant: "destructive" })
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
        await supabase.from('forum_post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
        await supabase.from('forum_posts').update({ likes_count: Math.max(0, (post.likes_count || 0) - 1) }).eq('id', postId)
      } else {
        await supabase.from('forum_post_likes').insert({ post_id: postId, user_id: user.id })
        await supabase.from('forum_posts').update({ likes_count: (post?.likes_count || 0) + 1 }).eq('id', postId)
      }
      fetchForumPosts()
    } catch (error) {
      toast({ title: "Error", description: "Failed to like post", variant: "destructive" })
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

  const renderPost = (post: ForumPost) => (
    <Card key={post.id}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.user?.profile_picture_url || "/placeholder.svg"} />
            <AvatarFallback>{post.user?.full_name?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{post.user?.full_name}</p>
            <p className="text-xs text-muted-foreground">{new Date(post.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm">{post.content}</p>
        {post.media_url && (
          <img src={post.media_url} alt="Post media" className="mt-3 rounded-lg w-full object-cover max-h-96" />
        )}
        <div className="flex gap-4 mt-4">
          <Button variant="ghost" size="sm" onClick={() => likePost(post.id)} className="gap-2">
            <Heart className={`h-4 w-4 ${post.is_liked ? 'fill-red-500 text-red-500' : ''}`} />
            <span className="text-sm">{post.likes_count}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toggleComments(post.id)} className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="text-sm">{post.comments_count}</span>
            {post.showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>

        {/* Comments Section */}
        {post.showComments && (
          <div className="mt-4 border-t pt-4 space-y-4">
            {post.loadingComments ? (
              <p className="text-xs text-muted-foreground text-center">Loading comments...</p>
            ) : post.comments?.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center">No comments yet. Be the first!</p>
            ) : (
              post.comments?.map(comment => (
                <div key={comment.id} className="space-y-2">
                  <div className="flex gap-2">
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarImage src={comment.user?.profile_picture_url || "/placeholder.svg"} />
                      <AvatarFallback className="text-xs">{comment.user?.full_name?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="bg-muted rounded-lg px-3 py-2">
                        <p className="text-xs font-semibold">{comment.user?.full_name}</p>
                        <p className="text-sm">{comment.content}</p>
                      </div>
                      {/* Comment Actions */}
                      <div className="flex items-center gap-3 mt-1 ml-1">
                        <button
                          onClick={() => likeComment(post.id, comment.id)}
                          className={`text-xs font-semibold ${comment.is_liked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}
                        >
                          ❤️ {comment.likes_count > 0 ? comment.likes_count : ''} Like
                        </button>
                        <button
                          onClick={() => setShowReplyInput(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                          className="text-xs font-semibold text-muted-foreground hover:text-primary"
                        >
                          💬 Reply
                        </button>
                        {comment.replies_count > 0 && (
                          <button
                            onClick={() => toggleReplies(post.id, comment.id)}
                            className="text-xs text-muted-foreground hover:text-primary"
                          >
                            {comment.showReplies ? '▲' : '▼'} {comment.replies_count} {comment.replies_count === 1 ? 'reply' : 'replies'}
                          </button>
                        )}
                        <span className="text-xs text-muted-foreground">{new Date(comment.created_at).toLocaleDateString()}</span>
                      </div>

                      {/* Reply Input */}
                      {showReplyInput[comment.id] && (
                        <div className="flex gap-2 mt-2">
                          <Avatar className="h-6 w-6 flex-shrink-0">
                            <AvatarImage src={profile?.profile_picture_url || "/placeholder.svg"} />
                            <AvatarFallback className="text-xs">{profile?.full_name?.[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 flex gap-2">
                            <Input
                              placeholder={`Reply to ${comment.user?.full_name}...`}
                              value={newReplies[comment.id] || ''}
                              onChange={(e) => setNewReplies(prev => ({ ...prev, [comment.id]: e.target.value }))}
                              onKeyPress={(e) => e.key === 'Enter' && submitReply(post.id, comment.id)}
                              className="text-sm h-7"
                            />
                            <Button size="sm" className="h-7 px-2" onClick={() => submitReply(post.id, comment.id)} disabled={!newReplies[comment.id]?.trim()}>
                              <Send className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Replies */}
                      {comment.showReplies && (
                        <div className="mt-2 ml-4 space-y-2">
                          {comment.loadingReplies ? (
                            <p className="text-xs text-muted-foreground">Loading replies...</p>
                          ) : (
                            comment.replies?.map(reply => (
                              <div key={reply.id} className="flex gap-2">
                                <CornerDownRight className="h-3 w-3 text-muted-foreground mt-2 flex-shrink-0" />
                                <Avatar className="h-6 w-6 flex-shrink-0">
                                  <AvatarImage src={reply.user?.profile_picture_url || "/placeholder.svg"} />
                                  <AvatarFallback className="text-xs">{reply.user?.full_name?.[0]?.toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="bg-muted rounded-lg px-3 py-1 flex-1">
                                  <p className="text-xs font-semibold">{reply.user?.full_name}</p>
                                  <p className="text-xs">{reply.content}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(reply.created_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Add Comment Input */}
            <div className="flex gap-2 mt-3">
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={profile?.profile_picture_url || "/placeholder.svg"} />
                <AvatarFallback className="text-xs">{profile?.full_name?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder="Write a comment..."
                  value={newComments[post.id] || ''}
                  onChange={(e) => setNewComments(prev => ({ ...prev, [post.id]: e.target.value }))}
                  onKeyPress={(e) => e.key === 'Enter' && submitComment(post.id)}
                  className="text-sm h-8"
                />
                <Button size="sm" className="h-8 px-2" onClick={() => submitComment(post.id)} disabled={!newComments[post.id]?.trim()}>
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

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
              <Button onClick={searchUsers} disabled={loading}>Search</Button>
            </div>
          </CardContent>
        </Card>

        {/* Search Results */}
        {users.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Search Results</h2>
            {users.map(u => (
              <Card key={u.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={u.profile_picture_url || "/placeholder.svg"} />
                      <AvatarFallback>{u.full_name[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{u.full_name}</h3>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                      <p className="text-sm text-muted-foreground">{u.country}</p>
                      {u.bio && <p className="text-sm mt-1 line-clamp-2">{u.bio}</p>}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant={u.is_following ? "secondary" : "default"} onClick={() => handleFollow(u.id)}>
                        {u.is_following ? <><UserCheck className="h-4 w-4 mr-1" />Following</> : <><UserPlus className="h-4 w-4 mr-1" />Follow</>}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleMessage(u.id)}>
                        <MessageCircle className="h-4 w-4 mr-1" />Message
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
          <Button onClick={() => setShowCreatePost(true)} className="w-full">
            <Send className="h-4 w-4 mr-2" />Create Post
          </Button>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Textarea
                placeholder="Share something with the community..."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                rows={4} className="resize-none"
              />
              <div className="flex gap-2">
                <Button onClick={createPost} disabled={loading || !newPostContent.trim()} className="flex-1">
                  <Send className="h-4 w-4 mr-2" />Post
                </Button>
                <Button variant="outline" onClick={() => { setShowCreatePost(false); setNewPostContent("") }}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Forum Posts */}
        <Tabs defaultValue="all" className="w-full" onValueChange={(value) => {
          if (value === 'following' && followingPosts.length === 0) fetchFollowingPosts()
        }}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">All Posts</TabsTrigger>
            <TabsTrigger value="following" className="flex-1">Following</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {forumPosts.length === 0 ? (
              <Card><CardContent className="pt-6 text-center text-muted-foreground">No posts yet</CardContent></Card>
            ) : (
              forumPosts.map(post => renderPost(post))
            )}
          </TabsContent>

          <TabsContent value="following" className="space-y-4">
            {followingPosts.length === 0 ? (
              <Card><CardContent className="pt-6 text-center text-muted-foreground">No posts from users you follow</CardContent></Card>
            ) : (
              followingPosts.map(post => renderPost(post))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}