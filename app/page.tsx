"use client"

import { useState, useEffect, memo } from "react"
import { BookOpen, Users, Award, ArrowRight, Coins } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"

// Lazy load auth modals - only load when needed
const SignupModal = dynamic(() => import("@/components/auth/signup-modal").then(mod => ({ default: mod.SignupModal })), { ssr: false })
const LoginModal = dynamic(() => import("@/components/auth/login-modal").then(mod => ({ default: mod.LoginModal })), { ssr: false })

// Stats section with real data
const StatsSection = memo(({ stats }: { stats: { courses: number; learners: number; tokensEarned: number } }) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M+`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K+`
    return num.toString()
  }

  return (
    <section className="px-4 py-6 max-w-lg mx-auto">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <BookOpen className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{formatNumber(stats.courses)}</div>
            <div className="text-xs text-muted-foreground">Courses</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="h-6 w-6 mx-auto mb-2 text-secondary" />
            <div className="text-2xl font-bold">{formatNumber(stats.learners)}</div>
            <div className="text-xs text-muted-foreground">Learners</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Award className="h-6 w-6 mx-auto mb-2 text-accent" />
            <div className="text-2xl font-bold">{formatNumber(stats.tokensEarned)}</div>
            <div className="text-xs text-muted-foreground">Tokens Earned</div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
})
StatsSection.displayName = 'StatsSection'

export default function HomePage() {
  const { user } = useAuth()
  const [showSignup, setShowSignup] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [stats, setStats] = useState({ courses: 0, learners: 0, tokensEarned: 0 })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats')
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        // Silent error
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="px-4 pt-6 pb-8 max-w-lg mx-auto">
        <div className="text-center space-y-4">
          <Badge variant="secondary" className="mb-2">
            <Coins className="h-3 w-3 mr-1" />
            Earn W3TR Tokens
          </Badge>
          <h1 className="text-4xl font-bold leading-tight text-balance">Learn, Earn, and Grow with Emerging Technologies</h1>
          <p className="text-muted-foreground leading-relaxed">
            Complete industry-relevant courses, earn W3TR tokens, and unlock your potential in the global digital economy.
          </p>
          {!user ? (
            <div className="flex flex-col gap-3 w-full">
              <Button size="lg" className="w-full" onClick={() => setShowSignup(true)}>
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="w-full bg-transparent" onClick={() => setShowLogin(true)}>
                Login
              </Button>
            </div>
          ) : (
            <Button size="lg" className="w-full" asChild>
              <Link href="/courses">
                Browse Courses
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </section>

      {/* Stats Section */}
      <StatsSection stats={stats} />

      {/* How It Works */}
      <section className="px-4 py-6 max-w-lg mx-auto">
        <h2 className="text-2xl font-bold mb-4">How It Works</h2>
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">1</span>
                </div>
                <div>
                  <CardTitle className="text-base">Choose a Course</CardTitle>
                  <CardDescription className="text-sm">Browse our catalog of Web3 courses</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-secondary font-bold">2</span>
                </div>
                <div>
                  <CardTitle className="text-base">Complete Modules</CardTitle>
                  <CardDescription className="text-sm">
                    Learn at your own pace and earn 1 W3TR per module
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-accent font-bold">3</span>
                </div>
                <div>
                  <CardTitle className="text-base">Earn & Use Tokens</CardTitle>
                  <CardDescription className="text-sm">
                    Hold, transfer, or use tokens for premium courses
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Tokenomics */}
      <section className="px-4 py-6 max-w-lg mx-auto">
        <h2 className="text-2xl font-bold mb-4">W3TR Tokenomics</h2>
        <Card>
          <CardHeader>
            <CardTitle>Total Supply: 1 Billion W3TR</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Learning Rewards</span>
              <Badge variant="secondary">60%</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Team</span>
              <Badge variant="outline">20%</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Investors</span>
              <Badge variant="outline">10%</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Charity</span>
              <Badge variant="outline">5%</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">R&D</span>
              <Badge variant="outline">5%</Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <section className="px-4 py-8 max-w-lg mx-auto border-t border-border mt-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">W3</span>
            </div>
            <span className="font-semibold">Web3Tribe University</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Learn Web3 and earn W3TR tokens
          </p>
          <div className="flex items-center justify-center gap-4 text-sm">
            <a 
              href="https://www.tribe.theweb3alliance.org/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Website
            </a>
            <span className="text-muted-foreground">•</span>
            <a 
              href="https://github.com/Web3Alliance/Web3tribe-University" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <span className="text-muted-foreground">•</span>
            <a 
              href="https://profiles.pinet.com/profiles/skiibiidarsh" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              @Skiibiidarsh
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Built by Web3Alliance • Version 1.0.0
          </p>
        </div>
      </section>

      {/* Auth Modals */}
      <SignupModal 
        open={showSignup} 
        onOpenChange={setShowSignup}
        onSwitchToLogin={() => {
          setShowSignup(false)
          setShowLogin(true)
        }}
      />
      <LoginModal
        open={showLogin}
        onOpenChange={setShowLogin}
        onSwitchToSignup={() => {
          setShowLogin(false)
          setShowSignup(true)
        }}
      />
    </div>
  )
}
