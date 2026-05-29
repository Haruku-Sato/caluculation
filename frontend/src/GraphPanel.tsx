import { useCallback, useRef, useState } from 'react'

// ─── constants ──────────────────────────────────────────────────────────────
const W = 400      // SVG logical width
const H = 320      // SVG logical height
const X_MIN = -10, X_MAX = 10
const Y_MIN = -8,  Y_MAX = 8
const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

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

// ─── coord helpers ───────────────────────────────────────────────────────────
function toSvgX(mx: number) { return (mx - X_MIN) / (X_MAX - X_MIN) * W }
function toSvgY(my: number) { return (1 - (my - Y_MIN) / (Y_MAX - Y_MIN)) * H }

function lookupY(xVals: number[], yVals: (number | null)[], snapX: number): number | null {
  const idx = xVals.indexOf(snapX)
  return idx === -1 ? null : yVals[idx]
}

function buildPath(xVals: number[], yVals: (number | null)[]): string {
  const parts: string[] = []
  let penDown = false
  for (let i = 0; i < xVals.length; i++) {
    const y = yVals[i]
    const valid = y !== null && isFinite(y) && y >= Y_MIN - 2 && y <= Y_MAX + 2
    if (valid) {
      const sx = toSvgX(xVals[i]).toFixed(1)
      const sy = toSvgY(y as number).toFixed(1)
      parts.push(penDown ? `L${sx},${sy}` : `M${sx},${sy}`)
      penDown = true
    } else {
      penDown = false
    }
  }
  return parts.join(' ')
}

// ─── component ───────────────────────────────────────────────────────────────
interface HoverState {
  snapX: number
  ys: (number | null)[]
  pixelX: number
  pixelY: number
}

export default function GraphPanel({ graphData }: { graphData: GraphData }) {
  const { lines, solution_points } = graphData
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<HoverState | null>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const mathX = X_MIN + (px / rect.width) * (X_MAX - X_MIN)
    const snapX = Math.max(X_MIN, Math.min(X_MAX, Math.round(mathX)))
    const ys = lines.map(line => lookupY(line.x_vals, line.y_vals, snapX))
    setHover({ snapX, ys, pixelX: px, pixelY: py })
  }, [lines])

  const handleMouseLeave = useCallback(() => setHover(null), [])

  // Grid integers
  const xTicks = Array.from({ length: 21 }, (_, i) => X_MIN + i)
  const yTicks = Array.from({ length: 17 }, (_, i) => Y_MIN + i)

  return (
    <div className="graph-panel">
      {/* SVG graph */}
      <div
        ref={wrapperRef}
        className="graph-wrapper"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block' }}
        >
          {/* Grid lines */}
          {xTicks.map(x => (
            <line
              key={`gx${x}`}
              x1={toSvgX(x)} y1={0} x2={toSvgX(x)} y2={H}
              stroke={x === 0 ? '#888' : '#e5e5e5'}
              strokeWidth={x === 0 ? 1.5 : 0.5}
            />
          ))}
          {yTicks.map(y => (
            <line
              key={`gy${y}`}
              x1={0} y1={toSvgY(y)} x2={W} y2={toSvgY(y)}
              stroke={y === 0 ? '#888' : '#e5e5e5'}
              strokeWidth={y === 0 ? 1.5 : 0.5}
            />
          ))}

          {/* Axis tick labels */}
          {xTicks.filter(x => x !== 0 && x % 5 === 0).map(x => (
            <text
              key={`tx${x}`}
              x={toSvgX(x)} y={toSvgY(0) + 14}
              textAnchor="middle" fontSize="10" fill="#999"
            >{x}</text>
          ))}
          {yTicks.filter(y => y !== 0 && y % 4 === 0).map(y => (
            <text
              key={`ty${y}`}
              x={toSvgX(0) - 6} y={toSvgY(y) + 4}
              textAnchor="end" fontSize="10" fill="#999"
            >{y}</text>
          ))}

          {/* Curve lines */}
          {lines.map((line, i) => (
            <path
              key={i}
              d={buildPath(line.x_vals, line.y_vals)}
              fill="none"
              stroke={COLORS[i % COLORS.length]}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Solution points */}
          {solution_points.map((pt, i) => (
            <g key={i}>
              <circle cx={toSvgX(pt.x)} cy={toSvgY(pt.y)} r={5} fill="#ef4444" />
              <circle cx={toSvgX(pt.x)} cy={toSvgY(pt.y)} r={5} fill="none" stroke="white" strokeWidth="1.5" />
            </g>
          ))}

          {/* Hover crosshair */}
          {hover && (
            <>
              <line
                x1={toSvgX(hover.snapX)} y1={0}
                x2={toSvgX(hover.snapX)} y2={H}
                stroke="#aaa" strokeWidth="1" strokeDasharray="3,3"
              />
            </>
          )}
        </svg>

        {/* Hover tooltip */}
        {hover && (
          <div
            className="graph-tooltip"
            style={{
              left: Math.min(hover.pixelX + 12, (wrapperRef.current?.clientWidth ?? 400) - 130),
              top: Math.max(hover.pixelY - 10, 4),
            }}
          >
            <div className="tooltip-x">x = {hover.snapX}</div>
            {hover.ys.map((y, i) =>
              y === null ? null : (
                <div key={i} className="tooltip-y">
                  <span className="tooltip-dot" style={{ background: COLORS[i % COLORS.length] }} />
                  y = {y % 1 === 0 ? y : y.toFixed(2)}
                </div>
              )
            )}
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
