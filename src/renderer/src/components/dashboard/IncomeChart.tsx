import { Button } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
import type { MonthlyIncome } from '../../../../shared/types'
import { formatMoney, formatMoneyCompact } from '../../lib/format'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const SERIES = [
  { key: 'expected', label: 'Created', description: 'billed on work orders created that month', color: 'var(--series-1)' },
  { key: 'actual', label: 'Completed', description: 'billed on work orders completed that month', color: 'var(--series-2)' }
] as const

const PLOT_HEIGHT = 240
const AXIS_BAND = 28
const Y_AXIS_WIDTH = 52
const MAX_BAR = 24
const BAR_GAP = 2
const RADIUS = 4
const TOOLTIP_WIDTH = 200

/** A round step that gives about four gridlines: 1, 2, 2.5, or 5 times a power of ten. */
function niceStep(max: number): number {
  if (max <= 0) return 100
  const raw = max / 4
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw)
  return step ?? 10 * power
}

/** A column with a rounded top and a square base. */
function barPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(RADIUS, width / 2, height)
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

interface Props {
  year: number
  months: MonthlyIncome[]
  /** True while a different year loads: the previous chart stays up, dimmed. */
  isRefreshing: boolean
}

/**
 * Total billed per month: work orders counted by the month they were created (expected) beside the
 * month they were completed (actual). Grouped columns on one axis, with a hover/focus readout and a table view.
 */
export default function IncomeChart({ year, months, isRefreshing }: Props): React.ReactElement {
  const [containerRef, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  const totals = { expected: months.reduce((s, m) => s + m.expected, 0), actual: months.reduce((s, m) => s + m.actual, 0) }
  const max = Math.max(0, ...months.flatMap((m) => [m.expected, m.actual]))
  const step = niceStep(max)
  const top = Math.max(step, Math.ceil(max / step) * step)
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const plotWidth = Math.max(0, width - Y_AXIS_WIDTH)
  const band = plotWidth / 12
  const barWidth = Math.max(4, Math.min(MAX_BAR, (band * 0.7 - BAR_GAP) / 2))
  const y = (value: number): number => PLOT_HEIGHT - (value / top) * PLOT_HEIGHT
  const isEmpty = max === 0
  const activeMonth = active === null ? null : months[active]

  return (
    <div className="viz flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-sm" style={{ background: s.color }} />
            <span className="font-medium">{s.label}</span>
            <span className="text-muted">
              {formatMoney(totals[s.key])} in {year}
            </span>
          </div>
        ))}
        <Button size="sm" variant="ghost" className="ml-auto" onPress={() => setShowTable((v) => !v)}>
          {showTable ? 'Show chart' : 'Show table'}
        </Button>
      </div>

      {showTable ? (
        <table className="w-full text-sm">
          <caption className="sr-only">Total billed per month in {year}, by created and completed date</caption>
          <thead>
            <tr className="border-b border-separator text-left text-muted">
              <th className="py-1.5 font-normal">Month</th>
              {SERIES.map((s) => (
                <th key={s.key} className="py-1.5 text-end font-normal">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {months.map((m) => (
              <tr key={m.month} className="border-b border-separator/60">
                <td className="py-1.5">{MONTH_NAMES[m.month - 1]}</td>
                <td className="py-1.5 text-end">{formatMoney(m.expected)}</td>
                <td className="py-1.5 text-end">{formatMoney(m.actual)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1.5">Total</td>
              <td className="py-1.5 text-end">{formatMoney(totals.expected)}</td>
              <td className="py-1.5 text-end">{formatMoney(totals.actual)}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div ref={containerRef} className={`relative transition-opacity ${isRefreshing ? 'opacity-50' : ''}`} style={{ height: PLOT_HEIGHT + AXIS_BAND }}>
          {width > 0 && (
            <svg width={width} height={PLOT_HEIGHT + AXIS_BAND} role="group" aria-label={`Total billed per month in ${year}`} className="overflow-visible">
              {/* Gridlines and y-axis ticks */}
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={Y_AXIS_WIDTH} x2={width} y1={y(t)} y2={y(t)} stroke="var(--separator)" strokeWidth={1} shapeRendering="crispEdges" />
                  <text x={Y_AXIS_WIDTH - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-xs tabular-nums">
                    {formatMoneyCompact(t)}
                  </text>
                </g>
              ))}
              {months.map((m, i) => {
                const x0 = Y_AXIS_WIDTH + i * band
                const pairWidth = barWidth * 2 + BAR_GAP
                const left = x0 + (band - pairWidth) / 2
                const label = `${MONTH_NAMES[i]} ${year}: created ${formatMoney(m.expected)}, completed ${formatMoney(m.actual)}`
                return (
                  <g key={m.month}>
                    {/* The whole month band is the hover/focus target, not just the bars. */}
                    <rect
                      x={x0}
                      y={0}
                      width={band}
                      height={PLOT_HEIGHT}
                      fill={active === i ? 'var(--default)' : 'transparent'}
                      fillOpacity={0.5}
                      tabIndex={0}
                      role="img"
                      aria-label={label}
                      className="outline-none focus-visible:stroke-[var(--focus)]"
                      onPointerEnter={() => setActive(i)}
                      onPointerLeave={() => setActive(null)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(null)}
                    />
                    {SERIES.map((s, si) => {
                      const value = m[s.key]
                      if (value <= 0) return null
                      const h = PLOT_HEIGHT - y(value)
                      return <path key={s.key} d={barPath(left + si * (barWidth + BAR_GAP), y(value), barWidth, h)} fill={s.color} pointerEvents="none" />
                    })}
                    <text x={x0 + band / 2} y={PLOT_HEIGHT + 18} textAnchor="middle" className="fill-muted text-xs">
                      {MONTHS[i]}
                    </text>
                  </g>
                )
              })}
              {/* Baseline */}
              <line x1={Y_AXIS_WIDTH} x2={width} y1={PLOT_HEIGHT} y2={PLOT_HEIGHT} stroke="var(--border)" strokeWidth={1} shapeRendering="crispEdges" />
            </svg>
          )}
          {isEmpty && width > 0 && <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-muted">No work orders billed in {year}.</p>}
          {activeMonth && active !== null && (
            <div
              role="presentation"
              className="pointer-events-none absolute z-10 rounded-xl bg-overlay p-3 text-sm shadow-lg"
              // Beside the hovered month (never over its bars): to the right, or to the left near the edge.
              style={
                Y_AXIS_WIDTH + (active + 1) * band + TOOLTIP_WIDTH + 8 <= width
                  ? { left: Y_AXIS_WIDTH + (active + 1) * band + 8, top: 0, width: TOOLTIP_WIDTH }
                  : { left: Math.max(0, Y_AXIS_WIDTH + active * band - TOOLTIP_WIDTH - 8), top: 0, width: TOOLTIP_WIDTH }
              }
            >
              <p className="mb-1.5 text-xs text-muted">
                {MONTH_NAMES[active]} {year}
              </p>
              {SERIES.map((s) => (
                <div key={s.key} className="flex items-center gap-2 whitespace-nowrap">
                  <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="font-semibold tabular-nums">{formatMoney(activeMonth[s.key])}</span>
                  <span className="text-muted">{s.label.toLowerCase()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-muted">
        Created: total {SERIES[0].description}. Completed: total {SERIES[1].description}.
      </p>
    </div>
  )
}
