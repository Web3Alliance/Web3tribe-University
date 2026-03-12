"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestPaymentPage() {
  const [piReady, setPiReady] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Pi) {
      (window as any).Pi.init({ version: "2.0", sandbox: true })
      setPiReady(true)
    }
  }, [])

  const handlePiPayment = async () => {
    if (!(window as any).Pi) {
      setMessage("Pi SDK not loaded. Open this app inside Pi Browser.")
      return
    }

    try {
      const auth = await (window as any).Pi.authenticate(
        ["payments", "username"],
        (payment: any) => console.log("Incomplete payment", payment)
      )

      setMessage(`Authenticated as: ${auth.user.username}`)

      await (window as any).Pi.createPayment(
        {
          amount: 1,
          memo: "Test course payment",
          metadata: { test: true }
        },
        {
          onReadyForServerApproval: async (paymentId: string) => {
            setMessage(`Approving payment...`)
            // Call your approval API
            const res = await fetch("/api/pi/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId })
            })
            const data = await res.json()
            setMessage(`Payment approved!`)
            console.log("Approval response", data)
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            setMessage(`Payment complete! TxID: ${txid}`)
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
          <CardTitle>Test Pi Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Open inside Pi Browser to test.
          </p>
          <Button onClick={handlePiPayment} className="w-full">
            Pay 1 Pi (Test)
          </Button>
          {message && (
            <p className="text-sm p-3 bg-muted rounded-lg">{message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}