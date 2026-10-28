import { Magnifier } from '@gravity-ui/icons'
import { EmptyState, InputGroup, Modal, Spinner, Table } from '@heroui/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { Customer, Vehicle } from '../../../../shared/types'
import { customerName, formatAddress, vehicleName } from '../../lib/format'
import { keys } from '../../lib/queryClient'

interface PickerProps<T> {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onPick: (item: T) => void
}

/** Choose a saved customer for a work order. */
export function CustomerPickerModal({ isOpen, onOpenChange, onPick }: PickerProps<Customer>): React.ReactElement {
  const [search, setSearch] = useState('')
  const query = search.trim()
  const customers = useQuery({ queryKey: keys.customerSearch(query), queryFn: () => window.api.customers.search(query, 100), placeholderData: keepPreviousData })
  const results = customers.data ?? []

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Choose a customer</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3">
            <InputGroup variant="secondary">
              <InputGroup.Prefix>
                <Magnifier className="size-4 text-muted" />
              </InputGroup.Prefix>
              <InputGroup.Input aria-label="Search customers" placeholder="Search by name, company, phone, email, or address" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
            </InputGroup>
            <Table variant="secondary">
              <Table.ScrollContainer className="max-h-[50vh] overflow-y-auto">
                <Table.Content
                  aria-label="Customers"
                  onRowAction={(key) => {
                    const c = results.find((x) => x.id === key)
                    if (c) {
                      onPick(c)
                      onOpenChange(false)
                    }
                  }}
                >
                  <Table.Header>
                    <Table.Column isRowHeader>Name</Table.Column>
                    <Table.Column>Phone</Table.Column>
                    <Table.Column>Address</Table.Column>
                  </Table.Header>
                  <Table.Body items={results} renderEmptyState={() => <EmptyState className="py-6 text-center text-sm text-muted">{customers.isPending ? <Spinner /> : query ? `No customers match “${query}”.` : 'No customers yet.'}</EmptyState>}>
                    {(c) => (
                      <Table.Row id={c.id} className="cursor-pointer">
                        <Table.Cell>
                          <div>{customerName(c)}</div>
                          {c.company && (c.firstName || c.lastName) && <div className="text-xs text-muted">{c.company}</div>}
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap tabular-nums">{c.phone}</Table.Cell>
                        <Table.Cell>{formatAddress(c)}</Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

/** Choose one of a customer's saved vehicles for a work order. */
export function VehiclePickerModal({ isOpen, onOpenChange, onPick, customer }: PickerProps<Vehicle> & { customer: Customer }): React.ReactElement {
  const vehicles = useQuery({ queryKey: keys.vehiclesOf(customer.id), queryFn: () => window.api.vehicles.listByCustomer(customer.id) })
  const results = vehicles.data ?? []

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="md" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Choose a vehicle</Modal.Heading>
            <p className="text-sm text-muted">{customerName(customer)}</p>
          </Modal.Header>
          <Modal.Body>
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content
                  aria-label="Vehicles"
                  onRowAction={(key) => {
                    const v = results.find((x) => x.id === key)
                    if (v) {
                      onPick(v)
                      onOpenChange(false)
                    }
                  }}
                >
                  <Table.Header>
                    <Table.Column isRowHeader>Vehicle</Table.Column>
                    <Table.Column>VIN / Plate</Table.Column>
                  </Table.Header>
                  <Table.Body items={results} renderEmptyState={() => <EmptyState className="py-6 text-center text-sm text-muted">{vehicles.isPending ? <Spinner /> : 'This customer has no saved vehicles.'}</EmptyState>}>
                    {(v) => (
                      <Table.Row id={v.id} className="cursor-pointer">
                        <Table.Cell>
                          <div>{vehicleName(v)}</div>
                          <div className="text-xs text-muted">{[v.color, v.engine, v.transmission].filter(Boolean).join(' · ')}</div>
                        </Table.Cell>
                        <Table.Cell className="font-mono text-xs">
                          <div>{v.vin}</div>
                          <div className="text-muted">{v.licensePlate}</div>
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
