import { Magnifier, Persons, Plus } from '@gravity-ui/icons'
import { Button, EmptyState, InputGroup, Spinner, Table, toast } from '@heroui/react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Customer, Vehicle } from '../../../shared/types'
import ConfirmDialog from '../components/ConfirmDialog'
import CustomerDetail from '../components/customers/CustomerDetail'
import CustomerFormModal from '../components/customers/CustomerFormModal'
import VehicleFormModal from '../components/customers/VehicleFormModal'
import { customerName, formatAddress, vehicleName } from '../lib/format'
import { useDebounced } from '../hooks/useDebounced'
import { keys } from '../lib/queryClient'
import { EMPTY_CUSTOMER, emptyVehicle } from '../lib/records'

/** Results shown at once; refine the search to find others. */
const LIMIT = 200

type Dialog = { kind: 'customer'; customer: Customer } | { kind: 'deleteCustomer'; customer: Customer } | { kind: 'vehicle'; vehicle: Vehicle } | { kind: 'deleteVehicle'; vehicle: Vehicle }

interface Props {
  /** Changes each time File > New Customer is chosen. */
  newCustomerRequest: number
}

export default function CustomersPage({ newCustomerRequest }: Props): React.ReactElement {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const query = useDebounced(search.trim(), 200)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  /** Bumped per dialog so forms start fresh each time they open. */
  const [dialogKey, setDialogKey] = useState(0)

  const open = (d: Dialog): void => {
    setDialogKey((k) => k + 1)
    setDialog(d)
  }
  const close = (isOpen: boolean): void => {
    if (!isOpen) setDialog(null)
  }

  // Open the new-customer form when the menu asks (adjusting state on a prop change, during render).
  const [handledRequest, setHandledRequest] = useState(0)
  if (newCustomerRequest !== handledRequest) {
    setHandledRequest(newCustomerRequest)
    if (newCustomerRequest > 0) open({ kind: 'customer', customer: EMPTY_CUSTOMER })
  }

  const customers = useQuery({ queryKey: keys.customerSearch(query), queryFn: () => window.api.customers.search(query, LIMIT), placeholderData: keepPreviousData })
  const selected = useQuery({
    queryKey: ['customers', 'byId', selectedId],
    queryFn: () => window.api.customers.get(selectedId!),
    enabled: selectedId !== null
  })
  const selectedCustomer = selectedId === null ? null : selected.data ?? customers.data?.find((c) => c.id === selectedId) ?? null

  const refreshCustomers = (): Promise<void> => queryClient.invalidateQueries({ queryKey: keys.customers })
  const refreshVehicles = (): Promise<void> => queryClient.invalidateQueries({ queryKey: keys.vehicles })

  const deleteCustomer = async (c: Customer): Promise<void> => {
    await window.api.customers.delete(c.id)
    setSelectedId(null)
    await Promise.all([refreshCustomers(), refreshVehicles()])
    toast.success(`Deleted ${customerName(c)}`)
  }
  const deleteVehicle = async (v: Vehicle): Promise<void> => {
    await window.api.vehicles.delete(v.id)
    await refreshVehicles()
    toast.success(`Deleted ${vehicleName(v)}`)
  }

  const results = customers.data ?? []
  const hasSearch = query.length > 0

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-w-0 flex-1 flex-col gap-3 border-r border-separator p-4">
        <div className="flex items-center gap-2">
          <InputGroup className="flex-1">
            <InputGroup.Prefix>
              <Magnifier className="size-4 text-muted" />
            </InputGroup.Prefix>
            <InputGroup.Input aria-label="Search customers" placeholder="Search by name, company, phone, email, or address" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
          </InputGroup>
          <Button onPress={() => open({ kind: 'customer', customer: EMPTY_CUSTOMER })}>
            <Plus className="size-4" />
            New customer
          </Button>
        </div>

        <Table className="min-h-0 flex-1">
          <Table.ScrollContainer className="h-full overflow-y-auto">
            <Table.Content
              aria-label="Customers"
              selectionMode="single"
              selectionBehavior="replace"
              disallowEmptySelection={selectedId !== null}
              selectedKeys={selectedId === null ? [] : [selectedId]}
              onSelectionChange={(keys) => {
                const [key] = keys === 'all' ? [] : [...keys]
                setSelectedId(key === undefined ? null : Number(key))
              }}
              onRowAction={(key) => {
                const c = results.find((x) => x.id === key)
                if (c) open({ kind: 'customer', customer: c })
              }}
            >
              <Table.Header className="sticky top-0 z-10 bg-surface">
                <Table.Column isRowHeader>Name</Table.Column>
                <Table.Column>Company</Table.Column>
                <Table.Column>Phone</Table.Column>
                <Table.Column>Address</Table.Column>
              </Table.Header>
              <Table.Body
                items={results}
                renderEmptyState={() => (
                  <EmptyState className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted">
                    {customers.isPending ? (
                      <Spinner />
                    ) : hasSearch ? (
                      `No customers match “${query}”.`
                    ) : (
                      <>
                        <Persons className="size-6" />
                        No customers yet. Add one with New customer, or import your data with File › Import.
                      </>
                    )}
                  </EmptyState>
                )}
              >
                {(c) => (
                  <Table.Row id={c.id} className="cursor-default data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-soft-foreground">
                    <Table.Cell>{customerName(c)}</Table.Cell>
                    <Table.Cell>{c.company}</Table.Cell>
                    <Table.Cell className="whitespace-nowrap tabular-nums">{c.phone}</Table.Cell>
                    <Table.Cell>{formatAddress(c)}</Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
        {results.length >= LIMIT && <p className="text-xs text-muted">Showing the first {LIMIT} customers. Search to find others.</p>}
      </section>

      <aside className="w-[520px] shrink-0 overflow-y-auto p-4">
        {selectedCustomer ? (
          <CustomerDetail
            customer={selectedCustomer}
            onEdit={() => open({ kind: 'customer', customer: selectedCustomer })}
            onDelete={() => open({ kind: 'deleteCustomer', customer: selectedCustomer })}
            onAddVehicle={() => open({ kind: 'vehicle', vehicle: emptyVehicle(selectedCustomer.id) })}
            onEditVehicle={(vehicle) => open({ kind: 'vehicle', vehicle })}
            onDeleteVehicle={(vehicle) => open({ kind: 'deleteVehicle', vehicle })}
          />
        ) : (
          <EmptyState className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted">
            <Persons className="size-6" />
            Select a customer to see their vehicles and work orders.
          </EmptyState>
        )}
      </aside>

      {dialog?.kind === 'customer' && (
        <CustomerFormModal
          key={dialogKey}
          isOpen
          onOpenChange={close}
          customer={dialog.customer}
          onSaved={async (saved) => {
            await refreshCustomers()
            setSelectedId(saved.id)
            toast.success(dialog.customer.id > 0 ? `Saved ${customerName(saved)}` : `Added ${customerName(saved)}`)
          }}
        />
      )}
      {dialog?.kind === 'vehicle' && (
        <VehicleFormModal
          key={dialogKey}
          isOpen
          onOpenChange={close}
          vehicle={dialog.vehicle}
          ownerName={selectedCustomer ? customerName(selectedCustomer) : ''}
          onSaved={async (saved) => {
            await refreshVehicles()
            toast.success(dialog.vehicle.id > 0 ? `Saved ${vehicleName(saved)}` : `Added ${vehicleName(saved)}`)
          }}
        />
      )}
      {dialog?.kind === 'deleteCustomer' && (
        <ConfirmDialog key={dialogKey} isOpen onOpenChange={close} title={`Delete ${customerName(dialog.customer)}?`} confirmLabel="Delete customer" onConfirm={() => deleteCustomer(dialog.customer)}>
          <p>This also deletes their vehicles. Their past work orders are kept.</p>
        </ConfirmDialog>
      )}
      {dialog?.kind === 'deleteVehicle' && (
        <ConfirmDialog key={dialogKey} isOpen onOpenChange={close} title={`Delete ${vehicleName(dialog.vehicle)}?`} confirmLabel="Delete vehicle" onConfirm={() => deleteVehicle(dialog.vehicle)}>
          <p>Work orders for this vehicle are kept.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
