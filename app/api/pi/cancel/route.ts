import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { paymentId } = await request.json()

  try {
    const response = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/cancel`,
      {
        method: "POST",
        headers: {
          "Authorization": `Key ${process.env.PI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    )

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}