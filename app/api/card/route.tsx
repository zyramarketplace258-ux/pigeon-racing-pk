import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const isArabic = (text: string) => /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(text)
const safe = (text: string, fallback = '') => isArabic(text) ? fallback : text

export async function GET(request: NextRequest) {
  try {
    const s = (k: string, def = '') => new URL(request.url).searchParams.get(k) ?? def

    const tournament = safe(s('tournament', 'Spring Championship 2026'), 'Tournament')
    const club       = safe(s('club', 'Punjab Pigeons'), 'Club')
    const player     = safe(s('player', 'Ustad Malik Shahzad'), s('playerUrdu', 'Player'))
    const area       = safe(s('area', 'Dhing'), safe(s('areaUrdu', ''), ''))
    const photoUrl   = s('photoUrl')
    const date       = s('date', '06 May 2026')
    const day        = s('day', '7')
    const totalDays  = s('totalDays', '7')
    const rank       = parseInt(s('rank', '1')) || 1
    const score      = s('score', '92:05')
    const timesRaw   = s('times')

    const times: string[] = timesRaw ? timesRaw.split(',') : []
    while (times.length < 9) times.push('')

    const landed = times.filter(t => t && t !== '--').length
    const inAir  = 9 - landed

    const rankBg = rank === 1 ? '#e53935' : rank === 2 ? '#757575' : rank === 3 ? '#8d6e63' : '#388e3c'

    let photoData: string | null = null
    if (photoUrl) {
      try {
        const res   = await fetch(photoUrl)
        const buf   = await res.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let b64 = ''
        for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i])
        photoData = `data:${res.headers.get('content-type') || 'image/jpeg'};base64,${btoa(b64)}`
      } catch { /* skip */ }
    }

    const cells = times.slice(0, 9).map((time, i) => ({
      i,
      time: time || '--',
      landed: !!(time && time !== '--'),
    }))

    const row = (start: number) => (
      <div style={{ display: 'flex', gap: 10, flex: 1 }}>
        {cells.slice(start, start + 3).map(cell => (
          <div key={cell.i} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            background: 'rgba(255,255,255,0.75)',
            borderRadius: 12,
            border: `2px solid ${cell.landed ? 'rgba(76,175,80,0.45)' : 'rgba(255,152,0,0.55)'}`,
          }}>
            <div style={{
              display: 'flex', height: 7,
              background: cell.landed ? '#4caf50' : '#ff9800',
              borderRadius: '10px 10px 0 0',
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '6px 4px' }}>
              <span style={{ color: '#aaa', fontSize: 10, fontWeight: 700 }}>#{cell.i + 1}</span>
              <span style={{ color: cell.landed ? '#1b5e20' : '#f57c00', fontSize: 20, fontWeight: 900, marginTop: 3 }}>
                {cell.time}
              </span>
            </div>
          </div>
        ))}
      </div>
    )

    return new ImageResponse(
      (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: 'sans-serif', background: '#eef4ee' }}>

          {/* ── HEADER ── */}
          <div style={{ display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg,#1a4a1f,#2e7d32)', padding: '16px 24px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 40 }}>🕊️</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'white', fontSize: 22, fontWeight: 900 }}>Punjab Pigeons</span>
                  <span style={{ color: '#a5d6a7', fontSize: 10, letterSpacing: 3 }}>RACING FEDERATION</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'white', fontSize: 15, fontWeight: 700 }}>{tournament}</span>
                <div style={{ display: 'flex', background: '#e53935', borderRadius: 6, padding: '3px 10px' }}>
                  <span style={{ color: 'white', fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>LIVE</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {[`DAY ${day} OF ${totalDays}`, date, club].map((label, i) => (
                <div key={i} style={{ display: 'flex', background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '4px 14px', border: '1px solid rgba(255,255,255,0.3)' }}>
                  <span style={{ color: 'white', fontSize: 11, fontWeight: 600 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── PROFILE CARD ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '14px 18px', background: 'white', borderRadius: 16, padding: '14px 20px', border: '1px solid #e0e0e0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '2px solid #c8e6c9', borderRadius: 12, padding: '10px 20px', background: '#f1fbf1', flexShrink: 0 }}>
              <span style={{ color: '#888', fontSize: 9, letterSpacing: 2, fontWeight: 700 }}>TOTAL TIME</span>
              <span style={{ color: '#1b5e20', fontSize: 36, fontWeight: 900, lineHeight: 1, marginTop: 4 }}>{score}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center' }}>
              <span style={{ color: '#111', fontSize: 22, fontWeight: 800, textAlign: 'center' }}>{player}</span>
              {area ? <span style={{ color: '#4caf50', fontSize: 13, marginTop: 4 }}>{area}</span> : null}
            </div>
            <div style={{ display: 'flex', position: 'relative', flexShrink: 0 }}>
              <div style={{ display: 'flex', width: 74, height: 74, borderRadius: 37, border: '3px solid #43a047', background: '#e8f5e9', alignItems: 'center', justifyContent: 'center' }}>
                {photoData
                  ? <img src={photoData} width={74} height={74} style={{ borderRadius: 37 }} alt="" />
                  : <span style={{ fontSize: 28, fontWeight: 900, color: '#1b5e20' }}>{player.charAt(0).toUpperCase()}</span>
                }
              </div>
              <div style={{ display: 'flex', position: 'absolute', top: -4, right: -4, width: 26, height: 26, borderRadius: 13, background: rankBg, alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                <span style={{ color: 'white', fontSize: 11, fontWeight: 900 }}>{String(rank)}</span>
              </div>
            </div>
          </div>

          {/* ── PIGEON GRID ── */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, margin: '0 18px', position: 'relative' }}>
            <div style={{ display: 'flex', position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ display: 'flex', opacity: 0.07 }}>
                <span style={{ fontSize: 200 }}>🕊️</span>
              </div>
            </div>
            {row(0)}
            <div style={{ display: 'flex', height: 10 }} />
            {row(3)}
            <div style={{ display: 'flex', height: 10 }} />
            {row(6)}
          </div>

          {/* ── FOOTER PILLS ── */}
          <div style={{ display: 'flex', gap: 12, padding: '14px 18px 10px' }}>
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,#e65100,#ff9800)', borderRadius: 30, padding: '11px 22px' }}>
              <span style={{ color: 'white', fontSize: 13, fontWeight: 800 }}>STILL IN AIR</span>
              <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{inAir} pigeon{inAir !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,#1b5e20,#43a047)', borderRadius: 30, padding: '11px 22px' }}>
              <span style={{ color: 'white', fontSize: 13, fontWeight: 800 }}>LANDED</span>
              <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{landed} pigeon{landed !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* ── BOTTOM WATERMARK ── */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 12 }}>
            <span style={{ color: 'rgba(27,94,32,0.13)', fontSize: 26, fontWeight: 900, letterSpacing: 4 }}>PUNJAB PIGEONS</span>
          </div>

        </div>
      ),
      { width: 900, height: 640 }
    )
  } catch (err) {
    return new Response(`Card error: ${err}`, { status: 500, headers: { 'content-type': 'text/plain' } })
  }
}
