// Convert "HH:mm" to total minutes
function toMinutes(time: string): number {
  const parts = time.split(':')
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  return hours * 60 + minutes
}

// Convert total minutes to "HHH:mm" string
function fromMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}:${minutes.toString().padStart(2, '0')}`
}

// Calculate hours flown between start and landing
export function calculateHoursFlown(
  startTime: string,
  landingTime: string
): string {
  let startMinutes = toMinutes(startTime)
  let landingMinutes = toMinutes(landingTime)

  // Handle next-day landing
  if (landingMinutes < startMinutes) {
    landingMinutes += 24 * 60
  }

  const diff = landingMinutes - startMinutes
  return fromMinutes(diff)
}

// Sum all hoursFlown for one day
export function calculateDailyTotal(
  entries: { hoursFlown: string }[]
): string {
  const total = entries.reduce((sum, entry) => {
    return sum + toMinutes(entry.hoursFlown)
  }, 0)
  return fromMinutes(total)
}

// Sum all daily totals for final leaderboard
export function calculateGrandTotal(dailyTotals: string[]): string {
  const total = dailyTotals.reduce((sum, t) => {
    return sum + toMinutes(t)
  }, 0)
  return fromMinutes(total)
}

// Compare two time strings for sorting (highest first)
export function compareHours(a: string, b: string): number {
  return toMinutes(b) - toMinutes(a)
}

// Format time for display
export function formatTimeDisplay(time: string): string {
  if (!time) return '0:00'
  const parts = time.split(':')
  const hours = parts[0]
  const minutes = parts[1]?.padStart(2, '0') || '00'
  return `${hours}:${minutes}`
}