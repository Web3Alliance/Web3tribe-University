"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import Loading from "./loading"

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get("token")
      const type = searchParams.get("type")

      if (!token || type !== "signup") {
        setStatus("error")
        setMessage("Invalid verification link")
        return
      }

      try {
        const supabase = createClient()
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: "signup",
        })

        if (error) throw error

        setStatus("success")
        setMessage("Your email has been verified! You can now sign in.")

        // Redirect to home page after 3 seconds
        setTimeout(() => {
          router.push("/")
        }, 3000)
      } catch (error) {
        console.error("Verification error:", error)
        setStatus("error")
        setMessage("Failed to verify email. The link may have expired.")
      }
    }

    verifyEmail()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              {status === "loading" && (
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
              )}
              {status === "success" && (
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              )}
              {status === "error" && (
                <XCircle className="h-16 w-16 text-destructive" />
              )}
            </div>
            <CardTitle>
              {status === "loading" && "Verifying Email"}
              {status === "success" && "Email Verified!"}
              {status === "error" && "Verification Failed"}
            </CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent>
            {status === "success" && (
              <p className="text-sm text-center text-muted-foreground">
                Redirecting you to the home page...
              </p>
            )}
            {status === "error" && (
              <Button
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => router.push("/")}
              >
                Return to Home
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
