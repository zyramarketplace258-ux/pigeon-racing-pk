'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '@/lib/firebase'
import { compareHours, formatTimeDisplay } from '@/lib/timeUtils'

function getCountdown(endTime: string): string | null {
  if (!endTime) return null
  const now = new Date()
  const pktMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + 300) % 1440
  const [endH, endM] = endTime.split(':').map(Number)
  const diff = (endH * 60 + endM) - pktMinutes
  if (diff <= 0) return null
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`
}
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'
import { useT, fDayOf, fLanded, fStillFlying } from '@/lib/translations'
import SiteHeader from './SiteHeader'

export interface Club { id: string; name: string; nameUrdu?: string; slug: string; city: string; cityUrdu?: string; logoUrl?: string }
interface GalleryPost { id: string; imageUrl: string; title: string; description: string; postedBy: string; createdAt?: { seconds: number } }
export interface RaceDay { dayNumber: number; date: string; isGap?: boolean }
interface PigeonChip { landingTime: string; hoursFlown: string }
interface TopEntry { name: string; nameUrdu: string; area: string; areaUrdu: string; photoUrl?: string; pigeons: PigeonChip[]; totalHours: string }
interface TopScorer { rank: number; name: string; nameUrdu?: string; area: string; areaUrdu?: string; photoUrl?: string; totalHours: string; tournament: string; clubSlug: string; tournamentId: string }
interface WinnerEntry { rank: number; name: string; nameUrdu?: string; area: string; areaUrdu?: string; photoUrl?: string; landingTime: string; hoursFlown: string; tournament: string; clubSlug: string; tournamentId: string }
export interface ActiveTournament {
  id: string; name: string; nameUrdu?: string; pigeonCount: number
  defaultStartTime: string; defaultEndTime: string
  clubId: string; clubName: string; clubNameUrdu?: string; clubSlug: string; clubCity: string; clubCityUrdu?: string
  raceDays: RaceDay[]; currentDay: number; totalRaceDays: number
  participantIds: string[] | null
  topEntries: TopEntry[]; totalLanded: number; totalPigeons: number
}

export interface TInfoClient {
  base: Omit<ActiveTournament, 'topEntries' | 'totalLanded' | 'totalPigeons'>
  nameMap: Record<string, string>
  areaMap: Record<string, string>
  photoMap: Record<string, string>
  nameUrduMap: Record<string, string>
  areaUrduMap: Record<string, string>
  enrolledCount: number
  suffix: string
}

export interface InitialHomeData {
  clubs: Club[]
  activeTournaments: ActiveTournament[]
  topScorers: TopScorer[]
  winnerPigeons: WinnerEntry[]
  totalLandedToday: number
  totalStillFlying: number
  totalLotsCompeting: number
}

interface Props {
  initialData: InitialHomeData
  tInfos: TInfoClient[]
}

export default function HomeClient({ initialData, tInfos }: Props) {
  const router = useRouter()
  const { lang, toggle } = useLanguage()
  const t = useT()

  const [clubs] = useState<Club[]>(initialData.clubs)
  const [activeTournaments, setActiveTournaments] = useState<ActiveTournament[]>(initialData.activeTournaments)
  const [topScorers, setTopScorers] = useState<TopScorer[]>(initialData.topScorers)
  const [totalLandedToday, setTotalLandedToday] = useState(initialData.totalLandedToday)
  const [totalStillFlying, setTotalStillFlying] = useState(initialData.totalStillFlying)
  const [winnerPigeons, setWinnerPigeons] = useState<WinnerEntry[]>(initialData.winnerPigeons)
  const [totalLotsCompeting, setTotalLotsCompeting] = useState(initialData.totalLotsCompeting)
  const [activeTab, setActiveTab] = useState<'home' | 'clubs' | 'gallery'>(() => {
    if (typeof window !== 'undefined') {
      const s = sessionStorage.getItem('home-tab') as string
      if (s === 'home' || s === 'clubs' || s === 'gallery') return s
    }
    return 'home'
  })
  const setTab = (tab: typeof activeTab) => { setActiveTab(tab); sessionStorage.setItem('home-tab', tab) }
  const [navLoading, setNavLoading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [galleryPosts, setGalleryPosts] = useState<GalleryPost[]>([])
  const [galleryLoading, setGalleryLoading] = useState(true)
  const [loggedInClub, setLoggedInClub] = useState<Club | null>(null)
  // Set up real-time listeners — structural data already provided by SSR
  useEffect(() => {
    if (tInfos.length === 0) return
    let active = true
    const unsubscribers: (() => void)[] = []

    // Pre-populate liveStore from SSR data
    const liveStore = new Map<string, Pick<ActiveTournament, 'topEntries' | 'totalLanded' | 'totalPigeons'>>()
    initialData.activeTournaments.forEach(tr => {
      liveStore.set(tr.id, { topEntries: tr.topEntries, totalLanded: tr.totalLanded, totalPigeons: tr.totalPigeons })
    })
    tInfos.forEach(info => {
      if (!liveStore.has(info.base.id)) {
        liveStore.set(info.base.id, { topEntries: [], totalLanded: 0, totalPigeons: info.enrolledCount * info.base.pigeonCount })
      }
    })

    type PigeonRec = { participantKey: string; name: string; nameUrdu: string; area: string; areaUrdu: string; photoUrl: string; hoursFlown: string; landingTime: string }
    type ScoreRec = { participantKey: string; name: string; nameUrdu: string; area: string; areaUrdu: string; photoUrl: string; totalHours: string }
    const pigeonStore = new Map<string, PigeonRec[]>()
    const scoreStore = new Map<string, ScoreRec[]>()

    const rebuildAndPublish = () => {
      const enriched: ActiveTournament[] = tInfos.map(info => ({
        ...info.base,
        ...(liveStore.get(info.base.id) ?? { topEntries: [], totalLanded: 0, totalPigeons: info.enrolledCount * info.base.pigeonCount }),
      }))
      setActiveTournaments(enriched)

      let gLanded = 0, gLots = 0, gStillFlying = 0
      enriched.forEach(tr => {
        gLanded += tr.totalLanded
        gLots += tr.totalPigeons / tr.pigeonCount
        gStillFlying += Math.max(0, tr.totalPigeons - tr.totalLanded)
      })
      setTotalLandedToday(gLanded)
      setTotalStillFlying(gStillFlying)
      setTotalLotsCompeting(gLots)

      const allScorers: (ScoreRec & { tournament: string; clubSlug: string; tournamentId: string })[] = []
      tInfos.forEach(info => {
        ;(scoreStore.get(info.base.id) || []).forEach(s => {
          allScorers.push({ ...s, tournament: info.base.name, clubSlug: info.base.clubSlug, tournamentId: info.base.id })
        })
      })
      allScorers.sort((a, b) => compareHours(a.totalHours, b.totalHours))
      const bestScoreMap = new Map<string, typeof allScorers[0]>()
      allScorers.forEach(s => {
        const ex = bestScoreMap.get(s.participantKey)
        if (!ex || compareHours(s.totalHours, ex.totalHours) < 0) bestScoreMap.set(s.participantKey, s)
      })
      const dedupedScorers = Array.from(bestScoreMap.values()).sort((a, b) => compareHours(a.totalHours, b.totalHours))
      const ts: TopScorer[] = []
      let prevHTS = '', rankTS = 0
      for (const s of dedupedScorers) {
        if (s.totalHours !== prevHTS) { rankTS++; if (rankTS > 3) break; prevHTS = s.totalHours }
        ts.push({ ...s, rank: rankTS })
      }
      setTopScorers(ts)

      const allPR: (PigeonRec & { tournament: string; clubSlug: string; tournamentId: string })[] = []
      tInfos.forEach(info => {
        ;(pigeonStore.get(info.base.id) || []).forEach(p => {
          allPR.push({ ...p, tournament: info.base.name, clubSlug: info.base.clubSlug, tournamentId: info.base.id })
        })
      })
      const bestMap = new Map<string, typeof allPR[0]>()
      allPR.forEach(p => {
        const ex = bestMap.get(p.participantKey)
        if (!ex || compareHours(p.hoursFlown, ex.hoursFlown) < 0) bestMap.set(p.participantKey, p)
      })
      const sorted = Array.from(bestMap.values()).sort((a, b) => compareHours(a.hoursFlown, b.hoursFlown))
      const wp: WinnerEntry[] = []
      let prevHW = '', rankW = 0
      for (const p of sorted) {
        if (p.hoursFlown !== prevHW) { rankW++; if (rankW > 1) break; prevHW = p.hoursFlown }
        wp.push({ name: p.name, nameUrdu: p.nameUrdu, area: p.area, areaUrdu: p.areaUrdu, photoUrl: p.photoUrl, landingTime: p.landingTime, hoursFlown: p.hoursFlown, tournament: p.tournament, clubSlug: p.clubSlug, tournamentId: p.tournamentId, rank: rankW })
      }
      setWinnerPigeons(wp)
    }

    tInfos.forEach(info => {
      if (!info.suffix) {
        pigeonStore.set(info.base.id, [])
        scoreStore.set(info.base.id, [])
        return
      }

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
              return [{ name: info.nameMap[pId], nameUrdu: info.nameUrduMap[pId] || '', area: info.areaMap[pId] || '', areaUrdu: info.areaUrduMap[pId] || '', photoUrl: info.photoMap[pId] || '', pigeons, totalHours: data.totalHours }]
            })
            .sort((a, b) => compareHours(a.totalHours, b.totalHours))

          const top = entries.slice(0, 3)

          const precs: PigeonRec[] = []
          const srecs: ScoreRec[] = []
          snapshot.docs
            .filter(d => d.id.endsWith(info.suffix))
            .forEach(d => {
              const pId = d.id.slice(0, -info.suffix.length)
              if (!(pId in info.nameMap)) return
              const ddata = d.data()
              if (ddata.totalHours) {
                srecs.push({ participantKey: `${info.base.clubId}::${pId}`, name: info.nameMap[pId], nameUrdu: info.nameUrduMap[pId] || '', area: info.areaMap[pId] || '', areaUrdu: info.areaUrduMap[pId] || '', photoUrl: info.photoMap[pId] || '', totalHours: ddata.totalHours })
              }
              ;(ddata.pigeons || []).forEach((pg: Record<string, string>) => {
                if (pg.hoursFlown && pg.landingTime) {
                  precs.push({ participantKey: `${info.base.clubId}::${pId}`, name: info.nameMap[pId], nameUrdu: info.nameUrduMap[pId] || '', area: info.areaMap[pId] || '', areaUrdu: info.areaUrduMap[pId] || '', photoUrl: info.photoMap[pId] || '', hoursFlown: pg.hoursFlown, landingTime: pg.landingTime })
                }
              })
            })
          pigeonStore.set(info.base.id, precs)
          scoreStore.set(info.base.id, srecs)

          liveStore.set(info.base.id, { topEntries: top, totalLanded, totalPigeons: info.enrolledCount * info.base.pigeonCount })
          rebuildAndPublish()
        }
      )
      unsubscribers.push(unsub)
    })

    return () => { active = false; unsubscribers.forEach(u => u()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'gallery'), orderBy('createdAt', 'desc')),
      snap => { setGalleryPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as GalleryPost[]); setGalleryLoading(false) },
      () => setGalleryLoading(false)
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoggedInClub(null); return }
      const snap = await getDocs(query(collection(db, 'clubs'), where('loginEmail', '==', user.email)))
      if (!snap.empty) setLoggedInClub({ id: snap.docs[0].id, ...snap.docs[0].data() } as Club)
      else setLoggedInClub(null)
    })
    return () => unsub()
  }, [])

  const getRank = (entry: TopEntry, entries: TopEntry[]) => {
    const seen: string[] = []
    entries.forEach(e => { if (!seen.includes(e.totalHours)) seen.push(e.totalHours) })
    return seen.indexOf(entry.totalHours)
  }
  const rankRingClass = (rank: number) => {
    if (rank === 0) return 'text-white shadow-md'
    if (rank === 1) return 'text-white shadow'
    return 'bg-[#eee] text-[#6c757d]'
  }
  const rankRingStyle = (rank: number): React.CSSProperties => {
    if (rank === 0) return { background: 'linear-gradient(145deg,#ffe066,#c8900a)' }
    if (rank === 1) return { background: 'linear-gradient(145deg,#e8e8e8,#8a8a8a)' }
    return {}
  }

  const isUrdu = lang === 'ur'


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxSrc(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])


  return (
    <main className={`min-h-screen bg-[#e8f5e9] ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>

      <SiteHeader />
      <nav className="bg-[#292929] px-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4 h-9">
          <button onClick={() => setTab('home')} className={`text-sm font-semibold pb-0.5 transition ${activeTab === 'home' ? 'text-white border-b-2 border-[#66bb6a]' : 'text-gray-400 hover:text-white'}`}>{t('tabHome')}</button>
          <button onClick={() => setTab('clubs')} className={`text-sm font-semibold pb-0.5 transition ${activeTab === 'clubs' ? 'text-white border-b-2 border-[#66bb6a]' : 'text-gray-400 hover:text-white'}`}>{t('tabClubs')}</button>
          <button onClick={() => setTab('gallery')} className={`text-sm font-semibold pb-0.5 transition ${activeTab === 'gallery' ? 'text-white border-b-2 border-[#66bb6a]' : 'text-gray-400 hover:text-white'}`}>{t('tabGallery')}</button>
          <div className="ms-auto flex items-center gap-2">
            {loggedInClub && (
              <Link href="/club/dashboard" className="flex items-center gap-1.5 text-xs text-green-300 border border-green-700 px-2.5 py-1 rounded hover:bg-green-800 transition font-medium">
                <img src={loggedInClub.logoUrl || '/pigeon.png'} alt="" className="w-4 h-4 rounded-full object-cover" />
                <span>Dashboard</span>
              </Link>
            )}
            <button onClick={toggle} className="text-xs text-green-300 border border-green-700 px-2.5 py-1 rounded hover:bg-green-800 transition font-medium">
              {isUrdu ? 'EN' : 'اردو'}
            </button>
          </div>
        </div>
      </nav>

      {/* Stats Bar */}
      <div className="bg-[#2e7d32] px-4 py-3">
        <div className="flex flex-col gap-2 max-w-lg mx-auto">
          {/* Row 1 — 2 stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#1b5e20] bg-opacity-60 rounded-lg py-2 px-3 text-center">
              <p className="text-white font-bold text-xl leading-none">{activeTournaments.length}</p>
              <p className="text-green-300 text-xs mt-0.5">{t('tournamentsLive')}</p>
            </div>
            <div className="bg-[#1b5e20] bg-opacity-60 rounded-lg py-2 px-3 text-center">
              <p className="text-white font-bold text-xl leading-none">{totalLotsCompeting}</p>
              <p className="text-green-300 text-xs mt-0.5">{t('loftsCompeting')}</p>
            </div>
          </div>
          {/* Row 2 — 3 stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#1b5e20] bg-opacity-60 rounded-lg py-2 px-3 text-center">
              <p className="text-white font-bold text-xl leading-none">{totalLandedToday}</p>
              <p className="text-green-300 text-xs mt-0.5">{t('pigeonsLandedToday')}</p>
            </div>
            <div className="bg-[#1b5e20] bg-opacity-60 rounded-lg py-2 px-3 text-center">
              <p className="text-white font-bold text-xl leading-none">{totalStillFlying}</p>
              <p className="text-green-300 text-xs mt-0.5">{t('stillFlying')}</p>
            </div>
            <div className="bg-[#1b5e20] bg-opacity-60 rounded-lg py-2 px-3 text-center">
              <p className="text-white font-bold text-xl leading-none">{clubs.length}</p>
              <p className="text-green-300 text-xs mt-0.5">{t('tabClubs')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4">

        {/* CLUBS TAB */}
        {activeTab === 'clubs' && (() => {
          const liveClubIds = new Set(activeTournaments.map(tr => tr.clubId))
          return (
          <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden mb-4">
            <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-2">
              <p className="text-green-200 text-xs font-bold uppercase tracking-widest">{t('registeredClubs')} ({clubs.length})</p>
            </div>
            {clubs.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                <p className="text-4xl mb-3">🏟️</p>
                <p className="font-bold">{t('noClubsYet')}</p>
              </div>
            ) : (
              <>
                <div className="px-4 pt-3 pb-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('searchClubs')}
                    className="w-full text-sm border border-[#d4edda] rounded-lg px-3 py-2 focus:outline-none focus:border-[#388e3c] bg-[#f9fdf9]"
                  />
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {clubs
                    .filter(club => {
                      const q = searchQuery.toLowerCase()
                      return !q || club.name.toLowerCase().includes(q) || (club.nameUrdu || '').includes(searchQuery) || club.city.toLowerCase().includes(q) || (club.cityUrdu || '').includes(searchQuery)
                    })
                    .map(club => (
                      <button
                        key={club.id}
                        onClick={() => { setNavLoading(`club-${club.id}`); router.push(`/${club.slug}`) }}
                        className="flex items-center gap-3 p-3 border border-[#d4edda] rounded-lg hover:border-[#388e3c] hover:bg-[#f1faf2] transition group text-left w-full"
                      >
                        <div className="w-10 h-10 shrink-0 rounded-full bg-white border border-[#d4edda] overflow-hidden">
                          {navLoading === `club-${club.id}`
                            ? <div className="w-full h-full flex items-center justify-center"><span className="inline-block w-4 h-4 border-2 border-[#388e3c] border-t-transparent rounded-full animate-spin" /></div>
                            : <img src={club.logoUrl || '/pigeon.png'} alt={club.name} className="w-full h-full object-cover" />
                          }
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[#1a1a1a] font-semibold text-sm truncate group-hover:text-[#1b5e20] transition">{club.nameUrdu || club.name}</p>
                            {liveClubIds.has(club.id) && (
                              <span className="shrink-0 bg-[#e65100] text-white text-[10px] px-1.5 py-0.5 rounded font-bold animate-pulse">LIVE</span>
                            )}
                          </div>
                          <p className="text-[#777] text-xs">{club.cityUrdu || club.city}</p>
                        </div>
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
          )
        })()}

        {/* GALLERY TAB */}
        {activeTab === 'gallery' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[#1b5e20] font-bold text-lg leading-tight">{t('eventGallery')}</h2>
                {!galleryLoading && galleryPosts.length > 0 && (
                  <p className="text-[#888] text-xs mt-0.5">{galleryPosts.length} post{galleryPosts.length !== 1 ? 's' : ''}</p>
                )}
              </div>
            </div>

            {galleryLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse">
                    <div className="bg-[#e8f5e9]" style={{ paddingBottom: '75%' }} />
                    <div className="p-4 space-y-2">
                      <div className="h-3 bg-green-100 rounded w-3/4" />
                      <div className="h-2.5 bg-green-100 rounded w-full" />
                      <div className="h-2.5 bg-green-100 rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : galleryPosts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#d4edda] p-12 text-center shadow-sm">
                <div className="w-16 h-16 rounded-full bg-[#e8f5e9] flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🖼️</span>
                </div>
                <p className="text-[#222] font-bold text-base">{t('noGalleryPosts')}</p>
                <p className="text-[#999] text-sm mt-1">{t('noGalleryDesc')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {galleryPosts.map(post => (
                  <div key={post.id} className="bg-white rounded-2xl shadow-md overflow-hidden border border-[#e8f5e9] flex flex-col">
                    <div
                      className="relative w-full bg-[#111] overflow-hidden cursor-pointer"
                      style={{ paddingBottom: '75%' }}
                      onClick={() => setLightboxSrc(post.imageUrl)}
                    >
                      <img
                        src={post.imageUrl}
                        alt={post.title}
                        className="absolute inset-0 w-full h-full object-contain"
                        onError={e => { (e.target as HTMLImageElement).closest('div')!.style.display = 'none' }}
                      />
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <p className="font-bold text-[#1a1a1a] text-sm leading-snug mb-1.5">{post.title}</p>
                      {post.description && (
                        <p className="text-[#666] text-xs leading-relaxed flex-1" style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {post.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2.5 mt-3 pt-3 border-t border-[#f0f0f0]">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1b5e20] to-[#388e3c] flex items-center justify-center shrink-0">
                          <span className="text-white text-xs font-bold">{(post.postedBy || 'P').charAt(0).toUpperCase()}</span>
                        </div>
                        <p className="text-[#444] text-xs font-semibold flex-1 truncate">{post.postedBy}</p>
                        {post.createdAt && (
                          <p className="text-[#bbb] text-xs shrink-0" dir="ltr">
                            {new Date(post.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* HOME TAB */}
        {activeTab === 'home' && <>

        {topScorers.length > 0 && (
          <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden mb-4">
            <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-2">
              <p className="text-green-200 text-xs font-bold uppercase tracking-widest">{t('todaysHighlights')}</p>
            </div>
            <div className="divide-y divide-[#f0f0f0]">
              {topScorers.map((s, i) => {
                const medal = s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : '🥉'
                return (
                  <Link key={i} href={`/${s.clubSlug}/${s.tournamentId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#f9fdf9] transition">
                    <span className="text-xl shrink-0">{medal}</span>
                    {s.photoUrl ? (
                      <img src={s.photoUrl} alt={s.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#e8f5e9] flex items-center justify-center shrink-0">
                        <span className="text-[#2e7d32] text-xs font-bold">{(s.nameUrdu || s.name).charAt(0)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[#1a1a1a] truncate">{s.nameUrdu || s.name}{(s.areaUrdu || s.area) ? <span className="font-normal text-[#888]"> · {s.areaUrdu || s.area}</span> : ''}</p>
                    </div>
                    <p className="font-bold text-lg text-[#1b5e20] shrink-0">{formatTimeDisplay(s.totalHours)}</p>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {winnerPigeons.length > 0 && (
          <div className="bg-white rounded-xl border border-[#d4edda] shadow-sm overflow-hidden mb-4">
            <div className="bg-gradient-to-r from-[#1b5e20] to-[#388e3c] px-4 py-2">
              <p className="text-green-200 text-xs font-bold uppercase tracking-widest">{t('winnerPigeonToday')}</p>
            </div>
            <div className="divide-y divide-[#f0f0f0]">
              {winnerPigeons.map((w, i) => (
                <Link key={i} href={`/${w.clubSlug}/${w.tournamentId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#f9fdf9] transition">
                  {w.photoUrl ? (
                    <div
                      className="w-9 h-9 rounded-full shrink-0 border-2 border-[#c8900a] bg-cover bg-center bg-no-repeat"
                      style={{ backgroundImage: `url(${w.photoUrl})` }}
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ffe066] to-[#c8900a] flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-bold">{(w.nameUrdu || w.name).charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#1a1a1a] truncate">{w.nameUrdu || w.name}{(w.areaUrdu || w.area) ? <span className="font-normal text-[#999]"> · {w.areaUrdu || w.area}</span> : ''}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-base text-[#1b5e20]">{formatTimeDisplay(w.hoursFlown)}</p>
                    <p className="text-[#888] text-xs">{t('landedAt')} {w.landingTime}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {activeTournaments.length > 0 && (
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
                    <div className="flex items-center gap-2">
                      {tr.defaultEndTime && getCountdown(tr.defaultEndTime) && (
                        <span className="text-yellow-300 text-xs font-semibold">⏱ {getCountdown(tr.defaultEndTime)}</span>
                      )}
                      {tr.totalRaceDays > 0 && (
                        <span className="text-green-200 text-xs font-semibold bg-green-900 bg-opacity-40 px-2 py-0.5 rounded-full">
                          {fDayOf(lang, tr.currentDay, tr.totalRaceDays)}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-white font-bold text-sm mb-0.5">{tr.clubNameUrdu || tr.clubName}</p>
                  <p className="text-green-300 text-xs mb-1">{tr.clubCityUrdu || tr.clubCity}</p>
                  <h3 className="text-green-100 text-sm leading-snug">{tr.nameUrdu || tr.name}</h3>
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
                    {tr.topEntries.map((entry, i) => {
                      const rank = getRank(entry, tr.topEntries)
                      return (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2.5 border-b border-[#e9ecef] last:border-b-0"
                        style={{ background: rank === 0 ? '#dff0d8' : i % 2 === 1 ? '#f6faf6' : '#fff' }}
                      >
                        <div className="relative w-9 h-9 shrink-0">
                          {entry.photoUrl ? (
                            <>
                              <img src={entry.photoUrl} alt={entry.name} className="w-9 h-9 rounded-full object-cover" style={{ border: `2px solid ${rank === 0 ? '#c8900a' : rank === 1 ? '#9e9e9e' : '#bbb'}` }} />
                              <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${rankRingClass(rank)}`} style={rankRingStyle(rank)}>
                                {rank + 1}
                              </div>
                            </>
                          ) : (
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${rankRingClass(rank)}`} style={rankRingStyle(rank)}>
                              {rank + 1}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-[#1a1a1a] truncate">{entry.nameUrdu || entry.name}{(entry.areaUrdu || entry.area) ? <span className="font-normal text-[#777]"> · {entry.areaUrdu || entry.area}</span> : ''}</p>
                          {entry.pigeons.some(pg => pg.landingTime) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {entry.pigeons.filter(pg => pg.landingTime).map((pg, pi) => (
                                <span key={pi} className="text-[10px] bg-[#e8f5e9] text-[#2e7d32] px-1.5 py-0.5 rounded font-medium leading-tight">
                                  {pg.landingTime}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="font-bold text-xl text-[#1a1a1a] shrink-0">{formatTimeDisplay(entry.totalHours)}</p>
                      </div>
                    )})}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-gray-400 text-sm bg-[#f9fdf9]">
                    {t('noResultsYet')}
                  </div>
                )}

                <button
                  onClick={() => { setNavLoading(`${tr.clubId}-${tr.id}`); router.push(`/${tr.clubSlug}/${tr.id}`) }}
                  className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-[#23592b] bg-[#f1faf2] border-t border-[#d4edda] hover:bg-[#e8f5e9] transition w-full"
                >
                  {navLoading === `${tr.clubId}-${tr.id}` ? <span className="inline-block w-3 h-3 border-2 border-[#23592b] border-t-transparent rounded-full animate-spin" /> : null}
                  {t('fullResults')} <span>→</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTournaments.length === 0 && (
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

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            alt=""
            className="max-w-full max-h-full object-contain rounded"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white text-3xl font-bold leading-none"
            onClick={() => setLightboxSrc(null)}
          >
            ✕
          </button>
        </div>
      )}
    </main>
  )
}
