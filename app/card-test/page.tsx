import dynamic from 'next/dynamic'

const CardTestClient = dynamic(() => import('./CardTestClient'), { ssr: false })

export default function CardTestPage() {
  return <CardTestClient />
}
