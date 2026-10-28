import { Chip } from '@heroui/react'
import type { WorkOrder } from '../../../../shared/types'
import { formatDate } from '../../lib/format'

interface Props {
  workOrder: Pick<WorkOrder, 'dateCompleted' | 'dateVoided'>
  /** Leave out the date (it's still read out by screen readers). */
  compact?: boolean
}

/** Open, completed, or voided. */
export default function StatusChip({ workOrder: wo, compact = false }: Props): React.ReactElement {
  if (wo.dateVoided) {
    return (
      <Chip size="sm" variant="soft" color="danger" aria-label={compact ? `Voided ${formatDate(wo.dateVoided)}` : undefined}>
        {compact ? 'Voided' : `Voided ${formatDate(wo.dateVoided)}`}
      </Chip>
    )
  }
  if (wo.dateCompleted) {
    return (
      <Chip size="sm" variant="soft" color="success" aria-label={compact ? `Completed ${formatDate(wo.dateCompleted)}` : undefined}>
        {compact ? 'Done' : `Completed ${formatDate(wo.dateCompleted)}`}
      </Chip>
    )
  }
  return (
    <Chip size="sm" variant="soft" color="warning">
      Open
    </Chip>
  )
}
