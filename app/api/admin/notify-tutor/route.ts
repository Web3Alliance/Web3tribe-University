import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { tutorEmail, tutorName, courseTitle, action, reason } = await request.json()

    if (!tutorEmail || !courseTitle || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Email content
    const subject = action === 'approved' 
      ? `Course Approved: ${courseTitle}`
      : `Course Review Required: ${courseTitle}`

    const message = action === 'approved'
      ? `
        Hi ${tutorName},

        Great news! Your course "${courseTitle}" has been approved and is now live on Web3Tribe University.

        Students can now enroll and start learning. You'll earn rewards as students complete your modules.

        Keep up the great work!

        Best regards,
        Web3Tribe University Team
      `
      : `
        Hi ${tutorName},

        Thank you for submitting your course "${courseTitle}" to Web3Tribe University.

        After careful review, we need you to make some improvements before we can approve it.

        Reason for rejection:
        ${reason}

        Please update your course and resubmit it for review.

        If you have any questions, feel free to reach out to our support team.

        Best regards,
        Web3Tribe University Team
      `

    // In production, integrate with email service like SendGrid, Resend, or Nodemailer
    console.log('[v0] Email notification:', {
      to: tutorEmail,
      subject,
      message
    })

    // For now, we'll simulate sending the email
    // TODO: Integrate with actual email service provider
    
    return NextResponse.json({ 
      success: true,
      message: 'Notification sent successfully'
    })

  } catch (error: any) {
    console.error('[v0] Error sending notification:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    )
  }
}
