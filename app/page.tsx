"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestPaymentPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState("Initializing...")

  useEffect(() => {
    const initPi = async () => {
      // 1. Check if window and Pi object exist
      if (typeof window !== "undefined" && (window as any).Pi) {
        try {
          // 2. Initialize the SDK
          console.log("Initializing Pi SDK...")
          ;(window as any).Pi.init({ version: "2.0", sandbox: true })
          console.log("Pi SDK Initialized.")
          
          // 3. Automatically Authenticate
          await authenticateUser()
        } catch (err) {
          console.error("Init Error:", err)
          setMessage("Failed to initialize Pi SDK.")
        } finally {
          setIsLoading(false)
        }
      } else {
        // If Pi is undefined, the script from Step 1 is missing or blocked
        setMessage("Error: Pi SDK not found. Open in Pi Browser.")
        setIsLoading(false)
      }
    }

    initPi()
  }, [])

  const authenticateUser = async () => {
    setMessage("Authenticating...")
    try {
      const auth = await (window as any).Pi.authenticate(
        ["payments", "username"],
        onIncompletePaymentFound
      )
      
      console.log("Auth success:", auth)
      setIsAuthenticated(true)
      setMessage(`Hello, ${auth.user.username}! Ready to pay.`)
    } catch (error: any) {
      console.error("Auth error", error)
      setMessage(`Authentication failed: ${error.message}`)
    }
  }

  // Helper function specifically to type the payment argument
  const onIncompletePaymentFound = async (payment: any) => {
    console.log("Found incomplete payment:", payment)
    setMessage(`Resolving pending payment...`)

    try {
      // 1. Approve the payment first if it was stuck
      if (payment.status === "created" || payment.status === "approved") {
         // You might need an approve endpoint here, but usually, 
         // just completing it handles the 'approved' state.
      }

      // 2. Complete the payment
      const res = await fetch("/api/pi/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.identifier,
          txid: payment.transaction?.txid
        })
      })
      
      const data = await res.json()
      console.log("Pending payment resolved:", data)
      setMessage("Pending payment processed!")
      
    } catch (err) {
      console.error("Error resolving payment", err)
    }
  }

  const handleNewPiPayment = async () => {
    if (!(window as any).Pi || !isAuthenticated) return

    setMessage("Starting payment...")

    try {
      (window as any).Pi.createPayment(
        {
          amount: 1,
          memo: "Test course payment",
          metadata: { test: true }
        },
        {
          onReadyForServerApproval: async (paymentId: string) => {
            setMessage("Approving...")
            await fetch("/api/pi/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId })
            })
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            setMessage("Completing...")
            await fetch("/api/pi/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId, txid })
            })
            setMessage("Payment Complete!")
          },
          onCancel: () => setMessage("Payment cancelled"),
          onError: (error: any) => setMessage(`Error: ${error.message}`)
        }
      )
    } catch (error: any) {
      setMessage(`Error: ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Pi Payment Integration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm p-3 bg-muted rounded-lg min-h-[60px]">
            {message}
          </div>
          
          <Button 
            onClick={handleNewPiPayment} 
            className="w-full"
            disabled={!isAuthenticated || isLoading}
          >
            {isLoading ? "Loading..." : "Pay 1 Pi (Test)"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}