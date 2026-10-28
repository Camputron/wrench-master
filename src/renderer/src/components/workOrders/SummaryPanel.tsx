import { Button, Separator } from '@heroui/react'
import { balance, bill, laborsSubtotal, partsSubtotal, subtotal, tax, totalPayments } from '../../../../shared/billing'
import type { WorkOrder } from '../../../../shared/types'
import { formatMoney, todayIso } from '../../lib/format'
import { DateInput, NumberInput } from '../fields/Fields'

interface Props {
  workOrder: WorkOrder
  onChange: (update: (wo: WorkOrder) => WorkOrder) => void
  dateError: string | null
}

/** A label and amount in a totals list. */
export function TotalRow({ label, value, strong, subtract }: { label: string; value: number; strong?: boolean; subtract?: boolean }): React.ReactElement {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'font-semibold' : 'text-sm'}`}>
      <dt className={strong ? undefined : 'text-muted'}>{label}</dt>
      <dd className="tabular-nums">
        {subtract && value > 0 ? '−' : ''}
        {formatMoney(value)}
      </dd>
    </div>
  )
}

/** Work order number, dates, tax rate, and running totals. */
export default function SummaryPanel({ workOrder: wo, onChange, dateError }: Props): React.ReactElement {
  const due = balance(wo)
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-surface p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">Work order #</span>
          <span className="font-semibold tabular-nums">{wo.id > 0 ? wo.id : <span className="text-sm font-normal text-muted">Assigned when saved</span>}</span>
        </div>
        <DateInput label="Created" value={wo.dateCreated} onChange={(d) => d && onChange((w) => ({ ...w, dateCreated: d }))} />
        <div className="flex flex-col gap-1">
          <DateInput label="Completed" value={wo.dateCompleted} onChange={(d) => onChange((w) => ({ ...w, dateCompleted: d }))} error={dateError} />
          {wo.dateCompleted ? (
            <Button size="sm" variant="ghost" className="self-start" onPress={() => onChange((w) => ({ ...w, dateCompleted: null }))}>
              Mark as not completed
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="self-start" onPress={() => onChange((w) => ({ ...w, dateCompleted: todayIso() }))}>
              Mark completed today
            </Button>
          )}
        </div>
        <NumberInput label="Sales tax" value={wo.taxRate} onChange={(taxRate) => onChange((w) => ({ ...w, taxRate }))} formatOptions={{ style: 'percent', maximumFractionDigits: 3 }} maxValue={0.99} step={0.00125} />
      </div>
      <Separator />
      <dl className="flex flex-col gap-1.5">
        <TotalRow label="Parts" value={partsSubtotal(wo)} />
        <TotalRow label="Labor" value={laborsSubtotal(wo)} />
        <TotalRow label="Subtotal" value={subtotal(wo)} />
        <TotalRow label="Tax" value={tax(wo)} />
        <TotalRow label="Total" value={bill(wo)} strong />
        <TotalRow label="Payments" value={totalPayments(wo)} subtract />
        <div className={`flex justify-between gap-4 text-lg font-semibold ${due > 0.004 ? 'text-warning' : 'text-success'}`}>
          <dt>{due < -0.004 ? 'Overpaid' : 'Balance due'}</dt>
          <dd className="tabular-nums">{formatMoney(Math.abs(due) < 0.005 ? 0 : Math.abs(due))}</dd>
        </div>
      </dl>
    </div>
  )
}
