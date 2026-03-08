"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Wallet, CreditCard, Check } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { mockCourses } from "@/lib/mock-data"
import { useToast } from "@/hooks/use-toast"

export default function PaymentPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [paymentMethod, setPaymentMethod] = useState<"w3tr" | "fiat">("w3tr")
  const [fiatAmount, setFiatAmount] = useState("")

  const course = mockCourses.find((c) => c.id === params.id)

  if (!course || !course.isPaid) {
    return (
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
        <p className="text-center text-muted-foreground">Course not available for purchase</p>
      </div>
    )
  }

  const handlePayment = () => {
    if (paymentMethod === "w3tr") {
      // Process W3TR payment
      console.log("[v0] Processing W3TR payment for", course.price, "W3TR")
      toast({
        title: "Payment successful",
        description: "You are now enrolled in the course",
      })
    } else {
      // Process fiat payment
      console.log("[v0] Processing fiat payment for", fiatAmount, "USD")
      toast({
        title: "Payment processing",
        description: "Your payment is being processed",
      })
    }
    setTimeout(() => {
      router.push(`/courses/${course.id}`)
    }, 1500)
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/courses/${course.id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Course
          </Link>
        </Button>

        <div>
          <h1 className="text-3xl font-bold mb-2">Checkout</h1>
          <p className="text-muted-foreground">Complete your enrollment</p>
        </div>

        {/* Course Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{course.title}</CardTitle>
            <CardDescription>{course.instructor}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Price</span>
              <span className="text-2xl font-bold text-primary">{course.price} W3TR</span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
              <div className="flex items-center space-x-3 border border-border rounded-lg p-4 cursor-pointer hover:bg-accent/50">
                <RadioGroupItem value="w3tr" id="w3tr" />
                <Label htmlFor="w3tr" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">Pay with W3TR</div>
                      <div className="text-xs text-muted-foreground">Use your wallet balance</div>
                    </div>
                  </div>
                </Label>
                {paymentMethod === "w3tr" && <Check className="h-5 w-5 text-primary" />}
              </div>

              <div className="flex items-center space-x-3 border border-border rounded-lg p-4 cursor-pointer hover:bg-accent/50">
                <RadioGroupItem value="fiat" id="fiat" />
                <Label htmlFor="fiat" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">Buy W3TR with Fiat</div>
                      <div className="text-xs text-muted-foreground">Purchase tokens to enroll</div>
                    </div>
                  </div>
                </Label>
                {paymentMethod === "fiat" && <Check className="h-5 w-5 text-primary" />}
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Fiat Payment Details */}
        {paymentMethod === "fiat" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Buy W3TR Tokens</CardTitle>
              <CardDescription>1 W3TR = $0.50 USD</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={fiatAmount}
                  onChange={(e) => setFiatAmount(e.target.value)}
                />
                {fiatAmount && (
                  <p className="text-sm text-muted-foreground">
                    You will receive {(Number(fiatAmount) / 0.5).toFixed(1)} W3TR
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="card">Card Number</Label>
                <Input id="card" placeholder="4242 4242 4242 4242" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="expiry">Expiry</Label>
                  <Input id="expiry" placeholder="MM/YY" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input id="cvc" placeholder="123" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* W3TR Balance */}
        {paymentMethod === "w3tr" && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Your W3TR Balance</span>
                <span className="text-xl font-bold">47.5 W3TR</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Button */}
        <Button size="lg" className="w-full" onClick={handlePayment}>
          {paymentMethod === "w3tr" ? `Pay ${course.price} W3TR` : "Buy & Enroll"}
        </Button>
      </div>
    </div>
  )
}
