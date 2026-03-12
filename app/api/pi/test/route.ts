import { NextResponse } from "next/server"

export async function GET() {
  const apiKey = process.env.PI_API_KEY
  
  return NextResponse.json({
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    apiKeyPreview: apiKey?.substring(0, 10) + "..."
  })
}