import { NextResponse } from "next/server"
import { APP_METADATA } from "@/lib/app-metadata"

/**
 * Public API endpoint for app metadata
 * This allows ecosystem platforms to fetch app information
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: APP_METADATA,
  })
}
