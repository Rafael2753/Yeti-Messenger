import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kapioajfhqnowgzzxros.supabase.co'
const SUPABASE_KEY = 'sb_publishable_kw0OAGWVnOxigswKa-_o5g_4Dg4pWHW'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

type Mode = 'text' | 'doodle'
type YetiId = 'YETI_A' | 'YETI_B'

const SWATCHES = [
  '#00E5CC',
  '#FFFFFF',
  '#FF4D6D',
  '#FFD166',
  '#74C0FC',
]

const WIDTHS = [2, 4, 7]
const MAX_CHARS = 280

const CANVAS_WIDTH = 280
const CANVAS_HEIGHT = 240

interface DrawPoint {
  x: number
  y: number
}

interface Stroke {
  points: DrawPoint[]
  color: string
  width: number
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [mode, setMode] = useState<Mode>('doodle')
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)

  const [recipientId, setRecipientId] = useState<YetiId>(() => {
    const saved = localStorage.getItem('yeti_id')
    return saved === 'YETI_B' ? 'YETI_B' : 'YETI_A'
  })

  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    return localStorage.getItem('yeti_onboarding_complete') === 'true'
  })

  const [strokeColor, setStrokeColor] = useState(
    recipientId === 'YETI_A' ? '#00E5CC' : '#FFD166'
  )

  const [strokeWidth, setStrokeWidth] = useState(4)

  const accentColor =
    recipientId === 'YETI_A'
      ? '#00E5CC'
      : '#FFD166'

  const accentBackground =
    recipientId === 'YETI_A'
      ? 'rgba(0, 229, 204, 0.10)'
      : 'rgba(255, 209, 102, 0.10)'

  const canSend =
    mode === 'text'
      ? text.trim().length > 0
      : strokes.length > 0

  useEffect(() => {
    setStrokeColor(
      recipientId === 'YETI_A'
        ? '#00E5CC'
        : '#FFD166'
    )
  }, [recipientId])

  const selectYeti = (id: YetiId) => {
    setRecipientId(id)
    localStorage.setItem('yeti_id', id)
    localStorage.setItem('yeti_onboarding_complete', 'true')
    setOnboardingComplete(true)
  }

  const drawStroke = (
    ctx: CanvasRenderingContext2D,
    stroke: Stroke
  ) => {
    if (stroke.points.length === 0) return

    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (stroke.points.length === 1) {
      const point = stroke.points[0]

      ctx.beginPath()
      ctx.arc(
        point.x,
        point.y,
        stroke.width / 2,
        0,
        Math.PI * 2
      )
      ctx.fillStyle = stroke.color
      ctx.fill()

      return
    }

    ctx.beginPath()
    ctx.moveTo(
      stroke.points[0].x,
      stroke.points[0].y
    )

    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(
        stroke.points[i].x,
        stroke.points[i].y
      )
    }

    ctx.stroke()
  }

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(
      0,
      0,
      CANVAS_WIDTH,
      CANVAS_HEIGHT
    )

    ctx.fillStyle = '#080B0D'
    ctx.fillRect(
      0,
      0,
      CANVAS_WIDTH,
      CANVAS_HEIGHT
    )

    for (const stroke of strokes) {
      drawStroke(ctx, stroke)
    }

    if (currentStroke) {
      drawStroke(ctx, currentStroke)
    }
  }, [strokes, currentStroke])

  useEffect(() => {
    redrawCanvas()
  }, [redrawCanvas])

  const getCanvasPoint = (
    event: React.PointerEvent<HTMLCanvasElement>
  ): DrawPoint => {
    const canvas = canvasRef.current
    if (!canvas) {
      return { x: 0, y: 0 }
    }

    const rect = canvas.getBoundingClientRect()

    return {
      x:
        ((event.clientX - rect.left) / rect.width) *
        CANVAS_WIDTH,

      y:
        ((event.clientY - rect.top) / rect.height) *
        CANVAS_HEIGHT,
    }
  }

  const handlePointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>
  ) => {
    if (mode !== 'doodle') return

    event.currentTarget.setPointerCapture(event.pointerId)

    const point = getCanvasPoint(event)

    setCurrentStroke({
      points: [point],
      color: strokeColor,
      width: strokeWidth,
    })
  }

  const handlePointerMove = (
    event: React.PointerEvent<HTMLCanvasElement>
  ) => {
    if (mode !== 'doodle' || !currentStroke) return

    const point = getCanvasPoint(event)

    setCurrentStroke({
      ...currentStroke,
      points: [
        ...currentStroke.points,
        point,
      ],
    })
  }

  const handlePointerUp = (
    event: React.PointerEvent<HTMLCanvasElement>
  ) => {
    if (mode !== 'doodle' || !currentStroke) return

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      )
    } catch {
      // Pointer capture may already be released.
    }

    setStrokes(prev => [
      ...prev,
      currentStroke,
    ])

    setCurrentStroke(null)
  }

  const handleClear = () => {
    setStrokes([])
    setCurrentStroke(null)
  }

  const handleSend = async () => {
    if (isSending || !canSend) return

    setIsSending(true)

    const payload =
      mode === 'text'
        ? {
            type: 'text',
            sender_id: 'PHONE',
            recipient_id: recipientId,
            content: text,
          }
        : {
            type: 'doodle',
            sender_id: 'PHONE',
            recipient_id: recipientId,
            content: JSON.stringify(strokes),
          }

    const { error } = await supabase
      .from('messages')
      .insert(payload)

    setIsSending(false)

    if (error) {
      console.error(
        'Failed to send to Supabase:',
        error
      )
      return
    }

    setSent(true)

    setTimeout(() => {
      setSent(false)
    }, 2000)

    if (mode === 'text') {
      setText('')
    }

    if (mode === 'doodle') {
      handleClear()
    }
  }

  /*
   * FIRST-LAUNCH ONBOARDING
   */
  if (!onboardingComplete) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#050708',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          boxSizing: 'border-box',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: -2,
            marginBottom: 8,
          }}
        >
          YETI
        </div>

        <div
          style={{
            color: '#8B949E',
            fontSize: 15,
            textAlign: 'center',
            marginBottom: 40,
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          Which YETI is this app connected to?
        </div>

        <div
          style={{
            width: '100%',
            maxWidth: 360,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <button
            onClick={() => selectYeti('YETI_A')}
            style={{
              appearance: 'none',
              width: '100%',
              background: '#0B1112',
              border: '2px solid #00E5CC',
              color: '#00E5CC',
              borderRadius: 18,
              padding: '22px 20px',
              cursor: 'pointer',
              textAlign: 'left',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                fontSize: 21,
                fontWeight: 700,
              }}
            >
              YETI_A
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                color: '#8B949E',
              }}
            >
              Cyan
            </div>
          </button>

          <button
            onClick={() => selectYeti('YETI_B')}
            style={{
              appearance: 'none',
              width: '100%',
              background: '#14120C',
              border: '2px solid #FFD166',
              color: '#FFD166',
              borderRadius: 18,
              padding: '22px 20px',
              cursor: 'pointer',
              textAlign: 'left',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                fontSize: 21,
                fontWeight: 700,
              }}
            >
              YETI_B
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                color: '#8B949E',
              }}
            >
              Yellow
            </div>
          </button>
        </div>
      </div>
    )
  }

  /*
   * MAIN APP
   */
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#050708',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* HEADER */}
      <header
        style={{
          padding: '18px 20px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #171B1E',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: -0.5,
            }}
          >
            YETI
          </div>

          <div
            style={{
              marginTop: 3,
              fontSize: 12,
              color: accentColor,
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            {recipientId}
          </div>
        </div>

        <div
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: accentColor,
            boxShadow: `0 0 12px ${accentColor}`,
          }}
        />
      </header>

      {/* MODE SELECTOR */}
      <div
        style={{
          padding: '14px 20px 10px',
          display: 'flex',
          gap: 8,
        }}
      >
        <button
          onClick={() => setMode('doodle')}
          style={{
            flex: 1,
            border: `1px solid ${
              mode === 'doodle'
                ? accentColor
                : '#252A2E'
            }`,
            background:
              mode === 'doodle'
                ? accentBackground
                : '#0B0E10',
            color:
              mode === 'doodle'
                ? accentColor
                : '#8B949E',
            borderRadius: 12,
            padding: '10px 12px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Doodle
        </button>

        <button
          onClick={() => setMode('text')}
          style={{
            flex: 1,
            border: `1px solid ${
              mode === 'text'
                ? accentColor
                : '#252A2E'
            }`,
            background:
              mode === 'text'
                ? accentBackground
                : '#0B0E10',
            color:
              mode === 'text'
                ? accentColor
                : '#8B949E',
            borderRadius: 12,
            padding: '10px 12px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Text
        </button>
      </div>

      {/* CONTENT */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '8px 20px 0',
          minHeight: 0,
        }}
      >
        {mode === 'doodle' ? (
          <>
            {/* CANVAS */}
            <div
              style={{
                width: '100%',
                maxWidth: CANVAS_WIDTH,
                aspectRatio: '7 / 6',
                margin: '0 auto',
                background: '#080B0D',
                border: '1px solid #1D2327',
                borderRadius: 16,
                overflow: 'hidden',
                touchAction: 'none',
              }}
            >
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  cursor: 'crosshair',
                  touchAction: 'none',
                }}
              />
            </div>

            {/* COLOR CONTROLS */}
            <div
              style={{
                paddingTop: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              {SWATCHES.map(color => (
                <button
                  key={color}
                  onClick={() => setStrokeColor(color)}
                  aria-label={`Color ${color}`}
                  style={{
                    width: 26,
                    height: 26,
                    padding: 0,
                    borderRadius: '50%',
                    background: color,
                    border:
                      strokeColor === color
                        ? `3px solid ${accentColor}`
                        : '2px solid #343A40',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                />
              ))}
            </div>

            {/* WIDTH CONTROLS */}
            <div
              style={{
                paddingTop: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  color: '#69727A',
                  fontSize: 12,
                  marginRight: 2,
                }}
              >
                Width
              </span>

              {WIDTHS.map(width => (
                <button
                  key={width}
                  onClick={() =>
                    setStrokeWidth(width)
                  }
                  style={{
                    minWidth: 38,
                    height: 30,
                    borderRadius: 9,
                    border:
                      strokeWidth === width
                        ? `1px solid ${accentColor}`
                        : '1px solid #252A2E',
                    background:
                      strokeWidth === width
                        ? accentBackground
                        : '#0B0E10',
                    color:
                      strokeWidth === width
                        ? accentColor
                        : '#8B949E',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {width}
                </button>
              ))}

              <button
                onClick={handleClear}
                style={{
                  marginLeft: 'auto',
                  height: 30,
                  padding: '0 12px',
                  borderRadius: 9,
                  border: '1px solid #252A2E',
                  background: '#0B0E10',
                  color: '#8B949E',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Clear
              </button>
            </div>
          </>
        ) : (
          /* TEXT MODE */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <textarea
              value={text}
              onChange={event => {
                if (
                  event.target.value.length <=
                  MAX_CHARS
                ) {
                  setText(event.target.value)
                }
              }}
              placeholder="Write something for YETI..."
              maxLength={MAX_CHARS}
              style={{
                flex: 1,
                width: '100%',
                minHeight: 220,
                resize: 'none',
                boxSizing: 'border-box',
                background: '#080B0D',
                border: '1px solid #1D2327',
                borderRadius: 16,
                outline: 'none',
                padding: 16,
                color: '#FFFFFF',
                fontSize: 16,
                lineHeight: 1.5,
                fontFamily:
                  'inherit',
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                paddingTop: 8,
                color:
                  text.length >= MAX_CHARS
                    ? accentColor
                    : '#69727A',
                fontSize: 12,
              }}
            >
              {text.length}/{MAX_CHARS}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER / SEND */}
      <footer
        style={{
          padding: '14px 20px 20px',
          borderTop: '1px solid #171B1E',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: '#69727A',
            }}
          >
            Sending to{' '}
            <span
              style={{
                color: accentColor,
                fontWeight: 700,
              }}
            >
              {recipientId}
            </span>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem(
                'yeti_onboarding_complete'
              )
              setOnboardingComplete(false)
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#4F585F',
              cursor: 'pointer',
              fontSize: 11,
              padding: 4,
            }}
          >
            Change YETI
          </button>
        </div>

        <button
          onClick={handleSend}
          disabled={isSending || !canSend}
          style={{
            width: '100%',
            height: 50,
            borderRadius: 14,
            border: 'none',
            background:
              isSending || !canSend
                ? '#1A1F22'
                : accentColor,
            color:
              isSending || !canSend
                ? '#5A636A'
                : '#050708',
            cursor:
              isSending || !canSend
                ? 'default'
                : 'pointer',
            fontSize: 14,
            fontWeight: 800,
            transition:
              'background 0.15s ease, opacity 0.15s ease',
          }}
        >
          {sent
            ? `✓ Sent to ${recipientId}`
            : isSending
              ? 'Sending…'
              : `Send to ${recipientId} →`}
        </button>
      </footer>
    </div>
  )
}