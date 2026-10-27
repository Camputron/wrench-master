import { Pencil, Plus, TrashBin } from '@gravity-ui/icons'
import { Button, EmptyState, Table } from '@heroui/react'
import type { ReactNode } from 'react'

export interface Column<T> {
  label: string
  render: (item: T) => ReactNode
  /** Right-align numbers. */
  numeric?: boolean
  className?: string
}

interface Props<T> {
  title: string
  /** e.g. "part": used in button labels. */
  noun: string
  items: T[]
  columns: Column<T>[]
  /** Short description of an item for button labels, e.g. the part description. */
  describe: (item: T) => string
  onAdd: () => void
  onEdit: (index: number) => void
  onDelete: (index: number) => void
  emptyText: string
  footer?: ReactNode
}

/** A card with a table of work order lines (parts, labor, or payments) and add/edit/delete actions. */
export default function LineTable<T>({ title, noun, items, columns, describe, onAdd, onEdit, onDelete, emptyText, footer }: Props<T>): React.ReactElement {
  const rows = items.map((item, index) => ({ index, item }))
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <Button size="sm" variant="secondary" onPress={onAdd}>
          <Plus className="size-4" />
          Add {noun}
        </Button>
      </div>
      <Table variant="secondary">
        <Table.ScrollContainer>
          <Table.Content aria-label={title} onRowAction={(key) => onEdit(Number(key))}>
            <Table.Header>
              {[
                ...columns.map((c, i) => (
                  <Table.Column key={c.label} isRowHeader={i === 0} className={c.numeric ? 'text-end' : undefined}>
                    {c.label}
                  </Table.Column>
                )),
                <Table.Column key="actions" className="w-0">
                  <span className="sr-only">Actions</span>
                </Table.Column>
              ]}
            </Table.Header>
            <Table.Body items={rows} renderEmptyState={() => <EmptyState className="py-4 text-center text-sm text-muted">{emptyText}</EmptyState>}>
              {({ index, item }) => (
                <Table.Row id={index} className="cursor-default">
                  {[
                    ...columns.map((c) => (
                      <Table.Cell key={c.label} className={[c.numeric ? 'text-end tabular-nums whitespace-nowrap' : '', c.className ?? ''].join(' ')}>
                        {c.render(item)}
                      </Table.Cell>
                    )),
                    <Table.Cell key="actions">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" isIconOnly aria-label={`Edit ${noun} ${describe(item)}`} onPress={() => onEdit(index)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" isIconOnly aria-label={`Remove ${noun} ${describe(item)}`} onPress={() => onDelete(index)}>
                          <TrashBin className="size-4 text-danger" />
                        </Button>
                      </div>
                    </Table.Cell>
                  ]}
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      {footer}
    </section>
  )
}
