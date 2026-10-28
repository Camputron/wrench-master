import { EmptyState, Spinner, Table } from '@heroui/react'
import { balance } from '../../../../shared/billing'
import type { WorkOrder } from '../../../../shared/types'
import { useEditors } from '../../editors/editorsContext'
import { customerName, formatDate, formatMoney, vehicleName, workOrderTotal } from '../../lib/format'

interface Props {
  title: string
  workOrders: WorkOrder[] | undefined
  emptyText: string
}

/** A compact list of work orders on the dashboard. Double-click (or Enter) opens one. */
export default function WorkOrderSummaryTable({ title, workOrders, emptyText }: Props): React.ReactElement {
  const { openWorkOrder } = useEditors()
  return (
    <Table variant="secondary">
      <Table.ScrollContainer className="max-h-96 overflow-y-auto">
        <Table.Content aria-label={title} onRowAction={(key) => void openWorkOrder(Number(key))}>
          <Table.Header className="sticky top-0 z-10 bg-surface">
            <Table.Column isRowHeader>#</Table.Column>
            <Table.Column>Customer</Table.Column>
            <Table.Column>Vehicle</Table.Column>
            <Table.Column>Created</Table.Column>
            <Table.Column className="text-end">Total</Table.Column>
            <Table.Column className="text-end">Balance</Table.Column>
          </Table.Header>
          <Table.Body items={workOrders ?? []} renderEmptyState={() => <EmptyState className="py-6 text-center text-sm text-muted">{workOrders ? emptyText : <Spinner />}</EmptyState>}>
            {(wo) => {
              const due = balance(wo)
              return (
                <Table.Row id={wo.id} className="cursor-pointer">
                  <Table.Cell className="tabular-nums">{wo.id}</Table.Cell>
                  <Table.Cell>{customerName(wo.customer)}</Table.Cell>
                  <Table.Cell>{vehicleName(wo.vehicle)}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap tabular-nums">{formatDate(wo.dateCreated)}</Table.Cell>
                  <Table.Cell className="text-end tabular-nums">{workOrderTotal(wo)}</Table.Cell>
                  {wo.dateVoided ? <Table.Cell className="text-end text-muted">Voided</Table.Cell> : <Table.Cell className={`text-end tabular-nums ${due > 0.004 ? 'text-warning' : 'text-muted'}`}>{formatMoney(Math.abs(due) < 0.005 ? 0 : due)}</Table.Cell>}
                </Table.Row>
              )
            }}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  )
}
