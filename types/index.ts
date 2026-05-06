export interface Admin {
  id: string
  email: string
  role: 'superadmin'
  createdAt: Date
}

export interface Club {
  id: string
  name: string
  slug: string
  logoUrl: string
  bannerImageUrl: string
  loginEmail: string
  createdAt: Date
  createdBy: string
}

export interface Tournament {
  id: string
  clubId: string
  name: string
  status: 'active' | 'inactive' | 'completed'
  totalDays: number
  raceDays: RaceDay[]
  defaultStartTime: string
  pigeonCount: number
  createdAt: Date
  createdBy: string
  completedAt?: Date
}

export interface RaceDay {
  dayNumber: number
  date: string
  isGap: boolean
}

export interface Participant {
  id: string
  clubId: string
  name: string
  area: string
  pigeonRingNumbers: string[]
  createdAt: Date
}

export interface Entry {
  id: string
  tournamentId: string
  participantId: string
  dayNumber: number
  startTime: string
  landingTime: string
  hoursFlown: string
  pigeonCount: number
  createdAt: Date
}

export interface DailyResult {
  participantId: string
  participantName: string
  area: string
  pigeonCount: number
  hoursFlown: string
  rank: number
}

export interface OverallResult {
  participantId: string
  participantName: string
  area: string
  dailyHours: { [dayNumber: number]: string }
  grandTotal: string
  rank: number
}