"use client"

import { useState, useEffect } from "react"
import { ArrowDownUp, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"

export default function SwapPage() {
  const { toast } = useToast()
  const { profile } = useAuth()
  const [fromAmount, setFromAmount] = useState("")
  const [toAmount, setToAmount] = useState("")
  const [fromToken, setFromToken] = useState<"w3tr" | "pi">("pi")
  const [isSwapping, setIsSwapping] = useState(false)
  const [w3trBalance, setW3trBalance] = useState(0)
  const [piBalance, setPiBalance] = useState(0)

  const exchangeRate = 100 // 1 Pi = 100 W3TR

  useEffect(() => {
    if (profile) {
      setW3trBalance(Number(profile.w3tr_balance) || 0)
      setPiBalance(Number(profile.pi_balance) || 0)
    }
  }, [profile])

  const handleSwap = async () => {
    const amount = Number(fromAmount)
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount to swap",
        variant: "destructive",
      })
      return
    }

    if (fromToken === "w3tr" && amount > w3trBalance) {
      toast({
        title: "Insufficient balance",
        description: "You don't have enough W3TR tokens",
        variant: "destructive",
      })
      return
    }

    if (fromToken === "pi" && amount > piBalance) {
      toast({
        title: "Insufficient balance",
        description: "You don't have enough Pi tokens",
        variant: "destructive",
      })
      return
    }

    setIsSwapping(true)
    try {
      const response = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount,
          from_token: fromToken
        })
      })

      const data = await response.json()

      if (response.ok) {
        setW3trBalance(data.new_w3tr_balance)
        setPiBalance(data.new_pi_balance)
        toast({
          title: "Swap successful",
          description: `Swapped ${amount} ${fromToken.toUpperCase()} to ${data.to_amount.toFixed(4)} ${fromToken === "w3tr" ? "Pi" : "W3TR"}`,
        })
        setFromAmount("")
        setToAmount("")
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('[v0] Swap error:', error)
      toast({
        title: "Swap failed",
        description: "Failed to process swap. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSwapping(false)
    }
  }

  const handleAmountChange = (value: string) => {
    setFromAmount(value)
    if (value) {
      const amount = Number(value)
      if (fromToken === "w3tr") {
        setToAmount((amount / exchangeRate).toFixed(4))
      } else {
        setToAmount((amount * exchangeRate).toFixed(2))
      }
    } else {
      setToAmount("")
    }
  }

  const switchTokens = () => {
    setFromToken(fromToken === "w3tr" ? "pi" : "w3tr")
    setFromAmount("")
    setToAmount("")
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Token Swap</h1>
          <p className="text-muted-foreground">Exchange W3TR and Pi tokens</p>
        </div>

        {/* Exchange Rate */}
        <Card className="bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Exchange Rate</span>
              <span className="font-medium">1 Pi = 100 W3TR</span>
            </div>
          </CardContent>
        </Card>

        {/* Swap Interface */}
        <Card>
          <CardHeader>
            <CardTitle>Swap Tokens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* From */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>From</Label>
                <span className="text-sm text-muted-foreground">
                  Balance: {fromToken === "w3tr" ? w3trBalance : piBalance} {fromToken === "w3tr" ? "W3TR" : "Pi"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={fromAmount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="flex-1"
                />
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg font-medium min-w-20 justify-center">
                  {fromToken === "w3tr" ? "W3TR" : "Pi"}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => handleAmountChange(fromToken === "w3tr" ? w3trBalance.toString() : piBalance.toString())}
              >
                Max
              </Button>
            </div>

            {/* Switch Button */}
            <div className="flex justify-center">
              <Button variant="outline" size="icon" onClick={switchTokens} className="rounded-full bg-transparent">
                <ArrowDownUp className="h-4 w-4" />
              </Button>
            </div>

            {/* To */}
            <div className="space-y-2">
              <Label>To</Label>
              <div className="flex items-center gap-2">
                <Input type="number" placeholder="0.0" value={toAmount} readOnly className="flex-1 bg-muted" disabled />
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg font-medium min-w-20 justify-center">
                  {fromToken === "w3tr" ? "Pi" : "W3TR"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Swap Button */}
        <Button size="lg" className="w-full" onClick={handleSwap} disabled={isSwapping}>
          {isSwapping ? "Processing..." : "Swap Tokens"}
        </Button>

        {/* Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4" />
              About Token Swap
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>You can swap between W3TR and Pi tokens at any time. The exchange rate is fixed at 1 Pi = 100 W3TR.</p>
            <p>Swaps are instant and there are no fees for exchanging tokens within the app.</p>
          </CardContent>
        </Card>

        {/* Balances */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{w3trBalance}</div>
                <div className="text-xs text-muted-foreground mt-1">W3TR Balance</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{piBalance}</div>
                <div className="text-xs text-muted-foreground mt-1">Pi Balance</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
