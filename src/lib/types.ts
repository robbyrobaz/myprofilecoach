// Core domain types

export interface ParsedRole {
  company: string
  title: string
  startDate: string
  endDate: string
  bullets: string[]
  rawText: string
}

export interface ParsedProfile {
  headline: string
  about: string
  roles: ParsedRole[]
  skills: string[]
  rawText: string
}

export interface ProfileScore {
  overall: number // 0-100
  breakdown: {
    headline: number
    about: number
    experience: number
    keywords: number
    aiSignals: number
  }
  topProblems: string[] // first 3 shown free, rest locked
  targetRole: string
}

export interface InterviewQuestion {
  roleIndex: number // which role this question is about
  company: string
  question: string
  hint: string // short hint to guide user answer
}

export interface SuggestionCard {
  section: 'headline' | 'about' | `role_${number}`
  label: string // e.g. "Senior Accountant at Deloitte — Role Bullets"
  current: string
  suggested: string
  reason: string // why this change matters
  status: 'pending' | 'approved' | 'edited' | 'skipped'
  editedText?: string
}

export interface SessionState {
  id: string
  userId?: string // set after Stripe checkout
  createdAt: number
  expiresAt: number

  // input
  rawProfile: string
  targetRoles: string[]

  // pipeline progress
  stage: SessionStage
  parsedProfile?: ParsedProfile
  jobResearch?: string
  keywords?: string[]
  score?: ProfileScore

  // interview
  interviewQuestions?: InterviewQuestion[]
  userAnswers?: Record<number, string> // questionIndex → answer
  extractedAchievements?: string

  // suggestions
  suggestionCards?: SuggestionCard[]

  // output
  finalizedLinkedIn?: FinalizedOutput
  pdfGenerated?: boolean

  // limits tracking (stored in user record, not session)
  usagePeriod?: string // YYYY-MM billing period
}

export type SessionStage =
  | 'input'           // awaiting profile paste
  | 'scoring'         // running calls 1-4
  | 'scored'          // free tier wall — show score + lock
  | 'interviewing'    // calls 5-7: questions generated
  | 'answering'       // user answering questions
  | 'processing'      // call 8: processing answers
  | 'suggestions'     // calls 9-12: suggestion cards ready
  | 'reviewing'       // user approving/editing cards
  | 'finalizing'      // call 13: compiling output
  | 'complete'        // output ready
  | 'pdf_ready'       // call 14 done

export interface FinalizedOutput {
  headline: string
  about: string
  roles: Array<{
    company: string
    title: string
    bullets: string[]
  }>
  beforeScore: number
  afterScore: number
}

export interface UserRecord {
  id: string // email
  stripeCustomerId?: string
  subscriptionId?: string
  subscriptionStatus: 'active' | 'canceled' | 'paused' | 'trialing' | 'none'
  currentPeriodEnd?: number
  usage: {
    period: string // YYYY-MM
    sessions: number     // max 3
    pdfs: number         // max 5
    refreshes: number    // max 2 manual
  }
}
