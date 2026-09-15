import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://kapioajfhqnowgzzxros.supabase.co',
  'sb_publishable_kw0OAGWVnOxigswKa-_o5g_4Dg4pWHW'
)

type Mode = 'text' | 'doodle'

const SWATCHES = ['#00E5CC', '#FFFFFF', '#FF4D6D', '#FFD166', '#74C0FC']
const MAX_CHARS = 280

interface DrawPoint { x: number; y: number }
interface Stroke { points: DrawPoint[]; color: string; width: number }

export default function App() {
  const [mode, setMode] = useState<Mode>('text')
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  // doodle state
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<DrawPoint[]>([])
  const isDrawing = useRef(false)
  const [strokeColor, setStrokeColor] = useState(SWATCHES[0])
  const [strokeWidth, setStrokeWidth] = useState(3)

  const redraw = useCallback((strokeList: Stroke[], active: DrawPoint[] = []) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const drawStroke = (pts: DrawPoint[], color: string, width: number) => {
      if (pts.length < 2) return
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.stroke()
    }

    strokeList.forEach(s => drawStroke(s.points, s.color, s.width))
    if (active.length > 1) drawStroke(active, strokeColor, strokeWidth)
  }, [strokeColor, strokeWidth])

  useEffect(() => {
    redraw(strokes, currentStroke)
  }, [strokes, currentStroke, redraw])

  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement): DrawPoint => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    }
  }

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    isDrawing.current = true
    const pt = getPos(e, canvas)
    setCurrentStroke([pt])
  }

  const moveDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!isDrawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const pt = getPos(e, canvas)
    setCurrentStroke(prev => [...prev, pt])
  }

  const endDraw = () => {
    if (!isDrawing.current) return
    isDrawing.current = false
    if (currentStroke.length > 1) {
      setStrokes(prev => [...prev, { points: currentStroke, color: strokeColor, width: strokeWidth }])
    }
    setCurrentStroke([])
  }

  const handleClear = () => { setStrokes([]); setCurrentStroke([]) }
  const handleUndo = () => setStrokes(prev => prev.slice(0, -1))

  const handleSend = async () => {
    if (isSending || !canSend) return
    setIsSending(true)

    const payload =
      mode === 'text'
        ? { type: 'text', content: text }
        : { type: 'doodle', content: JSON.stringify(strokes) }

    const { error } = await supabase.from('messages').insert(payload)

    setIsSending(false)

    if (error) {
      console.error('Failed to send to Supabase:', error)
      return
    }

    setSent(true)
    setTimeout(() => setSent(false), 2000)
    if (mode === 'text') setText('')
    if (mode === 'doodle') handleClear()
  }

  const canSend = mode === 'text' ? text.trim().length > 0 : strokes.length > 0

  return (
    <div
  className="flex flex-col"
  style={{
    width: '100%',
    height: '100dvh',
    minHeight: '100px',
    marginLeft: '6px',
    marginRight: '6px',
    background: 'linear-gradient(160deg, #0D0F13 0%, #08090B 60%)',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '16px',
  }}
>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        top: -80,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 260,
        height: 260,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,229,204,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 pt-12 flex-shrink-0" style={{ paddingBottom: 0 }}>
        <div className="flex flex-col">
          <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', color: '#EEF2F7' }}>
            Yeti V1.0
          </span>
          <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.3px', marginTop: 1 }}>
            Desktop companion
          </span>
        </div>
        {/* Connection badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            background: 'rgba(0,229,204,0.1)',
            border: '1px solid rgba(0,229,204,0.22)',
            borderRadius: 999,
            padding: '6px 12px',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#00E5CC',
            boxShadow: '0 0 6px #00E5CC',
            display: 'inline-block',
            animation: 'pulse 2.4s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: '#00E5CC', letterSpacing: '0.2px' }}>
            Connected
          </span>
        </div>
      </header>

      {/* ── Mode Toggle ── */}
      <div className="px-6 pb-3 flex-shrink-0">
        <div
          style={{
            display: 'flex',
            height: 50,
            gap: 0,
            background: 'rgba(255,255,255,0.055)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 14,
            padding: 4,
            backdropFilter: 'blur(16px)',
          }}
        >
          {(['text', 'doodle'] as Mode[]).map((m) => {
            const active = mode === m
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  letterSpacing: '0.2px',
                  transition: 'all 0.22s ease',
                  background: active
                    ? 'linear-gradient(135deg, rgba(0,229,204,0.2) 0%, rgba(0,229,204,0.1) 100%)'
                    : 'transparent',
                  color: active ? '#00E5CC' : 'rgba(255,255,255,0.42)',
                  boxShadow: active ? '0 0 0 1px rgba(0,229,204,0.3)' : 'none',
                }}
              >
                {m === 'text' ? '💬 Text' : '🎨 Doodle'}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="px-6 flex flex-col" style={{ flex: 1, minHeight: 0 }}>

        {/* Text Mode — always mounted, hidden when inactive to prevent layout shift */}
        <div
          style={{
            flex: 1,
            minHeight: 160,
            background: 'rgba(255,255,255,0.055)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 20,
            backdropFilter: 'blur(20px)',
            display: mode === 'text' ? 'flex' : 'none',
            flexDirection: 'column',
            padding: '20px',
            position: 'relative',
            transition: 'border-color 0.2s',
            borderColor: text.length > 0 ? 'rgba(0,229,204,0.2)' : 'rgba(255,255,255,0.09)',
          }}
        >
          <textarea
            value={text}
            onChange={e => e.target.value.length <= MAX_CHARS && setText(e.target.value)}
            placeholder="Type a message to Yeti..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              fontFamily: 'Outfit, sans-serif',
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.65,
              color: '#EEF2F7',
              letterSpacing: '0.1px',
            }}
          />
          {/* Char counter */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              position: 'relative',
              flexShrink: 0,
            }}>
              <svg width="28" height="28" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                <circle
                  cx="14" cy="14" r="11"
                  fill="none"
                  stroke={text.length > MAX_CHARS * 0.8 ? '#FF4D6D' : '#00E5CC'}
                  strokeWidth="2"
                  strokeDasharray={`${2 * Math.PI * 11}`}
                  strokeDashoffset={`${2 * Math.PI * 11 * (1 - text.length / MAX_CHARS)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.15s' }}
                />
              </svg>
            </div>
            <span style={{
              fontSize: 12,
              color: text.length > MAX_CHARS * 0.8 ? '#FF4D6D' : 'rgba(255,255,255,0.32)',
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {MAX_CHARS - text.length}
            </span>
          </div>
        </div>

        {/* Doodle Mode — always mounted, hidden when inactive */}
        <div style={{ flex: 1, minHeight: 200, display: mode === 'doodle' ? 'flex' : 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, overflow: 'hidden' }}>
            {/* Canvas card */}
            <div
              style={{
                background: 'rgba(255,255,255,0.055)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 20,
                backdropFilter: 'blur(20px)',
                padding: 12,
                width: '100%',
                maxHeight: '100%',
                display: 'flex',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <canvas
                ref={canvasRef}
                width={240}
                height={280}
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={moveDraw}
                onTouchEnd={endDraw}
                style={{
                  width: 'auto',
                  height: '100%',
                  maxWidth: 240,
                  maxHeight: 280,
                  aspectRatio: '6 / 7',
                  borderRadius: 12,
                  background: 'rgba(0,0,0,0.35)',
                  cursor: 'crosshair',
                  display: 'block',
                  touchAction: 'none',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              />
            </div>

            {/* Toolbar */}
            <div
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.055)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 16,
                backdropFilter: 'blur(16px)',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {/* Actions row */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={handleClear}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.65)',
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={handleUndo}
                  disabled={strokes.length === 0}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.06)',
                    color: strokes.length === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.65)',
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: strokes.length === 0 ? 'default' : 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  Undo
                </button>
                {/* Stroke thickness */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 4 }}>
                  {[2, 4, 7].map(w => (
                    <button
                      key={w}
                      onClick={() => setStrokeWidth(w)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: strokeWidth === w ? '2px solid #00E5CC' : '1px solid rgba(255,255,255,0.15)',
                        background: strokeWidth === w ? 'rgba(0,229,204,0.12)' : 'rgba(255,255,255,0.06)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                        padding: 0,
                      }}
                    >
                      <div style={{
                        width: w + 2,
                        height: w + 2,
                        borderRadius: '50%',
                        background: strokeWidth === w ? '#00E5CC' : 'rgba(255,255,255,0.5)',
                      }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Color swatches */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase', flexShrink: 0 }}>
                  Color
                </span>
                <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                  {SWATCHES.map(c => (
                    <button
                      key={c}
                      onClick={() => setStrokeColor(c)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: c,
                        border: strokeColor === c ? '2.5px solid #fff' : '2px solid rgba(255,255,255,0.15)',
                        cursor: 'pointer',
                        padding: 0,
                        transform: strokeColor === c ? 'scale(1.18)' : 'scale(1)',
                        transition: 'all 0.15s',
                        boxShadow: strokeColor === c ? `0 0 8px ${c}80` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
      </div>

      {/* ── Footer ── */}
      <div className="px-6 pb-4 pt-5 flex-shrink-0">
        <button
          onClick={handleSend}
          disabled={!canSend || isSending}
          style={{
            width: '100%',
            padding: '17px 24px',
            borderRadius: 16,
            border: 'none',
            cursor: canSend && !isSending ? 'pointer' : 'default',
            fontFamily: 'Outfit, sans-serif',
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '0.2px',
            transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
            background: sent
              ? 'linear-gradient(135deg, #00B8A4 0%, #00E5CC 100%)'
              : canSend && !isSending
                ? 'linear-gradient(135deg, #00C9B4 0%, #00E5CC 50%, #1AFFEC 100%)'
                : 'rgba(255,255,255,0.07)',
            color: canSend || sent ? '#08090B' : 'rgba(255,255,255,0.22)',
            boxShadow: canSend && !isSending && !sent
              ? '0 4px 24px rgba(0,229,204,0.35), 0 1px 4px rgba(0,0,0,0.4)'
              : 'none',
            transform: isSending ? 'scale(0.97)' : 'scale(1)',
          }}
        >
          {sent ? '✓ Sent to Yeti' : isSending ? 'Sending...' : 'Send to Yeti →'}
        </button>
        <p style={{
          textAlign: 'center',
          marginTop: 12,
          fontSize: 11,
          fontWeight: 400,
          color: 'rgba(255,255,255,0.22)',
          letterSpacing: '0.4px',
          fontFamily: 'Outfit, sans-serif',
        }}>
          Yeti Messenger v1.0
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #00E5CC; }
          50% { opacity: 0.55; box-shadow: 0 0 10px #00E5CC; }
        }
      `}</style>
    </div>
  )
}
