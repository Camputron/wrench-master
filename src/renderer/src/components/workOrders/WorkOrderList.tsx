import { ArrowRotateLeft, Ban, FileText, Magnifier, Plus, TrashBin } from '@gravity-ui/icons'
import { Button, EmptyState, InputGroup, Label, ListBox, Select, Spinner, Table, toast } from '@heroui/react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { memo, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
import { balance } from '../../../../shared/billing'
import type { DateFilter, WorkOrder, WorkOrderFilter } from '../../../../shared/types'
import { useEditors } from '../../editors/editorsContext'
import { keyFor } from '../../editors/editorsReducer'
import { useSetVoided } from '../../editors/useSetVoided'
import { useDebounced } from '../../hooks/useDebounced'
import { usePagedLimit } from '../../hooks/usePagedLimit'
import { customerName, formatDate, formatMoney, todayIso, vehicleName, workOrderTotal } from '../../lib/format'
import { keys } from '../../lib/queryClient'
import ConfirmDialog from '../ConfirmDialog'
import { DateInput } from '../fields/Fields'
import StatusChip from './StatusChip'

/** Rows rendered at first; more load as the list is scrolled. Each row is costly to render, so keep this modest. */
const PAGE_SIZE = 50
const NO_WORK_ORDERS: WorkOrder[] = []

type Status = 'all' | 'open' | 'completed' | 'voided'
type DateMode = 'any' | DateFilter['mode']

const STATUSES: { id: Status; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'completed', label: 'Completed' },
  { id: 'voided', label: 'Voided' }
]
const DATE_MODES: { id: DateMode; label: string }[] = [
  { id: 'any', label: 'Any date' },
  { id: 'exactly', label: 'Created on' },
  { id: 'before', label: 'Created on or before' },
  { id: 'after', label: 'Created on or after' },
  { id: 'between', label: 'Created between' }
]

function SelectField<K extends string>({ label, value, options, onChange, className }: { label: string; value: K; options: { id: K; label: string }[]; onChange: (v: K) => void; className?: string }): React.ReactElement {
  return (
    <Select className={className} value={value} onChange={(k) => k !== null && onChange(k as K)}>
      <Label className="sr-only">{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

function buildDateFilter(mode: DateMode, from: string | null, to: string | null): DateFilter | undefined {
  if (mode === 'any' || !from) return undefined
  if (mode === 'between') return to ? { mode, from: from <= to ? from : to, to: from <= to ? to : from } : undefined
  return { mode, date: from }
}

interface TableProps {
  workOrders: WorkOrder[]
  isPending: boolean
  filtered: boolean
  /** More rows match than are shown. */
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  onOpen: (id: number) => void
  /** Deletes the work order, or voids it if it has payments (after asking). */
  onRemove: (wo: WorkOrder) => void
  onRestore: (wo: WorkOrder) => void
}

/**
 * The results table. Memoized because it's the slow part: re-rendering every row on each keystroke in
 * the search field (or each change in an open editor) made the app feel sluggish.
 */
const WorkOrderTable = memo(function WorkOrderTable({ workOrders, isPending, filtered, hasMore, isLoadingMore, onLoadMore, onOpen, onRemove, onRestore }: TableProps): React.ReactElement {
  return (
    <Table className="min-h-0 flex-1">
      <Table.ScrollContainer className="h-full overflow-y-auto">
        <Table.Content aria-label="Work orders" onRowAction={(key) => void onOpen(Number(key))}>
          <Table.Header className="sticky top-0 z-10 bg-surface">
            <Table.Column isRowHeader>#</Table.Column>
            <Table.Column>Created</Table.Column>
            <Table.Column>Customer</Table.Column>
            <Table.Column>Vehicle</Table.Column>
            <Table.Column className="text-end">Total</Table.Column>
            <Table.Column className="text-end">Balance</Table.Column>
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
                  'No work orders match these filters.'
                ) : (
                  <>
                    <FileText className="size-6" />
                    No work orders yet. Start one with New work order.
                  </>
                )}
              </EmptyState>
            )}
          >
            <Table.Collection items={workOrders}>
              {(wo) => {
                const due = balance(wo)
                return (
                  <Table.Row id={wo.id} className="cursor-default">
                    <Table.Cell className="tabular-nums">{wo.id}</Table.Cell>
                    <Table.Cell className="whitespace-nowrap tabular-nums">{formatDate(wo.dateCreated)}</Table.Cell>
                    <Table.Cell>
                      <div>{customerName(wo.customer)}</div>
                      {wo.customer.company && (wo.customer.firstName || wo.customer.lastName) && <div className="text-xs text-muted">{wo.customer.company}</div>}
                    </Table.Cell>
                    <Table.Cell>
                      <div>{vehicleName(wo.vehicle)}</div>
                      {wo.vehicle.licensePlate && <div className="font-mono text-xs text-muted">{wo.vehicle.licensePlate}</div>}
                    </Table.Cell>
                    <Table.Cell className="text-end tabular-nums">{workOrderTotal(wo)}</Table.Cell>
                    {wo.dateVoided ? <Table.Cell className="text-end text-muted">—</Table.Cell> : <Table.Cell className={`text-end tabular-nums ${due > 0.004 ? 'text-warning' : 'text-muted'}`}>{formatMoney(Math.abs(due) < 0.005 ? 0 : due)}</Table.Cell>}
                    <Table.Cell>
                      <StatusChip workOrder={wo} />
                    </Table.Cell>
                    <Table.Cell>
                      {wo.dateVoided ? (
                        <Button size="sm" variant="ghost" isIconOnly aria-label={`Restore work order #${wo.id}`} onPress={() => onRestore(wo)}>
                          <ArrowRotateLeft className="size-4" />
                        </Button>
                      ) : wo.payments.length > 0 ? (
                        <Button size="sm" variant="ghost" isIconOnly aria-label={`Void work order #${wo.id}`} onPress={() => onRemove(wo)}>
                          <Ban className="size-4 text-danger" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" isIconOnly aria-label={`Delete work order #${wo.id}`} onPress={() => onRemove(wo)}>
                          <TrashBin className="size-4 text-danger" />
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                )
              }}
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

/** All work orders, with search and filters. Double-click (or Enter) opens one. */
export default function WorkOrderList(): React.ReactElement {
  const queryClient = useQueryClient()
  const { openWorkOrder, newWorkOrder, editors, close } = useEditors()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [dateMode, setDateMode] = useState<DateMode>('any')
  const [from, setFrom] = useState<string | null>(todayIso)
  const [to, setTo] = useState<string | null>(todayIso)
  const [toRemove, setToRemove] = useState<WorkOrder | null>(null)
  const setVoided = useSetVoided()
  // Stable for the memoized table, while always calling the latest setVoided.
  const setVoidedRef = useRef(setVoided)
  useEffect(() => {
    setVoidedRef.current = setVoided
  })
  const restore = useCallback((wo: WorkOrder) => void setVoidedRef.current(wo, false), [])
  const text = useDebounced(search.trim(), 200)

  const criteria: Omit<WorkOrderFilter, 'limit'> = { text, status: status === 'all' ? undefined : status, date: buildDateFilter(dateMode, from, to) }
  const [limit, loadMore] = usePagedLimit(JSON.stringify(criteria), PAGE_SIZE)
  const filter: WorkOrderFilter = { ...criteria, limit }
  const workOrders = useQuery({ queryKey: [...keys.workOrders, 'list', filter], queryFn: () => window.api.workOrders.filter(filter), placeholderData: keepPreviousData })
  // While the next page loads, the previous (shorter) page is still shown, so this stays false until it arrives.
  const hasMore = (workOrders.data?.length ?? 0) >= limit
  // Deferred so the table re-renders in the background and typing in the search field never waits for it.
  const results = useDeferredValue(workOrders.data ?? NO_WORK_ORDERS)
  const filtered = !!(text || filter.status || filter.date)

  const deleteWorkOrder = async (wo: WorkOrder): Promise<void> => {
    await window.api.workOrders.delete(wo.id)
    // Its editor (if open) would otherwise save it back.
    if (editors.some((e) => e.key === keyFor(wo.id))) close(keyFor(wo.id))
    await queryClient.invalidateQueries({ queryKey: keys.workOrders })
    toast.success(`Deleted work order #${wo.id}`)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="min-w-64 flex-1">
          <InputGroup.Prefix>
            <Magnifier className="size-4 text-muted" />
          </InputGroup.Prefix>
          <InputGroup.Input aria-label="Search work orders" placeholder="Search by #, customer, company, vehicle, plate, or VIN" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </InputGroup>
        <SelectField className="w-36" label="Status" value={status} options={STATUSES} onChange={setStatus} />
        <SelectField className="w-52" label="Date" value={dateMode} options={DATE_MODES} onChange={setDateMode} />
        {dateMode !== 'any' && <DateInput className="w-40" hideLabel label={dateMode === 'between' ? 'From date' : 'Date'} value={from} onChange={setFrom} />}
        {dateMode === 'between' && <DateInput className="w-40" hideLabel label="To date" value={to} onChange={setTo} />}
        <Button onPress={() => newWorkOrder()}>
          <Plus className="size-4" />
          New work order
        </Button>
      </div>

      <WorkOrderTable workOrders={results} isPending={workOrders.isPending} filtered={filtered} hasMore={hasMore} isLoadingMore={workOrders.isFetching} onLoadMore={loadMore} onOpen={openWorkOrder} onRemove={setToRemove} onRestore={restore} />

      {toRemove &&
        (toRemove.payments.length > 0 ? (
          <ConfirmDialog isOpen onOpenChange={(open) => !open && setToRemove(null)} title={`Void work order #${toRemove.id}?`} confirmLabel="Void work order" onConfirm={() => setVoided(toRemove, true)}>
            <p>
              {customerName(toRemove.customer)} · {vehicleName(toRemove.vehicle)} · {workOrderTotal(toRemove)}
            </p>
            <p>It has payments, so it’s voided rather than deleted. It stays in your records and Excel exports, marked void, but it’s left out of totals and the dashboard. You can restore it later.</p>
          </ConfirmDialog>
        ) : (
          <ConfirmDialog isOpen onOpenChange={(open) => !open && setToRemove(null)} title={`Delete work order #${toRemove.id}?`} confirmLabel="Delete work order" onConfirm={() => deleteWorkOrder(toRemove)}>
            <p>
              {customerName(toRemove.customer)} · {vehicleName(toRemove.vehicle)} · {workOrderTotal(toRemove)}
            </p>
            <p>Its parts and labor are deleted too. This can’t be undone.</p>
          </ConfirmDialog>
        ))}
    </div>
  )
}
