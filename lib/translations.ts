import { useLanguage } from './language-context'
import type { Lang } from './language-context'

const strings = {
  en: {
    // Common
    loading: 'Loading...',
    home: 'Home',
    clubBack: '← Club',
    backToHome: '← Back to Home',
    clubLogin: 'Club Login',
    loveForTheLoft: 'Love for the Loft',
    footer: '© 2026 High Fly Pigeons',
    footerFull: '© 2026 High Fly Pigeons. All rights reserved.',

    // Homepage
    pakistanPigeon: 'High Fly Pigeons',
    tabHome: 'Home',
    tabClubs: 'Clubs',
    tabGallery: 'Gallery',
    todaysStats: "Today's Stats",
    loadingLiveData: 'Loading live data...',
    tournamentsLive: 'Tournaments Live',
    loftsCompeting: 'Lofts Competing',
    pigeonsLandedToday: 'Pigeons Landed',
    todaysHighlights: "Today's Highlights",
    topScoreToday: 'Top score today',
    longestFlight: 'Longest single flight',
    lastPigeonLanded: 'Last pigeon landed',
    registeredClubs: '🏟️ Registered Clubs',
    noClubsYet: 'No clubs registered yet',
    noLiveTournaments: 'No live tournaments right now',
    checkBackSoon: 'Check back soon!',
    noGalleryPosts: 'No event posts yet',
    noGalleryDesc: 'Check back soon for event updates.',
    noResultsYet: 'No results submitted yet for today',
    fullResults: 'Full results',
    landed: 'landed',
    stillFlying: 'Still Flying',
    eventGallery: '📸 Event Gallery',
    searchClubs: 'Search clubs...',
    recentResults: '🏁 Recent Results',

    // Club public page
    clubNotFound: 'Club Not Found',
    tabTournaments: 'Tournaments',
    tabHistory: 'History',
    currentWeather: 'current weather',
    activeTournaments: '🟢 Active Tournaments',
    upcoming: 'Upcoming',
    soon: 'SOON',
    days: 'days',
    daysLeft: 'days left',
    pctComplete: '% complete',
    viewResults: 'View Results →',
    noActiveTournaments: 'No Active Tournaments',
    checkHistory: 'Check History for past results.',
    noCompletedYet: 'No Completed Tournaments Yet',
    completedTournaments: '🏁 Completed Tournaments',
    done: 'DONE',
    start: 'Start',

    // Tournament results page
    results: 'Results',
    tournamentNotFound: 'Tournament not found',
    totalDays: 'Total Days',
    participantsStat: 'Participants',
    landedStat: 'Landed',
    flyingStat: 'Flying',
    tournamentComplete: 'Tournament Complete',
    openDetailResults: 'Open Detail Results →',
    winnerPigeonToday: '🏆 Winner Pigeon Today',
    grandTotal: '🏆 Grand Total — All Days',
    loadingResults: 'Loading results...',
    loadingTotals: 'Loading totals...',
    total: 'Total',
    live: '● Live',
    flew: 'flew',
    daysShort: 'days',
    landedAt: 'landed',
  },
  ur: {
    // Common
    loading: 'لوڈ ہو رہا ہے...',
    home: 'ہوم',
    clubBack: 'کلب →',
    backToHome: 'ہوم پر واپس →',
    clubLogin: 'کلب لاگ ان',
    loveForTheLoft: 'لوفٹ سے محبت',
    footer: '© 2026 ہائی فلائی پیجنز',
    footerFull: '© 2026 ہائی فلائی پیجنز۔ تمام حقوق محفوظ ہیں۔',

    // Homepage
    pakistanPigeon: 'ہائی فلائی پیجنز',
    tabHome: 'ہوم',
    tabClubs: 'کلبز',
    tabGallery: 'گیلری',
    todaysStats: 'آج کے اعداد و شمار',
    loadingLiveData: 'لائیو ڈیٹا لوڈ ہو رہا ہے...',
    tournamentsLive: 'ٹورنامنٹس لائیو',
    loftsCompeting: 'لوفٹ مقابلے میں',
    pigeonsLandedToday: 'کبوتر آج اترے',
    todaysHighlights: 'آج کی جھلکیاں',
    topScoreToday: 'آج کا سرفہرست اسکور',
    longestFlight: 'سب سے طویل پرواز',
    lastPigeonLanded: 'آخری اترنے والا کبوتر',
    registeredClubs: '🏟️ رجسٹرڈ کلبز',
    noClubsYet: 'ابھی کوئی کلب رجسٹرڈ نہیں',
    noLiveTournaments: 'ابھی کوئی لائیو ٹورنامنٹ نہیں',
    checkBackSoon: 'جلد واپس آئیں!',
    noGalleryPosts: 'ابھی کوئی ایونٹ پوسٹ نہیں',
    noGalleryDesc: 'ایونٹ اپ ڈیٹس کے لیے جلد واپس آئیں۔',
    noResultsYet: 'آج کے لیے ابھی کوئی نتیجہ نہیں',
    fullResults: 'مکمل نتائج',
    landed: 'اترے',
    stillFlying: 'ابھی اڑ رہے ہیں',
    eventGallery: '📸 ایونٹ گیلری',
    searchClubs: 'کلبز تلاش کریں...',
    recentResults: '🏁 حالیہ نتائج',

    // Club public page
    clubNotFound: 'کلب نہیں ملا',
    tabTournaments: 'ٹورنامنٹس',
    tabHistory: 'تاریخ',
    currentWeather: 'موجودہ موسم',
    activeTournaments: '🟢 فعال ٹورنامنٹس',
    upcoming: 'آنے والے',
    soon: 'جلد',
    days: 'دن',
    daysLeft: 'دن باقی',
    pctComplete: '٪ مکمل',
    viewResults: 'نتائج دیکھیں →',
    noActiveTournaments: 'کوئی فعال ٹورنامنٹ نہیں',
    checkHistory: 'پچھلے نتائج کے لیے تاریخ دیکھیں۔',
    noCompletedYet: 'ابھی تک کوئی ٹورنامنٹ مکمل نہیں',
    completedTournaments: '🏁 مکمل ٹورنامنٹس',
    done: 'مکمل',
    start: 'شروع',

    // Tournament results page
    results: 'نتائج',
    tournamentNotFound: 'ٹورنامنٹ نہیں ملا',
    totalDays: 'کل دن',
    participantsStat: 'شرکاء',
    landedStat: 'اترے',
    flyingStat: 'اڑ رہے ہیں',
    tournamentComplete: 'ٹورنامنٹ مکمل',
    openDetailResults: 'تفصیلی نتائج دیکھیں →',
    winnerPigeonToday: '🏆 آج کا فاتح کبوتر',
    grandTotal: '🏆 مجموعی — تمام دن',
    loadingResults: 'نتائج لوڈ ہو رہے ہیں...',
    loadingTotals: 'مجموعی لوڈ ہو رہا ہے...',
    total: 'مجموعی',
    live: '● لائیو',
    flew: 'اڑے',
    daysShort: 'دن',
    landedAt: 'اترا',
  },
} as const

type Strings = typeof strings.en
export { strings }

export function useT() {
  const { lang } = useLanguage()
  const s = strings[lang]
  return (key: keyof Strings) => s[key]
}

// Format helpers for dynamic strings
export function fDayOf(lang: Lang, current: number, total: number) {
  return lang === 'ur' ? `${current} از ${total} دن` : `Day ${current} of ${total}`
}
export function fDayHeader(lang: Lang, n: number, date: string) {
  return lang === 'ur' ? `دن ${n} — ${date}` : `Day ${n} — ${date}`
}
export function fDaysShort(lang: Lang, n: number) {
  return lang === 'ur' ? `${n} دن` : `${n} days`
}
export function fDaysFlown(lang: Lang, n: number) {
  return lang === 'ur' ? `${n} دن اڑے` : `${n} days flown`
}
export function fPctComplete(lang: Lang, pct: number) {
  return lang === 'ur' ? `${pct}٪ مکمل` : `${pct}% complete`
}
export function fDaysLeft(lang: Lang, n: number) {
  return lang === 'ur' ? `${n} دن باقی` : `${n} days left`
}
export function fLanded(lang: Lang, n: number) {
  return lang === 'ur' ? `${n} اترے` : `${n} landed`
}
export function fStillFlying(lang: Lang, n: number) {
  return lang === 'ur' ? `${n} ابھی اڑ رہے ہیں` : `${n} still flying`
}
export function fParticipants(lang: Lang, n: number) {
  return lang === 'ur' ? `${n} شرکاء` : `${n} participants`
}
export function fFlewCount(lang: Lang, n: number) {
  return lang === 'ur' ? `${n} اڑے` : `${n} flew`
}
export function fLandedAt(lang: Lang, time: string, duration: string) {
  return lang === 'ur' ? `اترا ${time} · ${duration}` : `landed ${time} · ${duration}`
}
