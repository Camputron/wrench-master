import { FileText, Magnifier, Plus, TrashBin } from '@gravity-ui/icons'
import { Button, EmptyState, InputGroup, Label, ListBox, Select, Spinner, Table, toast } from '@heroui/react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { memo, useDeferredValue, useState } from 'react'
import { bill } from '../../../../shared/billing'
import { estimateNumber } from '../../../../shared/estimates'
import type { Estimate, EstimateFilter } from '../../../../shared/types'
import { useEstimateEditors } from '../../editors/editorsContext'
import { useDebounced } from '../../hooks/useDebounced'
import { usePagedLimit } from '../../hooks/usePagedLimit'
import { customerName, formatDate, formatMoney, vehicleName } from '../../lib/format'
import { keys } from '../../lib/queryClient'
import ConfirmDialog from '../ConfirmDialog'
import EstimateStatusChip from './EstimateStatusChip'

/** Rows rendered at first; more load as the list is scrolled. */
const PAGE_SIZE = 50
const NO_ESTIMATES: Estimate[] = []

type Status = 'all' | NonNullable<EstimateFilter['status']>

const STATUSES: { id: Status; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'expired', label: 'Expired' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'declined', label: 'Declined' }
]

interface TableProps {
  estimates: Estimate[]
  isPending: boolean
  filtered: boolean
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  onOpen: (id: number) => void
  onDelete: (e: Estimate) => void
}

/** The results table, memoized so typing in the search field doesn't re-render every row. */
const EstimateTable = memo(function EstimateTable({ estimates, isPending, filtered, hasMore, isLoadingMore, onLoadMore, onOpen, onDelete }: TableProps): React.ReactElement {
  return (
    <Table className="min-h-0 flex-1">
      <Table.ScrollContainer className="h-full overflow-y-auto">
        <Table.Content aria-label="Estimates" onRowAction={(key) => void onOpen(Number(key))}>
          <Table.Header className="sticky top-0 z-10 bg-surface">
            <Table.Column isRowHeader>#</Table.Column>
            <Table.Column>Date</Table.Column>
            <Table.Column>Customer</Table.Column>
            <Table.Column>Vehicle</Table.Column>
            <Table.Column className="text-end">Total</Table.Column>
            <Table.Column>Valid until</Table.Column>
            <Table.Column>Status</Table.Column>
            <Table.Column className="w-0">
              <span className="sr-only">Actions</span>
            </Table.Column>
          </Table.Header>
          <Table.Body
            renderEmptyState={() => (
              <EmptyState className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted">
                {isPending ? (
                  <Spinner />
                ) : filtered ? (
                  'No estimates match these filters.'
                ) : (
                  <>
                    <FileText className="size-6" />
                    No estimates yet. Start one with New estimate.
                  </>
                )}
              </EmptyState>
            )}
          >
            <Table.Collection items={estimates}>
              {(e) => (
                <Table.Row id={e.id} className="cursor-default">
                  <Table.Cell className="whitespace-nowrap tabular-nums">{estimateNumber(e.id)}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap tabular-nums">{formatDate(e.dateCreated)}</Table.Cell>
                  <Table.Cell>
                    <div>{customerName(e.customer)}</div>
                    {e.customer.company && (e.customer.firstName || e.customer.lastName) && <div className="text-xs text-muted">{e.customer.company}</div>}
                  </Table.Cell>
                  <Table.Cell>
                    <div>{vehicleName(e.vehicle)}</div>
                    {e.vehicle.licensePlate && <div className="font-mono text-xs text-muted">{e.vehicle.licensePlate}</div>}
                  </Table.Cell>
                  <Table.Cell className="text-end tabular-nums">{formatMoney(bill(e))}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap tabular-nums">{formatDate(e.validUntil)}</Table.Cell>
                  <Table.Cell>
                    <EstimateStatusChip estimate={e} />
                    {e.workOrderId && <div className="mt-0.5 text-xs text-muted">Work order #{e.workOrderId}</div>}
                  </Table.Cell>
                  <Table.Cell>
                    {e.status !== 'accepted' && (
                      <Button size="sm" variant="ghost" isIconOnly aria-label={`Delete estimate ${estimateNumber(e.id)}`} onPress={() => onDelete(e)}>
                        <TrashBin className="size-4 text-danger" />
                      </Button>
                    )}
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Collection>
            {hasMore && (
              <Table.LoadMore onLoadMore={onLoadMore} isLoading={isLoadingMore}>
                <Table.LoadMoreContent>
                  <Spinner size="sm" />
                </Table.LoadMoreContent>
              </Table.LoadMore>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  )
})

/** All estimates, with search and a status filter. Double-click (or Enter) opens one. */
export default function EstimateList(): React.ReactElement {
  const queryClient = useQueryClient()
  const { openEstimate, newEstimate, editors, close, keyFor } = useEstimateEditors()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [toDelete, setToDelete] = useState<Estimate | null>(null)
  const text = useDebounced(search.trim(), 200)

  const criteria: Omit<EstimateFilter, 'limit'> = { text, status: status === 'all' ? undefined : status }
  const [limit, loadMore] = usePagedLimit(JSON.stringify(criteria), PAGE_SIZE)
  const filter: EstimateFilter = { ...criteria, limit }
  const estimates = useQuery({ queryKey: [...keys.estimates, 'list', filter], queryFn: () => window.api.estimates.filter(filter), placeholderData: keepPreviousData })
  // While the next page loads, the previous (shorter) page is still shown, so this stays false until it arrives.
  const hasMore = (estimates.data?.length ?? 0) >= limit
  // Deferred so the table re-renders in the background and typing in the search field never waits for it.
  const results = useDeferredValue(estimates.data ?? NO_ESTIMATES)

  const deleteEstimate = async (e: Estimate): Promise<void> => {
    await window.api.estimates.delete(e.id)
    // Its editor (if open) would otherwise save it back.
    if (editors.some((x) => x.key === keyFor(e.id))) close(keyFor(e.id))
    await queryClient.invalidateQueries({ queryKey: keys.estimates })
    toast.success(`Deleted estimate ${estimateNumber(e.id)}`)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="min-w-64 flex-1">
          <InputGroup.Prefix>
            <Magnifier className="size-4 text-muted" />
          </InputGroup.Prefix>
          <InputGroup.Input aria-label="Search estimates" placeholder="Search by #, customer, company, vehicle, plate, or VIN" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </InputGroup>
        <Select className="w-36" value={status} onChange={(k) => k !== null && setStatus(k as Status)}>
          <Label className="sr-only">Status</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {STATUSES.map((o) => (
                <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                  {o.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Button onPress={() => newEstimate()}>
          <Plus className="size-4" />
          New estimate
        </Button>
      </div>

      <EstimateTable estimates={results} isPending={estimates.isPending} filtered={!!(text || criteria.status)} hasMore={hasMore} isLoadingMore={estimates.isFetching} onLoadMore={loadMore} onOpen={openEstimate} onDelete={setToDelete} />

      {toDelete && (
        <ConfirmDialog isOpen onOpenChange={(open) => !open && setToDelete(null)} title={`Delete estimate ${estimateNumber(toDelete.id)}?`} confirmLabel="Delete estimate" onConfirm={() => deleteEstimate(toDelete)}>
          <p>
            {customerName(toDelete.customer)} · {vehicleName(toDelete.vehicle)} · {formatMoney(bill(toDelete))}
          </p>
          <p>This can’t be undone.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
