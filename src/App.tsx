import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://kapioajfhqnowgzzxros.supabase.co',
  'sb_publishable_kw0OAGWVnOxigswKa-_o5g_4Dg4pWHW'
)

type Mode = 'text' | 'doodle'
type YetiId = 'YETI_A' | 'YETI_B'

const SWATCHES = ['#00E5CC', '#FFFFFF', '#FF4D6D', '#FFD166', '#74C0FC']
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
  const [mode, setMode] = useState<Mode>('text')
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  const [recipientId, setRecipientId] = useState<YetiId>(() => {
    const saved = localStorage.getItem('yeti_id')
    return saved === 'YETI_B' ? 'YETI_B' : 'YETI_A'
  })

  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    return localStorage.getItem('yeti_onboarding_complete') === 'true'
  })

  useEffect(() => {
    document.title = 'Yeti Messenger'
  }, [])

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<DrawPoint[]>([])
  const isDrawing = useRef(false)

  const [strokeColor, setStrokeColor] = useState(SWATCHES[0])
  const [strokeWidth, setStrokeWidth] = useState(3)

  const accentColor =
    recipientId === 'YETI_A'
      ? '#FFD166'
      : '#00E5CC'

  const accentGlow =
    recipientId === 'YETI_A'
      ? 'rgba(255,209,102,0.12)'
      : 'rgba(0,229,204,0.12)'

  const accentBorder =
    recipientId === 'YETI_A'
      ? 'rgba(255,209,102,0.22)'
      : 'rgba(0,229,204,0.22)'

  const accentGradient =
    recipientId === 'YETI_A'
      ? 'linear-gradient(135deg, rgba(255,209,102,0.2) 0%, rgba(255,209,102,0.1) 100%)'
      : 'linear-gradient(135deg, rgba(0,229,204,0.2) 0%, rgba(0,229,204,0.1) 100%)'

  const accentShadow =
    recipientId === 'YETI_A'
      ? '0 4px 24px rgba(255,209,102,0.35), 0 1px 4px rgba(0,0,0,0.4)'
      : '0 4px 24px rgba(0,229,204,0.35), 0 1px 4px rgba(0,0,0,0.4)'

  const redraw = useCallback(
    (strokeList: Stroke[], active: DrawPoint[] = []) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const drawStroke = (
        pts: DrawPoint[],
        color: string,
        width: number
      ) => {
        if (pts.length < 2) return

        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        ctx.moveTo(pts[0].x, pts[0].y)

        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y)
        }

        ctx.stroke()
      }

      strokeList.forEach((s) =>
        drawStroke(s.points, s.color, s.width)
      )

      if (active.length > 1) {
        drawStroke(active, strokeColor, strokeWidth)
      }
    },
    [strokeColor, strokeWidth]
  )

  useEffect(() => {
    redraw(strokes, currentStroke)
  }, [strokes, currentStroke, redraw])

  const getPos = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ): DrawPoint => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()

    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e) {
      return {
        x:
          (e.touches[0].clientX - rect.left) *
          scaleX,
        y:
          (e.touches[0].clientY - rect.top) *
          scaleY,
      }
    }

    return {
      x:
        (e.clientX - rect.left) *
        scaleX,
      y:
        (e.clientY - rect.top) *
        scaleY,
    }
  }

  const startDraw = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault()

    const pt = getPos(e)

    isDrawing.current = true
    setCurrentStroke([pt])
  }

  const moveDraw = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault()

    if (!isDrawing.current) return

    const pt = getPos(e)

    setCurrentStroke((prev) => [...prev, pt])
  }

  const endDraw = () => {
    if (!isDrawing.current) return

    isDrawing.current = false

    if (currentStroke.length > 1) {
      setStrokes((prev) => [
        ...prev,
        {
          points: currentStroke,
          color: strokeColor,
          width: strokeWidth,
        },
      ])
    }

    setCurrentStroke([])
  }

  const handleClear = () => {
    setStrokes([])
    setCurrentStroke([])
  }

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1))
  }

  const handleSelectYeti = (yeti: YetiId) => {
    setRecipientId(yeti)

    localStorage.setItem('yeti_id', yeti)
    localStorage.setItem('yeti_onboarding_complete', 'true')

    setStrokeColor(
      yeti === 'YETI_A'
        ? '#FFD166'
        : '#00E5CC'
    )

    setOnboardingComplete(true)
  }

  const canSend =
    mode === 'text'
      ? text.trim().length > 0
      : strokes.length > 0

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
      console.error('Send error:', error)
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

  if (!onboardingComplete) {
    return (
      <div
        style={{
          width: '100%',
          height: '100dvh',
          minHeight: '100px',
          marginLeft: '6px',
          marginRight: '6px',
          background:
            'linear-gradient(160deg, #0D0F13 0%, #08090B 60%)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '16px',
          boxSizing: 'border-box',
          color: '#fff',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -80,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 260,
            height: 260,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(0,229,204,0.09) 0%, rgba(0,0,0,0) 70%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
          }}
        >
          <div
            style={{
              marginBottom: 10,
              fontSize: 12,
              color: 'rgba(255,255,255,0.35)',
              letterSpacing: '1.4px',
              textTransform: 'uppercase',
            }}
          >
            Yeti V1.0
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 34,
              lineHeight: 1.05,
              fontWeight: 500,
              letterSpacing: '-1.4px',
            }}
          >
            Choose your Yeti
          </h1>

          <p
            style={{
              margin: '12px 0 28px',
              maxWidth: 300,
              fontSize: 14,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.42)',
            }}
          >
            This phone will send messages and doodles to the Yeti you select.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Yeti B — Cyan */}
            <button
              onClick={() => handleSelectYeti('YETI_B')}
              style={{
                width: '100%',
                minHeight: 76,
                borderRadius: 18,
                border: '1px solid rgba(0,229,204,0.22)',
                background:
                  'linear-gradient(135deg, rgba(0,229,204,0.2) 0%, rgba(0,229,204,0.08) 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 20px',
                cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif',
                textAlign: 'left',
                boxShadow:
                  '0 4px 24px rgba(0,229,204,0.12), 0 1px 4px rgba(0,0,0,0.4)',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 500,
                    marginBottom: 5,
                  }}
                >
                  Yeti B
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.35)',
                    letterSpacing: '0.4px',
                  }}
                >
                  Cyan
                </div>
              </div>

              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#00E5CC',
                  boxShadow:
                    '0 0 18px rgba(0,229,204,0.45)',
                }}
              />
            </button>

            {/* Yeti A — Yellow */}
            <button
              onClick={() => handleSelectYeti('YETI_A')}
              style={{
                width: '100%',
                minHeight: 76,
                borderRadius: 18,
                border: '1px solid rgba(255,209,102,0.22)',
                background:
                  'linear-gradient(135deg, rgba(255,209,102,0.2) 0%, rgba(255,209,102,0.08) 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 20px',
                cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif',
                textAlign: 'left',
                boxShadow:
                  '0 4px 24px rgba(255,209,102,0.12), 0 1px 4px rgba(0,0,0,0.4)',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 500,
                    marginBottom: 5,
                  }}
                >
                  Yeti A
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.35)',
                    letterSpacing: '0.4px',
                  }}
                >
                  Yellow
                </div>
              </div>

              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#FFD166',
                  boxShadow:
                    '0 0 18px rgba(255,209,102,0.45)',
                }}
              />
            </button>
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            paddingBottom: 4,
            fontSize: 10,
            color: 'rgba(255,255,255,0.18)',
            letterSpacing: '0.4px',
          }}
        >
          Yeti Messenger v1.0
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100dvh',
        minHeight: '100px',
        marginLeft: '6px',
        marginRight: '6px',
        background:
          'linear-gradient(160deg, #0D0F13 0%, #08090B 60%)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px',
        boxSizing: 'border-box',
        color: '#fff',
        fontFamily: 'Outfit, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -80,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 260,
          height: 260,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentGlow} 0%, rgba(0,0,0,0) 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 5,
          }}
        >
          <div
            style={{
              fontSize: 25,
              fontWeight: 500,
              letterSpacing: '-0.8px',
            }}
          >
            Yeti V1.0
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 10px',
              borderRadius: 999,
              background: accentGlow,
              border: `1px solid ${accentBorder}`,
              fontSize: 10,
              color: accentColor,
              letterSpacing: '0.4px',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: accentColor,
                boxShadow: `0 0 10px ${accentColor}`,
              }}
            />
            Connected
          </div>
        </div>

        <div
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.28)',
            letterSpacing: '0.6px',
          }}
        >
          Desktop companion
        </div>
      </div>

      {/* Mode Toggle */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          height: 50,
          marginTop: 16,
          marginBottom: 12,
          padding: 4,
          borderRadius: 15,
          background: 'rgba(255,255,255,0.035)',
          border: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          boxSizing: 'border-box',
        }}
      >
        <button
          onClick={() => setMode('text')}
          style={{
            flex: 1,
            border: 'none',
            borderRadius: 11,
            background:
              mode === 'text'
                ? accentGradient
                : 'transparent',
            color:
              mode === 'text'
                ? '#fff'
                : 'rgba(255,255,255,0.3)',
            fontFamily: 'Outfit, sans-serif',
            fontSize: 12,
            cursor: 'pointer',
            boxShadow:
              mode === 'text'
                ? `inset 0 0 0 1px ${accentBorder}`
                : 'none',
          }}
        >
          Text
        </button>

        <button
          onClick={() => setMode('doodle')}
          style={{
            flex: 1,
            border: 'none',
            borderRadius: 11,
            background:
              mode === 'doodle'
                ? accentGradient
                : 'transparent',
            color:
              mode === 'doodle'
                ? '#fff'
                : 'rgba(255,255,255,0.3)',
            fontFamily: 'Outfit, sans-serif',
            fontSize: 12,
            cursor: 'pointer',
            boxShadow:
              mode === 'doodle'
                ? `inset 0 0 0 1px ${accentBorder}`
                : 'none',
          }}
        >
          Doodle
        </button>
      </div>

      {/* Main Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {mode === 'text' ? (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              borderRadius: 20,
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.07)',
              padding: 16,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <textarea
              value={text}
              onChange={(e) =>
                setText(e.target.value.slice(0, MAX_CHARS))
              }
              placeholder="Write something..."
              style={{
                flex: 1,
                width: '100%',
                resize: 'none',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: '#fff',
                fontFamily: 'Outfit, sans-serif',
                fontSize: 17,
                lineHeight: 1.55,
                boxSizing: 'border-box',
              }}
            />

            <div
              style={{
                textAlign: 'right',
                fontSize: 10,
                color: 'rgba(255,255,255,0.2)',
                marginTop: 8,
              }}
            >
              {text.length}/{MAX_CHARS}
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: CANVAS_WIDTH,
                maxWidth: '100%',
                aspectRatio: '7 / 6',
                borderRadius: 20,
                background: '#08090B',
                border: '1px solid rgba(255,255,255,0.08)',
                overflow: 'hidden',
                position: 'relative',
                touchAction: 'none',
              }}
            >
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  touchAction: 'none',
                }}
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={moveDraw}
                onTouchEnd={endDraw}
              />
            </div>

            {/* Doodle Toolbar */}
            <div
              style={{
                width: '100%',
                marginTop: 12,
                padding: '10px 12px',
                borderRadius: 16,
                background: 'rgba(255,255,255,0.035)',
                border: '1px solid rgba(255,255,255,0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                {SWATCHES.map((color) => (
                  <button
                    key={color}
                    onClick={() => setStrokeColor(color)}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: color,
                      border:
                        strokeColor === color
                          ? '2px solid rgba(255,255,255,0.9)'
                          : '2px solid transparent',
                      boxShadow:
                        strokeColor === color
                          ? `0 0 0 2px rgba(255,255,255,0.08)`
                          : 'none',
                      padding: 0,
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                  />
                ))}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                {[2, 4, 7].map((width) => (
                  <button
                    key={width}
                    onClick={() => setStrokeWidth(width)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      border:
                        strokeWidth === width
                          ? `1px solid ${accentBorder}`
                          : '1px solid transparent',
                      background:
                        strokeWidth === width
                          ? accentGlow
                          : 'transparent',
                      color:
                        strokeWidth === width
                          ? '#fff'
                          : 'rgba(255,255,255,0.3)',
                      fontFamily: 'Outfit, sans-serif',
                      fontSize: 9,
                      cursor: 'pointer',
                    }}
                  >
                    {width}
                  </button>
                ))}
              </div>
            </div>

            {/* Doodle Footer Controls */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 8,
              }}
            >
              <button
                onClick={handleUndo}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.25)',
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: 10,
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                Undo
              </button>

              <button
                onClick={handleClear}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.25)',
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: 10,
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Send Button */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          marginTop: 14,
        }}
      >
        <button
          onClick={handleSend}
          disabled={!canSend || isSending}
          style={{
            width: '100%',
            height: 54,
            borderRadius: 17,
            border: `1px solid ${accentBorder}`,
            background: canSend
              ? accentGradient
              : 'rgba(255,255,255,0.035)',
            color: canSend
              ? '#fff'
              : 'rgba(255,255,255,0.2)',
            fontFamily: 'Outfit, sans-serif',
            fontSize: 13,
            fontWeight: 500,
            cursor:
              canSend && !isSending
                ? 'pointer'
                : 'default',
            boxShadow:
              canSend && !isSending
                ? accentShadow
                : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          {sent
            ? `✓ Sent to ${
                recipientId === 'YETI_A'
                  ? 'Yeti A'
                  : 'Yeti B'
              }`
            : isSending
              ? 'Sending...'
              : 'Send'}
        </button>
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 10,
          paddingBottom: 2,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.18)',
            letterSpacing: '0.4px',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          {recipientId === 'YETI_A'
            ? 'Yeti A'
            : 'Yeti B'}
        </span>

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
            padding: 0,
            color: 'rgba(255,255,255,0.16)',
            fontFamily: 'Outfit, sans-serif',
            fontSize: 10,
            cursor: 'pointer',
            letterSpacing: '0.2px',
          }}
        >
          Change Yeti
        </button>
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          marginTop: 8,
          fontSize: 9,
          color: 'rgba(255,255,255,0.12)',
          letterSpacing: '0.5px',
        }}
      >
        Yeti Messenger v1.0
      </div>
    </div>
  )
}