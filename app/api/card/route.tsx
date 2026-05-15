import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

const W = 1170  // 390 × 3 — high-res render

// ── Static assets loaded from filesystem at startup ──────────────
function readBuf(p: string): Buffer | null {
  return fs.existsSync(p) ? fs.readFileSync(p) : null
}
function toArrayBuffer(b: Buffer): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
}
function toDataUrl(b: Buffer, mime: string): string {
  return `data:${mime};base64,${b.toString('base64')}`
}

const fontsDir = path.join(process.cwd(), 'public', 'fonts')

const _pigeonBuf   = readBuf(path.join(process.cwd(), 'public', 'pigeon.png'))
const _cardbkBuf   = readBuf(path.join(process.cwd(), 'public', 'cardbk.jpg'))
const _playfairBuf = readBuf(path.join(fontsDir, 'playfair-italic-700.woff2'))
const _urdu0Buf    = readBuf(path.join(fontsDir, 'noto-naskh-arabic.woff2'))

const PIGEON_DATA_URL = _pigeonBuf  ? toDataUrl(_pigeonBuf,  'image/png')  : null
const CARDBK_DATA_URL = _cardbkBuf  ? toDataUrl(_cardbkBuf,  'image/jpeg') : null
const PLAYFAIR_FONT   = _playfairBuf ? toArrayBuffer(_playfairBuf) : null

const URDU_FONT = _urdu0Buf ? { name: 'UrduFont', data: toArrayBuffer(_urdu0Buf), style: 'normal' as const, weight: 400 as const } : null

// ── Helpers ───────────────────────────────────────────────────────
const isArabic = (t: string) => /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(t)
const safeEn   = (t: string, fb = '') => isArabic(t) ? fb : t

const getMedalColor = (r: number) => r === 1 ? '#f9a825' : r === 2 ? '#9e9e9e' : r === 3 ? '#8d6e63' : null
const getRankLabel  = (r: number) => r === 1 ? '1ST PLACE' : r === 2 ? '2ND PLACE' : '3RD PLACE'
const getRankRing   = (r: number) => r === 1 ? '#f9a825' : r === 2 ? '#9e9e9e' : r === 3 ? '#8d6e63' : '#43a047'

async function fetchPhoto(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let b64 = ''
    for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i])
    return `data:${res.headers.get('content-type') || 'image/jpeg'};base64,${btoa(b64)}`
  } catch { return null }
}

export async function GET(request: NextRequest) {
  try {
    const s = (k: string, def = '') => new URL(request.url).searchParams.get(k) ?? def

    const type          = s('type', 'daily')
    const tournament    = safeEn(s('tournament', 'Tournament'), 'Tournament')
    const club          = safeEn(s('club', 'Club'), 'Club')
    const playerEn      = s('player', '').trim()
    const playerUr      = s('playerUrdu', '').trim()
    const playerDisplay = playerEn || playerUr || 'Player'
    const areaEn        = s('area', '').trim()
    const areaUr        = s('areaUrdu', '').trim()
    const rank          = parseInt(s('rank', '0')) || 0
    const score         = s('score', '')
    const photoUrl      = s('photoUrl')

    const photoData = photoUrl ? await fetchPhoto(photoUrl) : null

    const medalColor = getMedalColor(rank)
    const ringColor  = getRankRing(rank)

    // ── Header ────────────────────────────────────────────────────
    const headerEl = (rightContent: React.ReactNode) => (
      <div style={{ display: 'flex', alignItems: 'center', background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', padding: '36px 54px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <span style={{ fontFamily: 'Playfair, serif', fontStyle: 'italic', color: 'white', fontSize: 36, fontWeight: 700, lineHeight: 1.1 }}>Pakistan Pigeon Racing</span>
          <span style={{ color: '#86efac', fontSize: 18, letterSpacing: 5 }}>LOVE FOR THE LOFT</span>
        </div>
        {PIGEON_DATA_URL && <img src={PIGEON_DATA_URL} width={162} height={162} alt="" />}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9, flex: 1 }}>
          {rightContent}
        </div>
      </div>
    )

    // ── Rank banner ───────────────────────────────────────────────
    const rankBannerEl = medalColor ? (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '21px 0' }}>
        <div style={{ display: 'flex', width: 57, height: 57, borderRadius: 29, background: medalColor }} />
        <span style={{ color: '#1b5e20', fontSize: 39, fontWeight: 900, letterSpacing: 6 }}>{getRankLabel(rank)}</span>
      </div>
    ) : null

    // ── Profile box ───────────────────────────────────────────────
    const profileEl = (scoreLabel: string) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 42, margin: '24px 36px', borderRadius: 36, padding: '33px 42px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <span style={{ color: '#1b5e20', fontSize: 51, fontWeight: 900, lineHeight: 1.1 }}>{tournament}</span>
          {playerEn ? <span style={{ color: '#111', fontSize: 45, fontWeight: 800, marginTop: 12 }}>{playerEn}</span> : null}
          {playerUr ? <span style={{ fontFamily: 'UrduFont, serif', direction: 'rtl', color: '#111', fontSize: playerEn ? 36 : 45, fontWeight: 400, marginTop: playerEn ? 4 : 12 }}>{playerUr}</span> : null}
          {!playerEn && !playerUr ? <span style={{ color: '#111', fontSize: 45, fontWeight: 800, marginTop: 12 }}>Player</span> : null}
          {areaEn ? <span style={{ color: '#2e7d32', fontSize: 30, marginTop: 6 }}>{areaEn}</span> : null}
          {areaUr && !areaEn ? <span style={{ fontFamily: 'UrduFont, serif', direction: 'rtl', color: '#2e7d32', fontSize: 30, marginTop: 6 }}>{areaUr}</span> : null}
          {!medalColor && rank > 0 ? (
            <div style={{ display: 'flex', alignSelf: 'flex-start', background: 'rgba(56,142,60,0.85)', borderRadius: 60, padding: '6px 27px', marginTop: 12 }}>
              <span style={{ color: 'white', fontSize: 27, fontWeight: 800 }}>#{rank}</span>
            </div>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 18 }}>
            <span style={{ color: '#888', fontSize: 21, letterSpacing: 4, fontWeight: 700 }}>{scoreLabel}</span>
            <span style={{ color: '#1b5e20', fontSize: 57, fontWeight: 900 }}>{score || '--:--'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexShrink: 0 }}>
          <div style={{ display: 'flex', width: 219, height: 219, borderRadius: 110, border: `9px solid ${ringColor}`, background: 'rgba(232,245,233,0.7)', alignItems: 'center', justifyContent: 'center' }}>
            {photoData
              ? <img src={photoData} width={219} height={219} style={{ borderRadius: 110 }} alt="" />
              : <span style={{ fontSize: 81, fontWeight: 900, color: '#1b5e20' }}>{playerDisplay.charAt(0).toUpperCase()}</span>}
          </div>
        </div>
      </div>
    )

    // ── Grid ──────────────────────────────────────────────────────
    const gridEl = (cells: { i: number; label: string; time: string; active: boolean }[], cols: number) => {
      const rows: typeof cells[] = []
      for (let r = 0; r < Math.ceil(cells.length / cols); r++) {
        const row = [...cells.slice(r * cols, (r + 1) * cols)]
        while (row.length < cols) row.push({ i: -1, label: '', time: '', active: false })
        rows.push(row)
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, margin: '6px 36px 30px', gap: 18 }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 18, flex: 1 }}>
              {row.map((cell, ci) => cell.i === -1
                ? <div key={ci} style={{ flex: 1, display: 'flex' }} />
                : (
                  <div key={cell.i} style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: cell.active ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.55)',
                    borderRadius: 24, padding: '18px 6px',
                    border: cell.active ? '2px solid rgba(46,125,50,0.55)' : '2px solid rgba(0,0,0,0.10)',
                  }}>
                    <span style={{ color: cell.active ? '#2e7d32' : '#bdbdbd', fontSize: 24, fontWeight: 700 }}>{cell.label}</span>
                    <span style={{ color: cell.active ? '#1b5e20' : '#d0d0d0', fontSize: 39, fontWeight: 900, marginTop: 6 }}>{cell.time}</span>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )
    }

    // ── DAILY CARD ────────────────────────────────────────────────
    if (type === 'daily') {
      const day         = s('day', '1')
      const totalDays   = s('totalDays', '1')
      const date        = s('date', '')
      const pigeonCount = Math.max(1, parseInt(s('pigeonCount', '1')) || 1)
      const timesRaw    = s('times')
      const rawTimes    = timesRaw ? timesRaw.split(',') : []
      while (rawTimes.length < pigeonCount) rawTimes.push('')

      const cells  = rawTimes.slice(0, pigeonCount).map((t, i) => ({ i, label: `#${i + 1}`, time: t || '--', active: !!(t && t !== '--') }))
      const cols   = pigeonCount <= 6 ? 3 : pigeonCount <= 12 ? 4 : 5
      const nRows  = Math.ceil(pigeonCount / cols)
      const height = Math.min(Math.max(1500, 870 + (medalColor ? 108 : 0) + nRows * 216), 2250)
      const gridH  = Math.round((nRows * 216 + 36) * 0.7)

      return new ImageResponse(
        (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: 'sans-serif', background: 'linear-gradient(160deg,#e8f5e9,#f9fdf9,#e8f5e9)', position: 'relative' }}>
            {CARDBK_DATA_URL && <img src={CARDBK_DATA_URL} width={W} height={gridH} style={{ position: 'absolute', bottom: 0, left: 0, objectFit: 'contain', opacity: 0.06 }} alt="" />}
            {headerEl(
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
                <span style={{ color: 'white', fontSize: 36, fontWeight: 800 }}>{club}</span>
                <span style={{ color: '#c8e6c9', fontSize: 30, fontWeight: 700 }}>{`DAY ${day} / ${totalDays}`}</span>
                {date ? <span style={{ color: '#a5d6a7', fontSize: 27 }}>{date}</span> : null}
              </div>
            )}
            {rankBannerEl}
            {profileEl('DAY TOTAL')}
            {gridEl(cells, cols)}
          </div>
        ),
        { width: W, height, fonts: [...(PLAYFAIR_FONT ? [{ name: 'Playfair', data: PLAYFAIR_FONT, style: 'italic' as const, weight: 700 as const }] : []), ...(URDU_FONT ? [URDU_FONT] : [])] }
      )
    }

    // ── OVERALL CARD ──────────────────────────────────────────────
    const totalDays   = Math.max(1, parseInt(s('totalDays', '1')) || 1)
    const dayTimesRaw = s('dayTimes')
    const rawDayTimes = dayTimesRaw ? dayTimesRaw.split(',') : []
    while (rawDayTimes.length < totalDays) rawDayTimes.push('')

    const dayCells = rawDayTimes.slice(0, totalDays).map((t, i) => ({ i, label: `DAY ${i + 1}`, time: t || '--', active: !!(t && t !== '--') }))
    const dayCols  = totalDays <= 3 ? totalDays : totalDays <= 8 ? 4 : 5
    const dayRows  = Math.ceil(totalDays / dayCols)
    const height   = Math.min(Math.max(1440, 840 + (medalColor ? 108 : 0) + dayRows * 216), 2160)
    const gridH    = Math.round((dayRows * 216 + 36) * 0.7)

    return new ImageResponse(
      (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: 'sans-serif', background: 'linear-gradient(160deg,#e8f5e9,#f9fdf9,#e8f5e9)', position: 'relative' }}>
          {CARDBK_DATA_URL && <img src={CARDBK_DATA_URL} width={W} height={gridH} style={{ position: 'absolute', bottom: 0, left: 0, objectFit: 'contain', opacity: 0.06 }} alt="" />}
          {headerEl(
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
              <span style={{ color: 'white', fontSize: 36, fontWeight: 800 }}>{club}</span>
              <span style={{ color: '#c8e6c9', fontSize: 30, fontWeight: 700 }}>OVERALL RESULT</span>
              <span style={{ color: '#a5d6a7', fontSize: 27 }}>{`${totalDays} DAY${totalDays > 1 ? 'S' : ''}`}</span>
            </div>
          )}
          {rankBannerEl}
          {profileEl('TOTAL TIME')}
          {gridEl(dayCells, dayCols)}
        </div>
      ),
      { width: W, height, fonts: [...(PLAYFAIR_FONT ? [{ name: 'Playfair', data: PLAYFAIR_FONT, style: 'italic' as const, weight: 700 as const }] : []), ...(URDU_FONT ? [URDU_FONT] : [])] }
    )

  } catch (err) {
    return new Response(`Card error: ${err}`, { status: 500, headers: { 'content-type': 'text/plain' } })
  }
}
