import { getAdminDb } from '@/lib/firebase-admin'
import ClubPageClient from '@/components/ClubPageClient'
import type { ClubInitialData } from '@/components/ClubPageClient'

export const dynamic = 'force-dynamic'

export default async function ClubPage({ params }: { params: { clubSlug: string } }) {
  const { clubSlug } = params

  try {
    const db = getAdminDb()

    const clubsSnap = await db.collection('clubs').where('slug', '==', clubSlug).get()
    if (clubsSnap.empty) {
      const data: ClubInitialData = { club: null, tournaments: [], notFound: true }
      return <ClubPageClient initialData={data} clubSlug={clubSlug} />
    }

    const clubDoc = clubsSnap.docs[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clubRaw = clubDoc.data() as any
    const club = {
      id: clubDoc.id,
      name: String(clubRaw.name || ''),
      slug: String(clubRaw.slug || ''),
      city: String(clubRaw.city || ''),
      ...(clubRaw.logoUrl ? { logoUrl: String(clubRaw.logoUrl) } : {}),
    }

    const tSnap = await db.collection('clubs').doc(club.id).collection('tournaments').get()
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const tournaments = tSnap.docs.map((d) => {
      const data = d.data() as any
      const raceDays = (data.raceDays || []).map((rd: any) => ({
        dayNumber: Number(rd.dayNumber),
        date: String(rd.date),
        ...(rd.isGap ? { isGap: true } : {}),
      }))
      return {
        id: d.id,
        name: String(data.name || ''),
        status: String(data.status || ''),
        totalDays: Number(data.totalDays || 0),
        defaultStartTime: String(data.defaultStartTime || ''),
        ...(data.defaultEndTime ? { defaultEndTime: String(data.defaultEndTime) } : {}),
        raceDays,
      }
    })
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return <ClubPageClient initialData={{ club, tournaments, notFound: false }} clubSlug={clubSlug} />
  } catch (err) {
    console.error('Club SSR failed:', err)
    const data: ClubInitialData = { club: null, tournaments: [], notFound: true }
    return <ClubPageClient initialData={data} clubSlug={clubSlug} />
  }
}
