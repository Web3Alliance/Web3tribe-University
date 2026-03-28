"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestPaymentPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [statusMessage, setStatusMessage] = useState("Initializing Pi SDK...")
  const isInitializing = useRef(false)

  useEffect(() => {
    if (isInitializing.current) return
    isInitializing.current = true

    const initPiSDK = async () => {
      // Wait for script
      let attempts = 0
      while (!(window as any).Pi && attempts < 20) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        attempts++
      }

      const Pi = (window as any).Pi
      if (!Pi) {
        setStatusMessage("Error: Pi SDK not found. Open in Pi Browser.")
        return
      }

      try {
        Pi.init({ version: "2.0", sandbox: true })
        
        setStatusMessage("Checking for pending payments...")
        
        const auth = await Pi.authenticate(
          ["payments", "username"],
          onIncompletePaymentFound // This handles the stuck payment
        )

        setIsAuthenticated(true)
        setStatusMessage(`Ready. Logged in as ${auth.user.username}.`)
        
      } catch (error: any) {
        console.error("Auth Error:", error)
        setStatusMessage(`Error: ${error.message}`)
      }
    }

    initPiSDK()
  }, [])

  // THIS FUNCTION HANDLES THE STUCK PAYMENT
  const onIncompletePaymentFound = async (payment: any) => {
    console.log("Found incomplete payment:", payment)
    setStatusMessage(`Found pending payment: ${payment.identifier}`)

    // SCENARIO A: Payment has a TXID (User signed it) -> COMPLETE IT
    if (payment.transaction && payment.transaction.txid) {
      setStatusMessage("Completing signed payment...")
      try {
        const res = await fetch("/api/pi/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId: payment.identifier,
            txid: payment.transaction.txid
          })
        })
        const data = await res.json()
        console.log("Payment completed:", data)
        setStatusMessage("Previous payment completed!")
      } catch (err) {
        console.error("Error completing payment", err)
      }
    } 
    // SCENARIO B: Payment has NO TXID (User cancelled or closed app) -> CANCEL IT
    else {
      setStatusMessage("Cancelling unsigned pending payment...")
      try {
        const res = await fetch("/api/pi/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: payment.identifier })
        })
        const data = await res.json()
        console.log("Payment cancelled:", data)
        setStatusMessage("Stuck payment cleared. You can now pay.")
      } catch (err) {
        console.error("Error cancelling payment", err)
        setStatusMessage("Error clearing stuck payment.")
      }
    }
  }

  const handleNewPayment = async () => {
    const Pi = (window as any).Pi
    if (!Pi || !isAuthenticated) return
    setStatusMessage("Starting payment...")

    try {
      await Pi.createPayment(
        { amount: 1, memo: "Test course payment", metadata: { test: true } },
        {
          onReadyForServerApproval: async (paymentId: string) => {
            setStatusMessage("Approving...")
            await fetch("/api/pi/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId })
            })
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            setStatusMessage("Completing...")
            await fetch("/api/pi/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId, txid })
            })
            setStatusMessage("Success!")
          },
          onCancel: (paymentId: string) => {
            // IMPORTANT: Also call cancel API here so it doesn't get stuck next time
            fetch("/api/pi/cancel", { 
                method: "POST", 
                body: JSON.stringify({ paymentId }) 
            })
            setStatusMessage("Payment cancelled")
          },
          onError: (error: any) => setStatusMessage(`Error: ${error.message}`)
        }
      )
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Payment Integration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm p-3 bg-muted rounded-lg min-h-[60px]">{statusMessage}</div>
          <Button onClick={handleNewPayment} className="w-full" disabled={!isAuthenticated}>
            {isAuthenticated ? "Pay 1 Pi (Test)" : "Authenticating..."}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}