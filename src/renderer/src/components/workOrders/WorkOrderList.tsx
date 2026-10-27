import { FileText, Magnifier, Plus, TrashBin } from '@gravity-ui/icons'
import { Button, Chip, EmptyState, InputGroup, Label, ListBox, Select, Spinner, Table, toast } from '@heroui/react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { balance } from '../../../../shared/billing'
import type { DateFilter, WorkOrder, WorkOrderFilter } from '../../../../shared/types'
import { useEditors } from '../../editors/editorsContext'
import { keyFor } from '../../editors/editorsReducer'
import { useDebounced } from '../../hooks/useDebounced'
import { customerName, formatDate, formatMoney, todayIso, vehicleName, workOrderTotal } from '../../lib/format'
import { keys } from '../../lib/queryClient'
import ConfirmDialog from '../ConfirmDialog'
import { DateInput } from '../fields/Fields'

const LIMIT = 200

type Status = 'all' | 'open' | 'completed'
type DateMode = 'any' | DateFilter['mode']

const STATUSES: { id: Status; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'completed', label: 'Completed' }
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

/** All work orders, with search and filters. Double-click (or Enter) opens one. */
export default function WorkOrderList(): React.ReactElement {
  const queryClient = useQueryClient()
  const { openWorkOrder, newWorkOrder, editors, close } = useEditors()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [dateMode, setDateMode] = useState<DateMode>('any')
  const [from, setFrom] = useState<string | null>(todayIso)
  const [to, setTo] = useState<string | null>(todayIso)
  const [toDelete, setToDelete] = useState<WorkOrder | null>(null)
  const text = useDebounced(search.trim(), 200)

  const filter: WorkOrderFilter = { text, status: status === 'all' ? undefined : status, date: buildDateFilter(dateMode, from, to), limit: LIMIT }
  const workOrders = useQuery({ queryKey: [...keys.workOrders, 'list', filter], queryFn: () => window.api.workOrders.filter(filter), placeholderData: keepPreviousData })
  const results = workOrders.data ?? []
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

      <Table className="min-h-0 flex-1">
        <Table.ScrollContainer className="h-full overflow-y-auto">
          <Table.Content aria-label="Work orders" onRowAction={(key) => void openWorkOrder(Number(key))}>
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
              items={results}
              renderEmptyState={() => (
                <EmptyState className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted">
                  {workOrders.isPending ? (
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
                    <Table.Cell className={`text-end tabular-nums ${due > 0.004 ? 'text-warning' : 'text-muted'}`}>{formatMoney(Math.abs(due) < 0.005 ? 0 : due)}</Table.Cell>
                    <Table.Cell>
                      {wo.dateCompleted ? (
                        <Chip size="sm" variant="soft" color="success">
                          Completed {formatDate(wo.dateCompleted)}
                        </Chip>
                      ) : (
                        <Chip size="sm" variant="soft" color="warning">
                          Open
                        </Chip>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Button size="sm" variant="ghost" isIconOnly aria-label={`Delete work order #${wo.id}`} onPress={() => setToDelete(wo)}>
                        <TrashBin className="size-4 text-danger" />
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                )
              }}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      {results.length >= LIMIT && <p className="text-xs text-muted">Showing the {LIMIT} most recent matches. Narrow the search to find others.</p>}

      {toDelete && (
        <ConfirmDialog isOpen onOpenChange={(open) => !open && setToDelete(null)} title={`Delete work order #${toDelete.id}?`} confirmLabel="Delete work order" onConfirm={() => deleteWorkOrder(toDelete)}>
          <p>
            {customerName(toDelete.customer)} · {vehicleName(toDelete.vehicle)} · {workOrderTotal(toDelete)}
          </p>
          <p>Its parts, labor, and payments are deleted too. This can’t be undone.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
