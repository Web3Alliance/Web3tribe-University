// =====================================================================================
// Core domain types — mirror the Supabase schema in supabase/migrations/0001_schema.sql
// =====================================================================================

export type UserRole =
  | "student"
  | "instructor"
  | "organization"
  | "moderator"
  | "admin"
  | "super_admin";

export type CourseStatus =
  | "draft"
  | "pending_review"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "published"
  | "archived";

export type CourseLevel = "beginner" | "intermediate" | "advanced" | "all_levels";

export type LessonContentType =
  | "video"
  | "pdf"
  | "text"
  | "image"
  | "audio"
  | "code"
  | "external_link"
  | "download"
  | "embed";

export type EnrollmentStatus = "active" | "completed" | "dropped" | "suspended";

export type QuizAttemptStatus = "in_progress" | "submitted" | "graded";

export type QuestionType = "single_choice" | "multiple_choice" | "true_false" | "short_answer";

export type W3trTransactionType =
  | "lesson_complete"
  | "quiz_pass"
  | "exam_pass"
  | "course_complete"
  | "daily_login"
  | "streak_bonus"
  | "referral_bonus"
  | "helping_learner"
  | "special_event"
  | "course_publish_bonus"
  | "high_rating_bonus"
  | "instructor_milestone"
  | "community_contribution"
  | "admin_grant"
  | "admin_deduction"
  | "spend"
  | "donation_conversion"
  | "token_purchase"
  | "instructor_earning"
  | "adjustment";

export type DonationStatus = "pending" | "confirmed" | "failed" | "refunded";
export type DonationMethod = "card" | "bank_transfer" | "paystack" | "flutterwave" | "manual";
export type ModerationAction = "submit" | "approve" | "reject" | "request_changes" | "unpublish" | "archive";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: UserRole;
  phone: string | null;
  phone_verified: boolean;
  country: string | null;
  state_region: string | null;
  timezone: string;
  is_instructor_verified: boolean;
  is_active: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  two_factor_enabled: boolean;
  onboarding_completed: boolean;
  theme_preference: "light" | "dark" | "system";
  /** Opt-in consent: only true if the student explicitly enabled it in Settings. Off by default. */
  visible_for_opportunities: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentProfile {
  profile_id: string;
  learning_goals: string | null;
  interests: string[];
  current_streak_days: number;
  longest_streak_days: number;
  last_activity_date: string | null;
  total_lessons_completed: number;
  total_courses_completed: number;
  referral_code: string | null;
  referred_by: string | null;
}

export interface StudentBiodata {
  profile_id: string;
  skipped: boolean;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | null;
  nationality: string | null;
  state_of_origin: string | null;
  lga: string | null;
  home_address: string | null;
  next_of_kin_name: string | null;
  next_of_kin_relationship: string | null;
  next_of_kin_phone: string | null;
  next_of_kin_address: string | null;
  highest_qualification: string | null;
  occupation_or_institution: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstructorProfile {
  profile_id: string;
  headline: string | null;
  expertise_tags: string[];
  years_experience: number | null;
  linkedin_url: string | null;
  website_url: string | null;
  verification_document_url: string | null;
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  verification_notes: string | null;
  total_students: number;
  average_rating: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  parent_id: string | null;
  display_order: number;
  is_active: boolean;
}

export interface Course {
  id: string;
  instructor_id: string;
  organization_id: string | null;
  category_id: string | null;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  thumbnail_url: string | null;
  promo_video_url: string | null;
  level: CourseLevel;
  language: string;
  tags: string[];
  status: CourseStatus;
  version: number;
  price_w3tr: number;
  /** Set once by the course's original author; cohorts inherit it and cannot override it. */
  delivery_mode: "online" | "hybrid" | "in_person";
  estimated_hours: number | null;
  requirements: string[];
  learning_outcomes: string[];
  target_audience: string[];
  average_rating: number;
  rating_count: number;
  enrollment_count: number;
  completion_count: number;
  published_at: string | null;
  submitted_for_review_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  // joined fields (populated by API layer, not raw table columns)
  instructor?: Pick<Profile, "id" | "full_name" | "avatar_url" | "username">;
  category?: Category;
}

export interface CourseSection {
  id: string;
  course_id: string;
  title: string;
  display_order: number;
}

export interface Lesson {
  id: string;
  section_id: string;
  course_id: string;
  title: string;
  content_type: LessonContentType;
  content_url: string | null;
  content_text: string | null;
  duration_seconds: number;
  display_order: number;
  is_preview: boolean;
  w3tr_reward: number;
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  status: EnrollmentStatus;
  progress_percent: number;
  enrolled_at: string;
  completed_at: string | null;
  last_accessed_at: string | null;
  course?: Course;
}

export interface LessonProgress {
  id: string;
  enrollment_id: string;
  student_id: string;
  lesson_id: string;
  course_id: string;
  is_completed: boolean;
  progress_seconds: number;
  completed_at: string | null;
  last_position_seconds: number;
}

export interface Quiz {
  id: string;
  course_id: string;
  section_id: string | null;
  lesson_id: string | null;
  is_final_exam: boolean;
  title: string;
  description: string | null;
  passing_score_percent: number;
  time_limit_minutes: number | null;
  max_attempts: number;
  w3tr_reward: number;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: QuestionType;
  options: { id: string; text: string }[] | null;
  correct_answer?: unknown; // never sent to student clients
  explanation: string | null;
  points: number;
  display_order: number;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  attempt_number: number;
  status: QuizAttemptStatus;
  answers: Record<string, unknown>;
  score_percent: number | null;
  passed: boolean | null;
  started_at: string;
  submitted_at: string | null;
}

export interface Assignment {
  id: string;
  course_id: string;
  section_id: string | null;
  title: string;
  instructions: string | null;
  max_score: number;
  w3tr_reward: number;
  due_offset_days: number | null;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  submission_text: string | null;
  file_url: string | null;
  score: number | null;
  feedback: string | null;
  status: "submitted" | "graded" | "returned";
  submitted_at: string;
}

export interface Certificate {
  id: string;
  certificate_code: string;
  student_id: string;
  course_id: string;
  enrollment_id: string;
  instructor_name_snapshot: string | null;
  course_title_snapshot: string | null;
  student_name_snapshot: string | null;
  final_score: number | null;
  pdf_url: string | null;
  qr_verification_url: string | null;
  issued_at: string;
  revoked: boolean;
}

export interface W3trWallet {
  profile_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  updated_at: string;
}

export interface W3trTransaction {
  id: string;
  profile_id: string;
  type: W3trTransactionType;
  amount: number;
  balance_after: number;
  reference_table: string | null;
  reference_id: string | null;
  description: string | null;
  awarded_by: string | null;
  created_at: string;
}

export interface W3trPurchase {
  id: string;
  profile_id: string;
  bundle_key: string;
  w3tr_amount: number;
  amount_naira: number;
  status: "pending" | "confirmed" | "failed";
  provider_reference: string | null;
  confirmed_at: string | null;
  created_at: string;
}

export interface Organization {
  id: string;
  owner_profile_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  industry: string | null;
  website_url: string | null;
  seats_purchased: number;
  is_verified: boolean;
}

export interface Opportunity {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  opportunity_type: "job" | "gig" | "apprenticeship" | "internship";
  /** Null means remote/anywhere. */
  location_state: string | null;
  required_course_ids: string[];
  application_method: string | null;
  status: "open" | "closed";
  created_at: string;
  expires_at: string | null;
  organization?: Pick<Organization, "name">;
}

export interface OpportunityApplication {
  id: string;
  opportunity_id: string;
  student_id: string;
  status: "interested" | "shortlisted" | "closed";
  created_at: string;
  profile?: Pick<Profile, "full_name" | "email" | "state_region">;
}

export interface DonationCampaign {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  goal_amount: number;
  raised_amount: number;
  currency: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export interface Donation {
  id: string;
  campaign_id: string | null;
  donor_id: string | null;
  donor_name: string | null;
  donor_email: string | null;
  is_anonymous: boolean;
  amount: number;
  currency: string;
  method: DonationMethod;
  status: DonationStatus;
  provider_reference: string | null;
  receipt_url: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  profile_id: string;
  title: string;
  body: string | null;
  channel: "in_app" | "email" | "push";
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: UserRole | null;
  is_banner: boolean;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
}

export interface CourseReview {
  id: string;
  course_id: string;
  student_id: string;
  rating: number;
  review_text: string | null;
  instructor_response: string | null;
  created_at: string;
  student?: Pick<Profile, "full_name" | "avatar_url">;
}

export type ReactionType = "like" | "dislike";

export interface DiscussionThread {
  id: string;
  course_id: string;
  lesson_id: string | null;
  author_id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  is_locked: boolean;
  like_count: number;
  dislike_count: number;
  created_at: string;
  updated_at: string;
  author?: Pick<Profile, "full_name" | "avatar_url" | "role">;
  reply_count?: number;
  my_reaction?: ReactionType | null;
}

export interface DiscussionReply {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  is_instructor_reply: boolean;
  like_count: number;
  dislike_count: number;
  created_at: string;
  author?: Pick<Profile, "full_name" | "avatar_url" | "role">;
  my_reaction?: ReactionType | null;
}

export interface LeaderboardEntry {
  profile_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  w3tr_balance: number;
  current_streak_days: number;
  total_courses_completed: number;
  total_lessons_completed: number;
  rank: number;
}

export interface AuditLog {
  id: string;
  actor_profile_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FeatureFlag {
  id: string;
  flag_key: string;
  label: string;
  description: string | null;
  is_enabled: boolean;
  rollout_percent: number;
}

// A generic API envelope used by every Next.js API route in this project
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}