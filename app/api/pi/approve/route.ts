import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { paymentId } = await request.json()

  console.log("Approving payment:", paymentId)
  console.log("API Key exists:", !!process.env.PI_API_KEY)

  try {
    const response = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: "POST",
        headers: {
          "Authorization": `Key ${process.env.PI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    )

    const data = await response.json()
    console.log("Pi API response:", data)

    if (!response.ok) {
      return NextResponse.json({ 
        error: "Pi API error", 
        details: data,
        status: response.status 
      }, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.log("Approval error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}