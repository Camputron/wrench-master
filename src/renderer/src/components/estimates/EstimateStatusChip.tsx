import { Chip } from '@heroui/react'
import { isExpired } from '../../../../shared/estimates'
import type { Estimate } from '../../../../shared/types'
import { formatDate, todayIso } from '../../lib/format'

/** Open (or Expired, once past its valid-until date), Accepted, or Declined. */
export default function EstimateStatusChip({ estimate: e }: { estimate: Pick<Estimate, 'status' | 'validUntil'> }): React.ReactElement {
  if (e.status === 'accepted')
    return (
      <Chip size="sm" variant="soft" color="success">
        Accepted
      </Chip>
    )
  if (e.status === 'declined')
    return (
      <Chip size="sm" variant="soft" color="danger">
        Declined
      </Chip>
    )
  if (isExpired(e, todayIso()))
    return (
      <Chip size="sm" variant="soft" color="warning" aria-label={`Expired ${formatDate(e.validUntil)}`}>
        Expired
      </Chip>
    )
  return (
    <Chip size="sm" variant="soft" color="accent">
      Open
    </Chip>
  )
}
