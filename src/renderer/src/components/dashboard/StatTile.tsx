import type { ReactNode } from 'react'

interface Props {
  label: string
  value: string
  /** A short line under the value, e.g. a change vs. last month. */
  detail?: ReactNode
}

/** One headline number. */
export default function StatTile({ label, value, detail }: Props): React.ReactElement {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-3xl font-semibold">{value}</p>
      {detail && <p className="text-xs text-muted">{detail}</p>}
    </div>
  )
}
