"use client"

import { useState, useEffect } from "react"
import { Send, Download, TrendingUp, History, Copy, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"

interface Transaction {
  id: string
  type: "earn" | "spend" | "send" | "receive"
  amount: number
  description: string
  date: string
  status: "completed" | "pending"
}

export default function WalletPage() {
  const { toast } = useToast()
  const { user, profile } = useAuth()
  const [balance, setBalance] = useState(0)
  const [piBalance, setPiBalance] = useState(0)
  const [walletAddress] = useState("0x742d...a4f8")
  const [depositAmount, setDepositAmount] = useState("")
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [isDepositing, setIsDepositing] = useState(false)

  useEffect(() => {
    if (profile) {
      setBalance(Number(profile.w3tr_balance) || 0)
      setPiBalance(Number(profile.pi_balance) || 0)
    }
  }, [profile])

  const handlePiDeposit = async () => {
    const amount = Number(depositAmount)
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      })
      return
    }

    setIsDepositing(true)
    try {
      // In production, integrate with Pi Network SDK for actual payment
      const response = await fetch('/api/pi/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount,
          pi_payment_id: `pi_${Date.now()}`
        })
      })

      const data = await response.json()

      if (response.ok) {
        setPiBalance(data.new_balance)
        toast({
          title: "Deposit successful",
          description: `${amount} Pi has been added to your wallet`,
        })
        setIsDepositOpen(false)
        setDepositAmount("")
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast({
        title: "Deposit failed",
        description: "Failed to process deposit. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDepositing(false)
    }
  }

  const transactions: Transaction[] = [
    {
      id: "1",
      type: "earn",
      amount: 1,
      description: "Completed: What is Blockchain?",
      date: "2024-01-08",
      status: "completed",
    },
    {
      id: "2",
      type: "earn",
      amount: 1,
      description: "Completed: How Blockchain Works",
      date: "2024-01-08",
      status: "completed",
    },
    {
      id: "3",
      type: "earn",
      amount: 1,
      description: "Completed: Consensus Mechanisms",
      date: "2024-01-07",
      status: "completed",
    },
    {
      id: "4",
      type: "spend",
      amount: -10,
      description: "Enrolled: NFT Creation & Marketing",
      date: "2024-01-07",
      status: "completed",
    },
    {
      id: "5",
      type: "earn",
      amount: 1,
      description: "Completed: Introduction to DeFi",
      date: "2024-01-06",
      status: "completed",
    },
  ]

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress)
    toast({
      title: "Address copied",
      description: "Wallet address copied to clipboard",
    })
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Wallet</h1>
          <p className="text-muted-foreground">Manage your W3TR tokens</p>
        </div>

        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
          <CardHeader>
            <CardDescription className="text-primary-foreground/80">Total Balance</CardDescription>
            <CardTitle className="text-4xl font-bold flex items-baseline gap-2">
              {balance.toFixed(1)}
              <span className="text-xl font-normal">W3TR</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-primary-foreground/90">
              <TrendingUp className="h-4 w-4" />
              <span>+12.5 this week</span>
            </div>
          </CardContent>
        </Card>

        {/* Wallet Address */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Wallet Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-muted px-3 py-2 rounded">{walletAddress}</code>
              <Button variant="outline" size="icon" onClick={copyAddress}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2 bg-transparent">
                <Download className="h-5 w-5" />
                <span className="text-sm">Deposit Pi</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Deposit Pi</DialogTitle>
                <DialogDescription>
                  Add Pi tokens to your wallet to swap for W3TR
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="deposit-amount">Amount (Pi)</Label>
                  <Input
                    id="deposit-amount"
                    type="number"
                    placeholder="0.0"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  Current Pi balance: {piBalance.toFixed(4)} Pi
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDepositOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handlePiDeposit} disabled={isDepositing}>
                  {isDepositing ? "Processing..." : "Deposit"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2 bg-transparent">
            <Send className="h-5 w-5" />
            <span className="text-sm">Send</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2 bg-transparent">
            <Download className="h-5 w-5" />
            <span className="text-sm">Receive</span>
          </Button>
        </div>

        {/* Transactions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Transactions</h2>
            <Button variant="ghost" size="sm">
              <History className="h-4 w-4 mr-2" />
              View All
            </Button>
          </div>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">
                All
              </TabsTrigger>
              <TabsTrigger value="earn" className="flex-1">
                Earned
              </TabsTrigger>
              <TabsTrigger value="spend" className="flex-1">
                Spent
              </TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="space-y-2 mt-4">
              {transactions.map((tx) => (
                <Card key={tx.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            tx.type === "earn" || tx.type === "receive"
                              ? "bg-secondary/10 text-secondary"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {tx.type === "earn" || tx.type === "receive" ? (
                            <TrendingUp className="h-5 w-5" />
                          ) : (
                            <Send className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{tx.description}</div>
                          <div className="text-xs text-muted-foreground">{tx.date}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${tx.amount > 0 ? "text-secondary" : "text-destructive"}`}>
                          {tx.amount > 0 ? "+" : ""}
                          {tx.amount} W3TR
                        </div>
                        <Badge variant={tx.status === "completed" ? "secondary" : "outline"} className="text-xs">
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            <TabsContent value="earn" className="space-y-2 mt-4">
              {transactions
                .filter((tx) => tx.type === "earn" || tx.type === "receive")
                .map((tx) => (
                  <Card key={tx.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                            <TrendingUp className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{tx.description}</div>
                            <div className="text-xs text-muted-foreground">{tx.date}</div>
                          </div>
                        </div>
                        <div className="font-bold text-secondary">+{tx.amount} W3TR</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </TabsContent>
            <TabsContent value="spend" className="space-y-2 mt-4">
              {transactions
                .filter((tx) => tx.type === "spend" || tx.type === "send")
                .map((tx) => (
                  <Card key={tx.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                            <Send className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{tx.description}</div>
                            <div className="text-xs text-muted-foreground">{tx.date}</div>
                          </div>
                        </div>
                        <div className="font-bold text-destructive">{tx.amount} W3TR</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </TabsContent>
          </Tabs>
        </div>

        {/* Token Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              W3TR Token Info
              <ExternalLink className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Supply</span>
              <span className="font-medium">1,000,000,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Circulating</span>
              <span className="font-medium">45,230,500</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Learning Pool</span>
              <span className="font-medium">600M (60%)</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
