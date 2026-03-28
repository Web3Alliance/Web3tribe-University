import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { paymentId } = await request.json()

  // Call Pi Backend API to cancel
  // You need your Pi API Key from the Pi Developer Console
  const PI_API_KEY = process.env.bndbf6stdkkxvmzzgi67mic88sgmmjnul2sef4iylyy9wjkx5rlvigdltzbbfmgc 

  try {
    const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/cancel`, {
      method: "POST",
      headers: {
        "Authorization": `Key ${PI_API_KEY}`,
        "Content-Type": "application/json"
      }
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Pi Cancel Error:", data)
      return NextResponse.json({ error: data }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Server Error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}