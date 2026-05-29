import { useCallback, useEffect, useRef, useState } from 'react'

// ─── constants ──────────────────────────────────────────────────────────────
const W = 400
const H = 320
const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

const INITIAL_VIEW = { xMin: -10, xMax: 10, yMin: -8, yMax: 8 }

// ─── types ───────────────────────────────────────────────────────────────────
export interface GraphLine {
  name: string
  x_vals: number[]
  y_vals: (number | null)[]
}

export interface GraphPoint {
  x: number
  y: number
  label: string
}

export interface GraphData {
  lines: GraphLine[]
  solution_points: GraphPoint[]
}

interface View { xMin: number; xMax: number; yMin: number; yMax: number }
interface HoverState { mathX: number; ys: (number | null)[]; pixelX: number; pixelY: number }

// ─── helpers ─────────────────────────────────────────────────────────────────
function interpY(xVals: number[], yVals: (number | null)[], x: number): number | null {
  for (let i = 0; i < xVals.length - 1; i++) {
    if (xVals[i] <= x && x <= xVals[i + 1]) {
      const y0 = yVals[i], y1 = yVals[i + 1]
      if (y0 === null || y1 === null) return null
      const t = (x - xVals[i]) / (xVals[i + 1] - xVals[i])
      return y0 + t * (y1 - y0)
    }
  }
  return null
}

function buildPath(
  xVals: number[], yVals: (number | null)[],
  toX: (x: number) => number, toY: (y: number) => number,
  yMin: number, yMax: number
): string {
  const parts: string[] = []
  let penDown = false
  for (let i = 0; i < xVals.length; i++) {
    const y = yVals[i]
    const ok = y !== null && isFinite(y) && y >= yMin - 2 && y <= yMax + 2
    if (ok) {
      parts.push((penDown ? 'L' : 'M') + toX(xVals[i]).toFixed(1) + ',' + toY(y as number).toFixed(1))
      penDown = true
    } else { penDown = false }
  }
  return parts.join(' ')
}

function tickStep(range: number) {
  const raw = range / 8
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / mag
  if (n < 1.5) return mag
  if (n < 3.5) return 2 * mag
  if (n < 7.5) return 5 * mag
  return 10 * mag
}

function ticks(min: number, max: number): number[] {
  const step = tickStep(max - min)
  const start = Math.ceil(min / step) * step
  const result: number[] = []
  for (let v = start; v <= max + 1e-9; v += step)
    result.push(parseFloat(v.toFixed(10)))
  return result
}

function fmt(v: number) { return v % 1 === 0 ? String(v) : v.toFixed(1) }

// ─── component ───────────────────────────────────────────────────────────────
export default function GraphPanel({ graphData }: { graphData: GraphData }) {
  const { lines, solution_points } = graphData
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>(INITIAL_VIEW)
  const dragRef = useRef<{ px: number; py: number; view: View } | null>(null)
  const [hover, setHover] = useState<HoverState | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Coordinate converters (depend on current view)
  const toSvgX = (mx: number) => (mx - view.xMin) / (view.xMax - view.xMin) * W
  const toSvgY = (my: number) => (1 - (my - view.yMin) / (view.yMax - view.yMin)) * H

  // Wheel zoom — must be non-passive to call preventDefault
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      setView(v => {
        const mx = v.xMin + (px / rect.width)  * (v.xMax - v.xMin)
        const my = v.yMax - (py / rect.height) * (v.yMax - v.yMin)
        const f  = e.deltaY > 0 ? 1.2 : 1 / 1.2
        return {
          xMin: mx - (mx - v.xMin) * f,
          xMax: mx + (v.xMax - mx) * f,
          yMin: my - (my - v.yMin) * f,
          yMax: my + (v.yMax - my) * f,
        }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { px: e.clientX, py: e.clientY, view }
    setIsDragging(true)
    setHover(null)
  }, [view])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = wrapperRef.current!.getBoundingClientRect()

    if (dragRef.current) {
      const d = dragRef.current
      const dx = -(e.clientX - d.px) / rect.width  * (d.view.xMax - d.view.xMin)
      const dy =  (e.clientY - d.py) / rect.height * (d.view.yMax - d.view.yMin)
      setView({
        xMin: d.view.xMin + dx, xMax: d.view.xMax + dx,
        yMin: d.view.yMin + dy, yMax: d.view.yMax + dy,
      })
      return
    }

    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const mathX = view.xMin + (px / rect.width) * (view.xMax - view.xMin)
    const ys = lines.map(l => interpY(l.x_vals, l.y_vals, mathX))
    if (ys.some(y => y !== null)) setHover({ mathX, ys, pixelX: px, pixelY: py })
    else setHover(null)
  }, [view, lines])

  const handleMouseUp = useCallback(() => { dragRef.current = null; setIsDragging(false) }, [])
  const handleMouseLeave = useCallback(() => { dragRef.current = null; setIsDragging(false); setHover(null) }, [])

  const xTicks = ticks(view.xMin, view.xMax)
  const yTicks = ticks(view.yMin, view.yMax)

  return (
    <div className="graph-panel">
      <div className="graph-controls">
        <button className="btn-graph-reset" onClick={() => setView(INITIAL_VIEW)}>リセット</button>
        <span className="graph-hint">スクロール：ズーム　ドラッグ：移動</span>
      </div>

      <div
        ref={wrapperRef}
        className="graph-wrapper"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
          {/* Grid */}
          {xTicks.map(x => (
            <line key={`gx${x}`} x1={toSvgX(x)} y1={0} x2={toSvgX(x)} y2={H}
              stroke={Math.abs(x) < 1e-9 ? '#888' : '#e5e5e5'}
              strokeWidth={Math.abs(x) < 1e-9 ? 1.5 : 0.5} />
          ))}
          {yTicks.map(y => (
            <line key={`gy${y}`} x1={0} y1={toSvgY(y)} x2={W} y2={toSvgY(y)}
              stroke={Math.abs(y) < 1e-9 ? '#888' : '#e5e5e5'}
              strokeWidth={Math.abs(y) < 1e-9 ? 1.5 : 0.5} />
          ))}

          {/* Tick labels */}
          {xTicks.map(x => (
            <text key={`tx${x}`} x={toSvgX(x)} y={Math.min(toSvgY(0) + 14, H - 4)}
              textAnchor="middle" fontSize="10" fill="#999">{fmt(x)}</text>
          ))}
          {yTicks.filter(y => Math.abs(y) > 1e-9).map(y => (
            <text key={`ty${y}`} x={Math.max(toSvgX(0) - 6, 24)} y={toSvgY(y) + 4}
              textAnchor="end" fontSize="10" fill="#999">{fmt(y)}</text>
          ))}

          {/* Curves */}
          {lines.map((line, i) => (
            <path key={i}
              d={buildPath(line.x_vals, line.y_vals, toSvgX, toSvgY, view.yMin, view.yMax)}
              fill="none" stroke={COLORS[i % COLORS.length]}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          ))}

          {/* Solution points */}
          {solution_points.map((pt, i) => (
            <g key={i}>
              <circle cx={toSvgX(pt.x)} cy={toSvgY(pt.y)} r={5} fill="#ef4444" />
              <circle cx={toSvgX(pt.x)} cy={toSvgY(pt.y)} r={5} fill="none" stroke="white" strokeWidth="1.5" />
            </g>
          ))}

          {/* Hover crosshair */}
          {hover && !isDragging && (
            <line x1={toSvgX(hover.mathX)} y1={0} x2={toSvgX(hover.mathX)} y2={H}
              stroke="#aaa" strokeWidth="1" strokeDasharray="3,3" />
          )}
        </svg>

        {/* Tooltip */}
        {hover && !isDragging && (
          <div className="graph-tooltip" style={{
            left: Math.min(hover.pixelX + 12, (wrapperRef.current?.clientWidth ?? 400) - 130),
            top: Math.max(hover.pixelY - 10, 4),
          }}>
            <div className="tooltip-x">x = {hover.mathX.toFixed(2)}</div>
            {hover.ys.map((y, i) => y === null ? null : (
              <div key={i} className="tooltip-y">
                <span className="tooltip-dot" style={{ background: COLORS[i % COLORS.length] }} />
                y = {Math.abs(y) < 1e-10 ? 0 : y % 1 === 0 ? y : y.toFixed(2)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="graph-legend">
        {lines.map((line, i) => (
          <div key={i} className="legend-item">
            <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="legend-name">{line.name}</span>
          </div>
        ))}
        {solution_points.map((pt, i) => (
          <div key={`pt${i}`} className="legend-item">
            <span className="legend-dot" style={{ background: '#ef4444' }} />
            <span className="legend-name">交点 {pt.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
