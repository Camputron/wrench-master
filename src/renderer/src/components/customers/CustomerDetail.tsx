import { Envelope, FilePlus, Handset, MapPin, Pencil, Plus, TrashBin } from '@gravity-ui/icons'
import { Button, EmptyState, Spinner, Table } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import type { Customer, Vehicle } from '../../../../shared/types'
import { useEditors } from '../../editors/editorsContext'
import { customerName, formatAddress, formatDate, vehicleName, workOrderTotal } from '../../lib/format'
import { keys } from '../../lib/queryClient'
import StatusChip from '../workOrders/StatusChip'

interface Props {
  customer: Customer
  onEdit: () => void
  onDelete: () => void
  onAddVehicle: () => void
  onEditVehicle: (vehicle: Vehicle) => void
  onDeleteVehicle: (vehicle: Vehicle) => void
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/** The selected customer's contact details, vehicles, and work orders. */
export default function CustomerDetail({ customer, onEdit, onDelete, onAddVehicle, onEditVehicle, onDeleteVehicle }: Props): React.ReactElement {
  const { newWorkOrder, openWorkOrder } = useEditors()
  const vehicles = useQuery({ queryKey: keys.vehiclesOf(customer.id), queryFn: () => window.api.vehicles.listByCustomer(customer.id) })
  const workOrders = useQuery({ queryKey: keys.workOrdersOf(customer.id), queryFn: () => window.api.workOrders.listByCustomer(customer.id) })
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ')
  const address = formatAddress(customer)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{name || customer.company || customerName(customer)}</h2>
          {name && customer.company && <p className="text-sm text-muted">{customer.company}</p>}
          <ul className="mt-2 flex flex-col gap-1 text-sm select-text">
            {customer.phone && (
              <li className="flex items-center gap-2">
                <Handset className="size-4 text-muted" />
                {customer.phone}
              </li>
            )}
            {customer.email && (
              <li className="flex items-center gap-2">
                <Envelope className="size-4 text-muted" />
                {customer.email}
              </li>
            )}
            {address && (
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-muted" />
                {address}
              </li>
            )}
          </ul>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onPress={() => newWorkOrder({ customer })}>
            <FilePlus className="size-4" />
            New work order
          </Button>
          <Button size="sm" variant="secondary" onPress={onEdit}>
            <Pencil className="size-4" />
            Edit
          </Button>
          <Button size="sm" variant="danger-soft" isIconOnly aria-label="Delete customer" onPress={onDelete}>
            <TrashBin className="size-4" />
          </Button>
        </div>
      </header>

      <Section
        title="Vehicles"
        action={
          <Button size="sm" variant="tertiary" onPress={onAddVehicle}>
            <Plus className="size-4" />
            Add vehicle
          </Button>
        }
      >
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Vehicles" onRowAction={(key) => onEditVehicle(vehicles.data!.find((v) => v.id === key)!)}>
              <Table.Header>
                <Table.Column isRowHeader>Vehicle</Table.Column>
                <Table.Column>VIN / Plate</Table.Column>
                <Table.Column className="w-0">
                  <span className="sr-only">Actions</span>
                </Table.Column>
              </Table.Header>
              <Table.Body items={vehicles.data ?? []} renderEmptyState={() => <EmptyState className="py-4 text-center text-sm text-muted">{vehicles.isPending ? <Spinner size="sm" /> : 'No vehicles yet.'}</EmptyState>}>
                {(v) => (
                  <Table.Row id={v.id}>
                    <Table.Cell>
                      <div className="whitespace-nowrap">{vehicleName(v)}</div>
                      <div className="text-xs text-muted">{[v.color, v.engine, v.transmission].filter(Boolean).join(' · ')}</div>
                    </Table.Cell>
                    <Table.Cell className="font-mono text-xs">
                      <div>{v.vin}</div>
                      <div className="text-muted">{v.licensePlate}</div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" isIconOnly aria-label={`New work order for ${vehicleName(v)}`} onPress={() => newWorkOrder({ customer, vehicle: v })}>
                          <FilePlus className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" isIconOnly aria-label={`Edit ${vehicleName(v)}`} onPress={() => onEditVehicle(v)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" isIconOnly aria-label={`Delete ${vehicleName(v)}`} onPress={() => onDeleteVehicle(v)}>
                          <TrashBin className="size-4 text-danger" />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </Section>

      <Section title="Work orders">
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Work orders" onRowAction={(key) => void openWorkOrder(Number(key))}>
              <Table.Header>
                <Table.Column isRowHeader>#</Table.Column>
                <Table.Column>Created</Table.Column>
                <Table.Column>Vehicle</Table.Column>
                <Table.Column className="text-end">Total</Table.Column>
                <Table.Column>Status</Table.Column>
              </Table.Header>
              <Table.Body items={workOrders.data ?? []} renderEmptyState={() => <EmptyState className="py-4 text-center text-sm text-muted">{workOrders.isPending ? <Spinner size="sm" /> : 'No work orders yet.'}</EmptyState>}>
                {(wo) => (
                  <Table.Row id={wo.id} className="cursor-pointer">
                    <Table.Cell>{wo.id}</Table.Cell>
                    <Table.Cell className="whitespace-nowrap tabular-nums">{formatDate(wo.dateCreated)}</Table.Cell>
                    <Table.Cell>{vehicleName(wo.vehicle)}</Table.Cell>
                    <Table.Cell className="text-end tabular-nums">{workOrderTotal(wo)}</Table.Cell>
                    <Table.Cell>
                      <StatusChip workOrder={wo} compact />
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </Section>
    </div>
  )
}
