import { Separator } from '@heroui/react'
import { bill, laborsSubtotal, partsSubtotal, subtotal, tax } from '../../../../shared/billing'
import { estimateNumber } from '../../../../shared/estimates'
import type { Estimate } from '../../../../shared/types'
import { formatMoney } from '../../lib/format'
import { DateInput, NumberInput } from '../fields/Fields'
import { TotalRow } from '../workOrders/SummaryPanel'

interface Props {
  estimate: Estimate
  onChange: (update: (e: Estimate) => Estimate) => void
  dateError: string | null
}

/** Estimate number, dates, tax rate, and the estimated total. */
export default function EstimateSummaryPanel({ estimate: e, onChange, dateError }: Props): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-surface p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">Estimate #</span>
          <span className="font-semibold tabular-nums">{e.id > 0 ? estimateNumber(e.id) : <span className="text-sm font-normal text-muted">Assigned when saved</span>}</span>
        </div>
        <DateInput label="Date" value={e.dateCreated} onChange={(d) => d && onChange((x) => ({ ...x, dateCreated: d }))} />
        <DateInput label="Valid until" value={e.validUntil} onChange={(d) => d && onChange((x) => ({ ...x, validUntil: d }))} error={dateError} />
        <NumberInput label="Sales tax" value={e.taxRate} onChange={(taxRate) => onChange((x) => ({ ...x, taxRate }))} formatOptions={{ style: 'percent', maximumFractionDigits: 3 }} maxValue={0.99} step={0.00125} />
      </div>
      <Separator />
      <dl className="flex flex-col gap-1.5">
        <TotalRow label="Parts" value={partsSubtotal(e)} />
        <TotalRow label="Labor" value={laborsSubtotal(e)} />
        <TotalRow label="Subtotal" value={subtotal(e)} />
        <TotalRow label="Tax" value={tax(e)} />
        <div className="flex justify-between gap-4 text-lg font-semibold">
          <dt>Estimated total</dt>
          <dd className="tabular-nums">{formatMoney(bill(e))}</dd>
        </div>
      </dl>
    </div>
  )
}
