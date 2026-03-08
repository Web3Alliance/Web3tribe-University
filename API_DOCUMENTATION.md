# Web3Tribe University - Backend API Documentation

## Overview
This document provides comprehensive documentation for all backend API endpoints in the Web3Tribe University learning management system.

## Authentication
All API endpoints require authentication via Supabase Auth. The user session is automatically managed through HTTP-only cookies.

---

## API Endpoints

### 1. Courses API

#### GET `/api/courses`
Retrieves all published courses from the database.

**Response:**
\`\`\`json
{
  "courses": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "category": "string",
      "level": "Beginner | Intermediate | Advanced",
      "price": "number",
      "instructor_name": "string",
      "instructor_id": "string",
      "thumbnail_url": "string",
      "status": "draft | pending | published | rejected",
      "created_at": "timestamp"
    }
  ]
}
\`\`\`

---

### 2. Enrollments API

#### GET `/api/enrollments`
Get all enrollments for the authenticated user.

**Response:**
\`\`\`json
{
  "enrollments": [
    {
      "id": "string",
      "user_id": "string",
      "course_id": "string",
      "enrolled_at": "timestamp",
      "progress": "number",
      "completed": "boolean"
    }
  ]
}
\`\`\`

#### POST `/api/enrollments`
Enroll the authenticated user in a course.

**Request Body:**
\`\`\`json
{
  "courseId": "string"
}
\`\`\`

**Response:**
\`\`\`json
{
  "enrollment": {
    "id": "string",
    "user_id": "string",
    "course_id": "string",
    "enrolled_at": "timestamp"
  }
}
\`\`\`

---

### 3. Progress API

#### POST `/api/progress`
Update user's progress when completing a module.

**Request Body:**
\`\`\`json
{
  "courseId": "string",
  "moduleId": "string"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "tokensEarned": 1,
  "newBalance": "number",
  "progress": {
    "id": "string",
    "completed_modules": "number",
    "total_modules": "number"
  }
}
\`\`\`

**Features:**
- Awards 1 W3TR token per module completed
- Creates transaction record
- Creates notification for user
- Checks if course is completed for certificate eligibility

---

### 4. Notifications API

#### GET `/api/notifications`
Get all notifications for the authenticated user (last 50).

**Response:**
\`\`\`json
{
  "notifications": [
    {
      "id": "string",
      "user_id": "string",
      "title": "string",
      "message": "string",
      "type": "token_earned | course_completed | achievement | system",
      "read": "boolean",
      "created_at": "timestamp"
    }
  ]
}
\`\`\`

#### PATCH `/api/notifications`
Mark a specific notification as read.

**Request Body:**
\`\`\`json
{
  "notificationId": "string"
}
\`\`\`

#### DELETE `/api/notifications`
Mark all notifications as read for the authenticated user.

---

### 5. Forum API

#### GET `/api/forum?courseId={courseId}`
Get all messages for a specific course forum.

**Query Parameters:**
- `courseId` (required): The course ID

**Response:**
\`\`\`json
{
  "messages": [
    {
      "id": "string",
      "course_id": "string",
      "user_id": "string",
      "message": "string",
      "created_at": "timestamp",
      "users": {
        "id": "string",
        "full_name": "string",
        "avatar_url": "string"
      }
    }
  ]
}
\`\`\`

#### POST `/api/forum`
Post a new message to a course forum.

**Request Body:**
\`\`\`json
{
  "courseId": "string",
  "message": "string"
}
\`\`\`

**Requirements:**
- User must be enrolled in the course

**Response:**
\`\`\`json
{
  "message": {
    "id": "string",
    "course_id": "string",
    "user_id": "string",
    "message": "string",
    "created_at": "timestamp"
  }
}
\`\`\`

---

### 6. Certificates API

#### POST `/api/certificates/mint`
Mint an NFT certificate on Pi Blockchain for a completed course.

**Request Body:**
\`\`\`json
{
  "courseId": "string",
  "courseName": "string"
}
\`\`\`

**Requirements:**
- User must have completed 100% of the course
- Certificate not already minted for this course

**Response:**
\`\`\`json
{
  "certificate": {
    "id": "string",
    "user_id": "string",
    "course_id": "string",
    "certificate_url": "string",
    "nft_tx_hash": "string (Pi blockchain transaction)",
    "issued_at": "timestamp"
  }
}
\`\`\`

**Features:**
- Generates certificate with user's full name
- Deploys as NFT on Pi blockchain
- Creates permanent record in database
- Certificate includes completion date and course details

---

## Database Schema

### Users Table
\`\`\`sql
- id: uuid (primary key)
- email: text (unique)
- full_name: text
- country: text
- avatar_url: text
- w3tr_balance: decimal (default: 0)
- email_verified: boolean
- created_at: timestamp
\`\`\`

### Courses Table
\`\`\`sql
- id: uuid (primary key)
- title: text
- description: text
- category: text
- level: text
- price: decimal
- instructor_id: uuid (foreign key)
- instructor_name: text
- thumbnail_url: text
- status: text (draft|pending|published|rejected)
- created_at: timestamp
\`\`\`

### Modules Table
\`\`\`sql
- id: uuid (primary key)
- course_id: uuid (foreign key)
- title: text
- content: text
- video_url: text
- duration: text
- order_index: integer
- created_at: timestamp
\`\`\`

### Enrollments Table
\`\`\`sql
- id: uuid (primary key)
- user_id: uuid (foreign key)
- course_id: uuid (foreign key)
- enrolled_at: timestamp
- progress: decimal (0-100)
- completed: boolean
\`\`\`

### Module Progress Table
\`\`\`sql
- id: uuid (primary key)
- user_id: uuid (foreign key)
- enrollment_id: uuid (foreign key)
- module_id: uuid (foreign key)
- completed: boolean
- completed_at: timestamp
\`\`\`

### Transactions Table
\`\`\`sql
- id: uuid (primary key)
- user_id: uuid (foreign key)
- type: text (earned|spent|purchased|transferred)
- amount: decimal
- description: text
- created_at: timestamp
\`\`\`

### Notifications Table
\`\`\`sql
- id: uuid (primary key)
- user_id: uuid (foreign key)
- title: text
- message: text
- type: text
- read: boolean
- created_at: timestamp
\`\`\`

### Forum Messages Table
\`\`\`sql
- id: uuid (primary key)
- course_id: uuid (foreign key)
- user_id: uuid (foreign key)
- message: text
- created_at: timestamp
\`\`\`

### NFT Certificates Table
\`\`\`sql
- id: uuid (primary key)
- user_id: uuid (foreign key)
- course_id: uuid (foreign key)
- certificate_url: text
- nft_tx_hash: text (Pi blockchain transaction)
- issued_at: timestamp
\`\`\`

---

## Row Level Security (RLS) Policies

All tables have RLS enabled with policies that ensure:

1. **Users can only read/update their own data**
2. **Courses are publicly readable but only instructors can modify their own courses**
3. **Enrollments are private to the user**
4. **Notifications are private to the user**
5. **Forum messages are visible to enrolled students**
6. **Transactions are private to the user**
7. **Certificates are publicly readable but only created by the system**

---

## Token Economics

### W3TR Token Distribution (1 Billion Total Supply)

- **60% (600M)** - Learning Rewards
  - Learners earn 1 W3TR per module completed
  - Tutors earn tokens based on course completions
  
- **20% (200M)** - Team Allocation
- **10% (100M)** - Investors
- **5% (50M)** - Charity
- **5% (50M)** - Research & Development

### Token Use Cases

1. **Earn**: Complete modules to earn W3TR
2. **Spend**: Purchase paid courses with W3TR
3. **Trade**: Swap W3TR for Pi tokens in-app
4. **Hold**: Store tokens in the in-app wallet

---

## Privacy & Data Handling

The application follows ethical data handling practices:

1. **GDPR Compliance**: User data is collected with consent
2. **Data Minimization**: Only necessary data is collected
3. **Right to Access**: Users can view their profile data
4. **Right to Modify**: Users can update their information
5. **Secure Storage**: All sensitive data is encrypted
6. **Row Level Security**: Database-level access controls
7. **Email Verification**: Required before account activation

---

## Getting Started

### Setup Instructions

1. **Execute Database Schema**
\`\`\`bash
# Run the SQL scripts in order
scripts/001-create-schema.sql
scripts/002-create-storage.sql
\`\`\`

2. **Set Environment Variables**
\`\`\`bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
\`\`\`

3. **Configure Email Provider**
Set up email templates in Supabase for:
- Email verification
- Password reset
- Course completion notifications

4. **Pi Network Integration**
Configure Pi SDK credentials for:
- NFT minting on Pi Blockchain
- Pi token swapping

---

## Support

For technical support or API questions:
- Check the codebase documentation
- Review the database schema
- Test endpoints using the provided examples
- Monitor server logs for debugging

---

**Last Updated**: January 2026
**Version**: 1.0.0
