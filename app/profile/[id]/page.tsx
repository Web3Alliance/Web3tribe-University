"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, UserPlus, UserCheck, MessageCircle, MapPin, Calendar, Edit } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { sendNotification } from "@/lib/notifications"

interface UserProfile {
  id: string
  full_name: string
  email: string
  profile_picture_url?: string
  bio?: string
  country: string
  w3tr_balance: number
  created_at: string
}

interface Post {
  id: string
  content: string
  likes_count: number
  comments_count: number
  created_at: string
}

export default function UserProfilePage() {
  const router = useRouter()
  const params = useParams()
  const { user, profile: currentUserProfile } = useAuth()
  const { toast } = useToast()
  
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)

  const profileId = params.id as string

  useEffect(() => {
    if (profileId) {
      fetchProfileData()
    }
  }, [profileId])

  const fetchProfileData = async () => {
    setLoading(true)
    try {
      const supabase = createClient()

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', profileId)
        .single()

      if (userError || !userData) {
        toast({ title: "Error", description: "User not found", variant: "destructive" })
        router.back()
        return
      }
      setProfileUser(userData)

      if (user && user.id !== profileId) {
        const { data: followData } = await supabase
          .from('user_follows')
          .select('*')
          .eq('follower_id', user.id)
          .eq('following_id', profileId)
          .single()
        
        setIsFollowing(!!followData)
      }

      const { data: postsData } = await supabase
        .from('forum_posts')
        .select('id, content, likes_count, comments_count, created_at')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false })

      setPosts(postsData || [])

    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleFollow = async () => {
    if (!user || !profileUser) return
    try {
      const supabase = createClient()
      
      if (isFollowing) {
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profileId)
        setIsFollowing(false)
      } else {
        await supabase
          .from('user_follows')
          .insert({ follower_id: user.id, following_id: profileId })
        setIsFollowing(true)
        
        await sendNotification(
          profileId,
          user.id,
          'follow',
          `${currentUserProfile?.full_name} started following you`
        )
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update follow status", variant: "destructive" })
    }
  }

  if (loading || !profileUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isOwnProfile = user?.id === profileId

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg truncate">{profileUser.full_name}</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        
        {/* Profile Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profileUser.profile_picture_url || "/placeholder.svg"} />
                <AvatarFallback className="text-3xl">{profileUser.full_name?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              
              <div>
                <h2 className="text-2xl font-bold">{profileUser.full_name}</h2>
                {profileUser.country && (
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mt-1">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">{profileUser.country}</span>
                  </div>
                )}
              </div>

              {profileUser.bio && (
                <p className="text-sm text-muted-foreground max-w-md">{profileUser.bio}</p>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Joined {new Date(profileUser.created_at).toLocaleDateString()}
              </div>

              {/* Action Buttons */}
              {isOwnProfile ? (
                <Button 
                  className="w-full max-w-xs mt-2"
                  onClick={() => router.push('/profile')}
                >
                  <Edit className="h-4 w-4 mr-2" /> Edit Profile
                </Button>
              ) : (
                user && (
                  <div className="flex gap-2 w-full pt-2">
                    <Button 
                      className="flex-1" 
                      variant={isFollowing ? "secondary" : "default"}
                      onClick={handleFollow}
                    >
                      {isFollowing ? (
                        <><UserCheck className="h-4 w-4 mr-2" /> Following</>
                      ) : (
                        <><UserPlus className="h-4 w-4 mr-2" /> Follow</>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => router.push(`/messages?user=${profileId}`)}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" /> Message
                    </Button>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Posts Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Recent Activity</h3>
          
          {posts.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground text-sm">
                No posts yet.
              </CardContent>
            </Card>
          ) : (
            posts.map(post => (
              <Card key={post.id} className="cursor-pointer hover:border-primary/50 transition-colors">
                <CardContent className="pt-4">
                  <p className="text-sm mb-2">{post.content}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{post.likes_count} likes</span>
                    <span>{post.comments_count} comments</span>
                    <span className="ml-auto">{new Date(post.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

      </div>
    </div>
  )
}