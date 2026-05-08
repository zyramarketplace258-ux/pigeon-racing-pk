'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { db, auth } from '@/lib/firebase'
import { compareHours, formatTimeDisplay } from '@/lib/timeUtils'
import Link from 'next/link'
import { Playfair_Display } from 'next/font/google'
import { useLanguage } from '@/lib/language-context'
import { useT, fDayOf, fLanded, fStillFlying, strings } from '@/lib/translations'

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['700'], style: ['italic'] })

interface Club { id: string; name: string; slug: string; city: string; logoUrl?: string }
interface GalleryPost { id: string; imageUrl: string; title: string; description: string; postedBy: string; createdAt?: { seconds: number } }
interface RaceDay { dayNumber: number; date: string; isGap?: boolean }
interface PigeonChip { landingTime: string; hoursFlown: string }
interface TopEntry { name: string; area: string; pigeons: PigeonChip[]; totalHours: string }
interface HighlightStat {
  icon: string; label: string; value: string
  name: string; tournament: string; clubSlug: string; tournamentId: string
}
interface ActiveTournament {
  id: string; name: string; pigeonCount: number
  defaultStartTime: string; defaultEndTime: string
  clubId: string; clubName: string; clubSlug: string; clubCity: string
  raceDays: RaceDay[]; currentDay: number; totalRaceDays: number
  participantIds: string[] | null
  topEntries: TopEntry[]; totalLanded: number; totalPigeons: number
}

export default function HomePage() {
  const { lang, toggle } = useLanguage()
  const t = useT()
  const [clubs, setClubs] = useState<Club[]>([])
  const [activeTournaments, setActiveTournaments] = useState<ActiveTournament[]>([])
  const [highlights, setHighlights] = useState<HighlightStat[]>([])
  const [totalLandedToday, setTotalLandedToday] = useState(0)
  const [totalLotsCompeting, setTotalLotsCompeting] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'home' | 'clubs' | 'gallery'>('home')
  const [galleryPosts, setGalleryPosts] = useState<GalleryPost[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [loggedInClub, setLoggedInClub] = useState<Club | null>(null)

  useEffect(() => {
    let active = true
    const unsubscribers: (() => void)[] = []
    const toMins = (t: string) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m }

    const init = async () => {
      const today = new Date().toISOString().split('T')[0]

      const snap = await getDocs(collection(db, 'clubs'))
      if (!active) return
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Club[]
      setClubs(list)

      type TInfo = {
        base: Omit<ActiveTournament, 'topEntries' | 'totalLanded' | 'totalPigeons'>
        nameMap: Record<string, string>; areaMap: Record<string, string>
        enrolledCount: number; suffix: string
      }
      const infos: TInfo[] = []

      await Promise.all(list.map(async (club) => {
        const [tSnap, pSnap] = await Promise.all([
          getDocs(query(collection(db, 'clubs', club.id, 'tournaments'), where('status', '==', 'active'))),
          getDocs(collection(db, 'clubs', club.id, 'participants')),
        ])
        if (!active) return
        const nm: Record<string, string> = {}
        const am: Record<string, string> = {}
        pSnap.docs.forEach(d => { nm[d.id] = d.data().name; am[d.id] = d.data().area || '' })

        tSnap.docs.forEach(d => {
          const data = d.data()
          const raceDays: RaceDay[] = data.raceDays || []
          const nonGap = raceDays.filter(rd => !rd.isGap)
          const passed = nonGap.filter(rd => rd.date <= today).length
          const participantIds: string[] | null = data.participantIds ?? null
          const enrolledIds = participantIds != null ? participantIds : pSnap.docs.map(p => p.id)
          const filteredNm: Record<string, string> = {}
          const filteredAm: Record<string, string> = {}
          enrolledIds.forEach(id => { filteredNm[id] = nm[id] || ''; filteredAm[id] = am[id] || '' })
          const todayRD = nonGap.find(rd => rd.date === today)
          const currentDayNum = todayRD?.dayNumber ?? nonGap[nonGap.length - 1]?.dayNumber
          infos.push({
            base: {
              id: d.id, name: data.name,
              pigeonCount: data.pigeonCount || 5,
              defaultStartTime: data.defaultStartTime || '',
              defaultEndTime: data.defaultEndTime || '',
              clubId: club.id, clubName: club.name, clubSlug: club.slug, clubCity: club.city,
              raceDays, participantIds,
              currentDay: Math.min(passed, nonGap.length) || 1,
              totalRaceDays: nonGap.length,
            },
            nameMap: filteredNm, areaMap: filteredAm,
            enrolledCount: enrolledIds.length,
            suffix: currentDayNum ? `_day${currentDayNum}` : '',
          })
        })
      }))

      if (!active) return

      if (infos.length === 0) {
        setActiveTournaments([]); setLoading(false); return
      }

      const liveStore = new Map<string, Pick<ActiveTournament, 'topEntries' | 'totalLanded' | 'totalPigeons'>>()
      infos.forEach(info => {
        liveStore.set(info.base.id, { topEntries: [], totalLanded: 0, totalPigeons: info.enrolledCount * info.base.pigeonCount })
      })

      const initializedIds = new Set<string>()

      const rebuildAndPublish = () => {
        const enriched: ActiveTournament[] = infos.map(info => ({
          ...info.base,
          ...(liveStore.get(info.base.id) ?? { topEntries: [], totalLanded: 0, totalPigeons: info.enrolledCount * info.base.pigeonCount }),
        }))
        setActiveTournaments(enriched)

        let gLanded = 0, gLots = 0
        let topScoreRaw = '', longestFlightRaw = '', lastLandedTime = ''
        let topScore: HighlightStat | null = null, longestFlight: HighlightStat | null = null, lastLanded: HighlightStat | null = null

        enriched.forEach(tr => {
          gLanded += tr.totalLanded
          gLots += tr.totalPigeons / tr.pigeonCount
          if (tr.topEntries[0]?.totalHours && toMins(tr.topEntries[0].totalHours) > toMins(topScoreRaw)) {
            topScoreRaw = tr.topEntries[0].totalHours
            topScore = { icon: '🏆', label: strings[lang].topScoreToday, value: formatTimeDisplay(tr.topEntries[0].totalHours), name: tr.topEntries[0].name, tournament: tr.name, clubSlug: tr.clubSlug, tournamentId: tr.id }
          }
          tr.topEntries.forEach(entry => {
            entry.pigeons.forEach(pg => {
              if (pg.hoursFlown && pg.landingTime) {
                if (toMins(pg.hoursFlown) > toMins(longestFlightRaw)) {
                  longestFlightRaw = pg.hoursFlown
                  longestFlight = { icon: '⏱', label: strings[lang].longestFlight, value: formatTimeDisplay(pg.hoursFlown), name: entry.name, tournament: tr.name, clubSlug: tr.clubSlug, tournamentId: tr.id }
                }
                if (pg.landingTime > lastLandedTime) {
                  lastLandedTime = pg.landingTime
                  lastLanded = { icon: '🕐', label: strings[lang].lastPigeonLanded, value: pg.landingTime, name: entry.name, tournament: tr.name, clubSlug: tr.clubSlug, tournamentId: tr.id }
                }
              }
            })
          })
        })

        setTotalLandedToday(gLanded)
        setTotalLotsCompeting(gLots)
        setHighlights(([topScore, longestFlight, lastLanded] as (HighlightStat | null)[]).filter((h): h is HighlightStat => h !== null))
      }

      const markInit = (id: string) => {
        initializedIds.add(id)
        if (initializedIds.size === infos.length) { rebuildAndPublish(); setLoading(false) }
      }

      infos.forEach(info => {
        if (!info.suffix) { liveStore.set(info.base.id, { topEntries: [], totalLanded: 0, totalPigeons: info.enrolledCount * info.base.pigeonCount }); markInit(info.base.id); return }

        const unsub = onSnapshot(
          collection(db, 'clubs', info.base.clubId, 'tournaments', info.base.id, 'entries'),
          snapshot => {
            if (!active) return
            let totalLanded = 0
            const entries: TopEntry[] = snapshot.docs
              .filter(d => d.id.endsWith(info.suffix))
              .flatMap(d => {
                const pId = d.id.slice(0, -info.suffix.length)
                if (!(pId in info.nameMap)) return []
                const data = d.data()
                if (!data.totalHours) return []
                const pigeons: PigeonChip[] = (data.pigeons || []).map((pg: Record<string, string>) => ({
                  landingTime: pg.landingTime || '', hoursFlown: pg.hoursFlown || '',
                }))
                pigeons.forEach(pg => { if (pg.landingTime) totalLanded++ })
                return [{ name: info.nameMap[pId], area: info.areaMap[pId] || '', pigeons, totalHours: data.totalHours }]
              })
              .sort((a, b) => compareHours(a.totalHours, b.totalHours))

            liveStore.set(info.base.id, { topEntries: entries.slice(0, 3), totalLanded, totalPigeons: info.enrolledCount * info.base.pigeonCount })
            rebuildAndPublish()
            markInit(info.base.id)
          }
        )
        unsubscribers.push(unsub)
      })
    }

    init()
    return () => { active = false; unsubscribers.forEach(u => u()) }
  }, [lang])

  useEffect(() => {
    if (activeTab !== 'gallery') return
    setGalleryLoading(true)
    getDocs(query(collection(db, 'gallery'), orderBy('createdAt', 'desc')))
      .then(snap => {
        setGalleryPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as GalleryPost[])
        setGalleryLoading(false)
      })
      .catch(() => setGalleryLoading(false))
  }, [activeTab])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoggedInClub(null); return }
      const snap = await getDocs(query(collection(db, 'clubs'), where('loginEmail', '==', user.email)))
      if (!snap.empty) setLoggedInClub({ id: snap.docs[0].id, ...snap.docs[0].data() } as Club)
      else setLoggedInClub(null)
    })
    return () => unsub()
  }, [])

  const rankRingClass = (i: number) => {
    if (i === 0) return 'text-white shadow-md'
    if (i === 1) return 'text-white shadow'
    return 'bg-[#eee] text-[#6c757d]'
  }
  const rankRingStyle = (i: number): React.CSSProperties => {
    if (i === 0) return { background: 'linear-gradient(145deg,#ffe066,#c8900a)' }
    if (i === 1) return { background: 'linear-gradient(145deg,#e8e8e8,#8a8a8a)' }
    return {}
  }

  const isUrdu = lang === 'ur'

  return (
    <main className={`min-h-screen bg-[#e8f5e9] ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] px-4 py-3">
        <div className="max-w-5xl mx-auto relative flex items-center justify-between">
          <div>
            <h1 className={`${!isUrdu ? playfair.className : ''} text-white text-xl sm:text-2xl leading-tight`}>{t('pakistanPigeon')}</h1>
            <p className="text-green-300 text-xs tracking-widest uppercase">{t('loveForTheLoft')}</p>
          </div>
          <img src="/pigeon.png" alt="Pigeon" className="absolute left-1/2 -translate-x-1/2 w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-lg" />
          {loggedInClub ? (
            <div className="flex items-center gap-2">
              <Link href="/club/dashboard" className="flex items-center gap-1.5 text-xs text-green-200 border border-green-600 px-2.5 py-1.5 rounded hover:bg-green-800 transition font-medium">
                <img src={loggedInClub.logoUrl || '/pigeon.png'} alt="" className="w-5 h-5 rounded-full object-cover border border-green-500" />
                <span className="hidden sm:inline max-w-[80px] truncate">{loggedInClub.name}</span>
                <span className="sm:hidden">Dashboard</span>
              </Link>
              <button
                onClick={() => signOut(auth)}
                className="text-xs text-red-300 border border-red-700 px-2 py-1.5 rounded hover:bg-red-900 transition font-medium"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link href="/club/login" className="text-xs text-green-200 border border-green-600 px-2.5 py-1.5 rounded hover:bg-green-800 transition font-medium">
              {t('clubLogin')}
            </Link>
          )}
        </div>
      </div>
      <nav className="bg-[#292929] px-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4 h-9">
          <button onClick={() => setActiveTab('home')} className={`text-sm font-semibold pb-0.5 transition ${activeTab === 'home' ? 'text-white border-b-2 border-[#66bb6a]' : 'text-gray-400 hover:text-white'}`}>{t('tabHome')}</button>
          <button onClick={() => setActiveTab('clubs')} className={`text-sm font-semibold pb-0.5 transition ${activeTab === 'clubs' ? 'text-white border-b-2 border-[#66bb6a]' : 'text-gray-400 hover:text-white'}`}>{t('tabClubs')}</button>
          <button onClick={() => setActiveTab('gallery')} className={`text-sm font-semibold pb-0.5 transition ${activeTab === 'gallery' ? 'text-white border-b-2 border-[#66bb6a]' : 'text-gray-400 hover:text-white'}`}>{t('tabGallery')}</button>
          <button onClick={toggle} className="ms-auto text-xs text-green-300 border border-green-700 px-2.5 py-1 rounded hover:bg-green-800 transition font-medium">
            {isUrdu ? 'EN' : 'اردو'}
          </button>
        </div>
      </nav>

      {/* Stats Bar */}
      <div className="bg-[#2e7d32] text-center py-2 text-sm">
        {loading ? (
          <span className="text-green-400 text-xs">{t('loadingLiveData')}</span>
        ) : (
          <span className="text-green-100">
            <strong className="text-white">{activeTournaments.length}</strong>
            <span className="text-green-300"> {t('tournamentsLive')}</span>
            <span className="text-green-600 mx-2">·</span>
            <strong className="text-white">{totalLotsCompeting}</strong>
            <span className="text-green-300"> {t('loftsCompeting')}</span>
            <span className="text-green-600 mx-2">·</span>
            <strong className="text-white">{totalLandedToday}</strong>
            <span className="text-green-300"> {t('pigeonsLandedToday')}</span>
          </span>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4">

        {/* CLUBS TAB */}
        {activeTab === 'clubs' && (
          <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden mb-4">
            <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-2">
              <p className="text-green-200 text-xs font-bold uppercase tracking-widest">{t('registeredClubs')}</p>
            </div>
            {loading ? (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse flex items-center gap-3 p-3 border border-green-100 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-green-100 shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-green-100 rounded w-3/4"></div>
                      <div className="h-2 bg-green-100 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : clubs.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                <p className="text-4xl mb-3">🏟️</p>
                <p className="font-bold">{t('noClubsYet')}</p>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {clubs.map(club => (
                  <Link
                    key={club.id}
                    href={`/${club.slug}`}
                    className="flex items-center gap-3 p-3 border border-[#d4edda] rounded-lg hover:border-[#388e3c] hover:bg-[#f1faf2] transition group"
                  >
                    <div className="w-10 h-10 shrink-0 rounded-full bg-white border border-[#d4edda] overflow-hidden">
                      <img src={club.logoUrl || '/pigeon.png'} alt={club.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#1a1a1a] font-semibold text-sm truncate group-hover:text-[#1b5e20] transition">{club.name}</p>
                      <p className="text-[#777] text-xs">{club.city}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* GALLERY TAB */}
        {activeTab === 'gallery' && (
          galleryLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden animate-pulse">
                  <div className="h-48 bg-green-100" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-green-100 rounded w-2/3" />
                    <div className="h-2.5 bg-green-100 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : galleryPosts.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#d4edda] p-10 text-center shadow-sm">
              <p className="text-4xl mb-3">🖼️</p>
              <p className="text-gray-700 font-bold">{t('noGalleryPosts')}</p>
              <p className="text-gray-400 text-sm mt-1">{t('noGalleryDesc')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {galleryPosts.map(post => (
                <div key={post.id} className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
                  <div className="w-full bg-[#1a1a1a] flex items-center justify-center" style={{ height: 260 }}>
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="max-w-full max-h-full object-contain"
                      style={{ maxHeight: 260 }}
                      onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-[#1b5e20] font-bold text-base mb-1">{post.title}</p>
                    {post.description && <p className="text-[#444] text-sm leading-relaxed">{post.description}</p>}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f0f0f0]">
                      <p className="text-[#888] text-xs font-medium">{post.postedBy}</p>
                      {post.createdAt && (
                        <p className="text-[#aaa] text-xs" dir="ltr">
                          {new Date(post.createdAt.seconds * 1000).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* HOME TAB */}
        {activeTab === 'home' && <>

        {!loading && highlights.length > 0 && (
          <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden mb-4">
            <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-2">
              <p className="text-green-200 text-xs font-bold uppercase tracking-widest">{t('todaysHighlights')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#f0f0f0]">
              {highlights.map((h, i) => (
                <Link key={i} href={`/${h.clubSlug}/${h.tournamentId}`} className="flex items-start gap-3 p-4 hover:bg-[#f9fdf9] transition">
                  <span className="text-2xl mt-0.5">{h.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[#999] text-xs font-bold uppercase tracking-wide mb-0.5">{h.label}</p>
                    <p className="text-[#1b5e20] font-extrabold text-2xl leading-none">{h.value}</p>
                    <p className="text-[#222] text-sm font-medium mt-1 truncate">{h.name}</p>
                    <p className="text-[#999] text-xs truncate">{h.tournament}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden animate-pulse">
                <div className="h-20 bg-green-800 opacity-60"></div>
                <div className="p-4 space-y-3">
                  <div className="h-2.5 bg-green-100 rounded w-full"></div>
                  <div className="h-2.5 bg-green-100 rounded w-2/3"></div>
                  <div className="h-10 bg-green-50 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && activeTournaments.length > 0 && (
          <div className="space-y-4 mb-4">
            {activeTournaments.map(tr => (
              <div key={`${tr.clubId}-${tr.id}`} className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="bg-[#e65100] text-white text-xs px-1.5 py-0.5 rounded font-bold animate-pulse tracking-wider">LIVE</span>
                      <span className="text-green-300 text-xs">
                        {tr.defaultStartTime}{tr.defaultEndTime ? ` → ${tr.defaultEndTime}` : ''}
                      </span>
                    </div>
                    {tr.totalRaceDays > 0 && (
                      <span className="text-green-200 text-xs font-semibold bg-green-900 bg-opacity-40 px-2 py-0.5 rounded-full">
                        {fDayOf(lang, tr.currentDay, tr.totalRaceDays)}
                      </span>
                    )}
                  </div>
                  <p className="text-green-300 text-xs mb-0.5">{tr.clubName} · {tr.clubCity}</p>
                  <h3 className="text-white font-bold text-base leading-snug">{tr.name}</h3>
                </div>

                {tr.totalPigeons > 0 && (
                  <div className="px-4 py-2.5 bg-green-50 border-b border-[#d4edda]">
                    <div className="h-2 bg-[#e9ecef] rounded mb-1.5 overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${Math.round((tr.totalLanded / tr.totalPigeons) * 100)}%`,
                          background: 'linear-gradient(90deg,#388e3c,#66bb6a)',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{fLanded(lang, tr.totalLanded)}</span>
                      <span>{fStillFlying(lang, Math.max(0, tr.totalPigeons - tr.totalLanded))}</span>
                    </div>
                  </div>
                )}

                {tr.topEntries.length > 0 ? (
                  <div>
                    {tr.topEntries.map((entry, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2.5 border-b border-[#e9ecef] last:border-b-0"
                        style={{ background: i === 0 ? '#dff0d8' : i % 2 === 1 ? '#f6faf6' : '#fff' }}
                      >
                        <div
                          className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-bold ${rankRingClass(i)}`}
                          style={rankRingStyle(i)}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-[#1a1a1a] truncate">{entry.name}</p>
                          <p className="text-[#777] text-xs">{entry.area}</p>
                        </div>
                        <p className="font-bold text-xl text-[#1a1a1a] shrink-0">{formatTimeDisplay(entry.totalHours)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-gray-400 text-sm bg-[#f9fdf9]">
                    {t('noResultsYet')}
                  </div>
                )}

                <Link
                  href={`/${tr.clubSlug}/${tr.id}`}
                  className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-[#23592b] bg-[#f1faf2] border-t border-[#d4edda] hover:bg-[#e8f5e9] transition"
                >
                  {t('fullResults')} <span>→</span>
                </Link>
              </div>
            ))}
          </div>
        )}

        {!loading && activeTournaments.length === 0 && (
          <div className="bg-white rounded-xl border border-[#d4edda] p-10 text-center mb-4 shadow-sm">
            <p className="text-4xl mb-3">🐦</p>
            <p className="text-gray-700 font-bold">{t('noLiveTournaments')}</p>
            <p className="text-gray-400 text-sm mt-1">{t('checkBackSoon')}</p>
          </div>
        )}

        </>}

      </div>

      <footer className="text-center py-4 text-gray-400 text-xs border-t border-[#d4edda] bg-white">
        {t('footerFull')}
      </footer>

    </main>
  )
}
