"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestPaymentPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [statusMessage, setStatusMessage] = useState("Initializing Pi SDK...")
  // Prevents double initialization in React Strict Mode
  const isInitializing = useRef(false)

  useEffect(() => {
    if (isInitializing.current) return
    isInitializing.current = true

    const initPiSDK = async () => {
      // 1. Wait for Pi Script to load
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
        // 2. Initialize
        console.log("Initializing Pi...")
        Pi.init({ version: "2.0", sandbox: true })
        console.log("Pi Initialized.")
        
        // 3. Authenticate (This triggers onIncompletePaymentFound automatically)
        setStatusMessage("Authenticating...")
        const auth = await Pi.authenticate(
          ["payments", "username"],
          onIncompletePaymentFound // <--- THIS HANDLES ALL PENDING PAYMENTS
        )

        console.log("Auth success:", auth)
        setIsAuthenticated(true)
        setStatusMessage(`Ready. Logged in as ${auth.user.username}.`)
        
      } catch (error: any) {
        console.error("Init/Auth Error:", error)
        setStatusMessage(`Error: ${error.message}`)
      }
    }

    initPiSDK()
  }, [])

  // THIS FUNCTION PROCESSES ALL PENDING PAYMENTS AUTOMATICALLY
  const onIncompletePaymentFound = async (payment: any) => {
    console.log("⚠️ Incomplete payment detected:", payment)
    setStatusMessage(`Resolving pending payment: ${payment.identifier}...`)

    try {
      // 1. Try to complete the payment via your backend
      const res = await fetch("/api/pi/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.identifier,
          txid: payment.transaction?.txid // Might be missing if not signed
        })
      })
      
      const data = await res.json()

      if (res.ok) {
        console.log("✅ Pending payment resolved:", data)
        setStatusMessage("Pending payment resolved successfully!")
      } else {
        // Handle cases where backend says "Not approved yet" or other errors
        console.error("Backend error resolving payment:", data)
        setStatusMessage(`Error resolving payment: ${data.error}`)
      }
    } catch (err) {
      console.error("Network error resolving payment", err)
      setStatusMessage("Network error resolving pending payment.")
    }
  }

  // THIS FUNCTION HANDLES NEW PAYMENTS
  const handleNewPayment = async () => {
    const Pi = (window as any).Pi
    if (!Pi || !isAuthenticated) return

    setStatusMessage("Starting new payment...")
    
    try {
      await Pi.createPayment(
        {
          amount: 1,
          memo: "Test course payment",
          metadata: { courseId: "test-101" }
        },
        {
          // Step 1: Backend Approval
          onReadyForServerApproval: async (paymentId: string) => {
            setStatusMessage("Payment created. Approving...")
            try {
              const res = await fetch("/api/pi/approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentId })
              })
              const data = await res.json()
              console.log("Approval response", data)
              setStatusMessage("Approved. Waiting for blockchain completion...")
            } catch (err) {
              console.error("Approval error", err)
              setStatusMessage("Error during server approval.")
            }
          },
          // Step 2: Backend Completion
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            setStatusMessage(`Blockchain tx found. Completing...`)
            try {
              const res = await fetch("/api/pi/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentId, txid })
              })
              const data = await res.json()
              console.log("Completion response", data)
              setStatusMessage("✅ Payment Successful!")
            } catch (err) {
              console.error("Completion error", err)
              setStatusMessage("Error during server completion.")
            }
          },
          onCancel: (paymentId: string) => {
            setStatusMessage("Payment cancelled by user.")
            console.log("Cancelled", paymentId)
          },
          onError: (error: any, payment: any) => {
            setStatusMessage(`Payment Error: ${error.message}`)
            console.error("Payment Error", error, payment)
          }
        }
      )
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Pi Payment Integration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm p-3 bg-muted rounded-lg min-h-[60px] break-words">
            {statusMessage}
          </div>
          
          <Button 
            onClick={handleNewPayment} 
            className="w-full"
            disabled={!isAuthenticated}
          >
            {isAuthenticated ? "Pay 1 Pi (Test)" : "Authenticating..."}
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            Pending payments are processed automatically on load.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}