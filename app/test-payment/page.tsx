"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestPaymentPage() {
  const [piReady, setPiReady] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [message, setMessage] = useState("Initializing Pi SDK...")

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Pi) {
      // 1. Initialize Pi SDK
      (window as any).Pi.init({ version: "2.0", sandbox: true })
      setPiReady(true)

      // 2. Authenticate and Process Pending Payments automatically
      authenticateAndResolvePending()
    } else {
      setMessage("Pi SDK not found. Please open in Pi Browser.")
    }
  }, [])

  const authenticateAndResolvePending = async () => {
    try {
      const auth = await (window as any).Pi.authenticate(
        ["payments", "username"],
        // This function is called AUTOMATICALLY for any incomplete payment found
        async (payment: any) => {
          setMessage(`Found pending payment: ${payment.identifier}. Resolving...`)
          console.log("Incomplete payment found:", payment)

          // Ideally, your backend should handle checking the status.
          // We try to complete it. If it wasn't approved yet, your backend 
          // should handle approval logic or return an appropriate error.
          try {
             const res = await fetch("/api/pi/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentId: payment.identifier,
                txid: payment.transaction?.txid // Might be null if not completed on chain
              })
            })
            const data = await res.json()
            console.log("Pending payment resolved:", data)
          } catch (err) {
            console.error("Failed to resolve pending payment", err)
          }
        }
      )

      // 3. Authentication successful
      setIsAuthenticated(true)
      setMessage(`Authenticated as: ${auth.user.username}. Ready to pay.`)
    } catch (error: any) {
      console.error("Auth error", error)
      setMessage(`Authentication failed: ${error.message}`)
    }
  }

  const handleNewPiPayment = async () => {
    if (!(window as any).Pi || !isAuthenticated) {
      setMessage("Please wait for authentication...")
      return
    }

    setMessage("Starting payment...")

    try {
      await (window as any).Pi.createPayment(
        {
          amount: 1,
          memo: "Test course payment",
          metadata: { test: true }
        },
        {
          onReadyForServerApproval: async (paymentId: string) => {
            setMessage(`Approving payment ${paymentId}...`)
            try {
              const res = await fetch("/api/pi/approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentId })
              })
              const data = await res.json()
              console.log("Approval response", data)
              setMessage("Payment approved. Waiting for user to finish...")
            } catch (err) {
              console.error("Approval error", err)
              setMessage("Error during approval.")
            }
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            setMessage(`Completing payment (TxID: ${txid})...`)
            try {
              const res = await fetch("/api/pi/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentId, txid })
              })
              const data = await res.json()
              console.log("Completion response", data)
              setMessage(`Success! Payment Complete.`)
            } catch (err) {
              console.error("Completion error", err)
              setMessage("Error during completion.")
            }
          },
          onCancel: (paymentId: string) => {
            setMessage("Payment cancelled by user.")
            console.log("Cancelled", paymentId)
          },
          onError: (error: any, payment: any) => {
            setMessage(`Error: ${error.message}`)
            console.error("Payment Error", error, payment)
          }
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
            disabled={!isAuthenticated}
          >
            {isAuthenticated ? "Pay 1 Pi (Test)" : "Authenticating..."}
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            Open inside Pi Browser. Pending payments are processed automatically on load.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}