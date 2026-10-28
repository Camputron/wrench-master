import { ArrowRotateLeft, ArrowUturnCcwLeft, ArrowUturnCwRight, Ban, FloppyDisk, Printer } from '@gravity-ui/icons'
import { Button } from '@heroui/react'
import { useState } from 'react'
import { balance, laborSubtotal, partSubtotal } from '../../../../shared/billing'
import type { WorkOrder } from '../../../../shared/types'
import { useEditors } from '../../editors/editorsContext'
import { isDirty, type Editor } from '../../editors/editorsReducer'
import { useSaveWorkOrder } from '../../editors/useSaveWorkOrder'
import { useSetVoided } from '../../editors/useSetVoided'
import { useSettings } from '../../hooks/useSettings'
import { formatDate, formatMoney, todayIso } from '../../lib/format'
import { emptyLabor, emptyPart, emptyPayment, validateWorkOrder } from '../../lib/records'
import ConfirmDialog from '../ConfirmDialog'
import CustomerVehicleSection from './CustomerVehicleSection'
import LaborFormModal from './LaborFormModal'
import LineTable from './LineTable'
import PartFormModal from './PartFormModal'
import PaymentFormModal from './PaymentFormModal'
import PrintPreviewModal from './PrintPreviewModal'
import StatusChip from './StatusChip'
import SummaryPanel from './SummaryPanel'

type LineKind = 'parts' | 'labor' | 'payments'
type Dialog = { kind: 'part' | 'labor' | 'payment'; index: number | null } | { kind: 'close' } | { kind: 'print' }

const replaceAt = <T,>(list: T[], index: number | null, item: T): T[] => (index === null ? [...list, item] : list.map((x, i) => (i === index ? item : x)))

/** Edits one work order: customer and vehicle, parts, labor, payments, dates, and totals. */
interface Props {
  editor: Editor
  /** Changes each time File > Print is chosen. */
  printRequest: number
  /** Changes each time File > Close Work Order is chosen while this work order has unsaved changes. */
  closeRequest: number
}

export default function WorkOrderEditor({ editor, printRequest, closeRequest }: Props): React.ReactElement {
  const { edit, undo, redo, close } = useEditors()
  const saveWithFeedback = useSaveWorkOrder()
  const setVoided = useSetVoided()
  const settings = useSettings()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [dialogKey, setDialogKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const wo = editor.draft
  const key = editor.key
  const dirty = isDirty(editor)
  const dateError = validateWorkOrder(wo)

  const open = (d: Dialog): void => {
    setDialogKey((k) => k + 1)
    setDialog(d)
  }

  // Open the print preview when the menu asks (adjusting state on a prop change, during render).
  const [handledPrint, setHandledPrint] = useState(printRequest)
  if (printRequest !== handledPrint) {
    setHandledPrint(printRequest)
    open({ kind: 'print' })
  }
  // Same for File > Close Work Order with unsaved changes: ask first. (Without changes, the app closes it directly.)
  const [handledClose, setHandledClose] = useState(closeRequest)
  if (closeRequest !== handledClose) {
    setHandledClose(closeRequest)
    open({ kind: 'close' })
  }
  const onDialogOpenChange = (isOpen: boolean): void => {
    if (!isOpen) setDialog(null)
  }
  const typing = (update: (w: WorkOrder) => WorkOrder): void => edit(key, update)
  const setLines = <K extends LineKind>(kind: K, lines: WorkOrder[K]): void => edit(key, (w) => ({ ...w, [kind]: lines }), true)
  const removeLine = (kind: LineKind, index: number): void => setLines(kind, wo[kind].filter((_, i) => i !== index) as WorkOrder[typeof kind])

  const doSave = async (thenClose: boolean): Promise<void> => {
    setSaving(true)
    await saveWithFeedback(key, thenClose)
    setSaving(false)
  }

  const title = wo.id > 0 ? `Work order #${wo.id}` : 'New work order'
  const paymentDialog = dialog?.kind === 'payment' ? dialog : null

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-separator bg-background/90 px-4 py-2 backdrop-blur">
        <h2 className="text-lg font-semibold">{title}</h2>
        <StatusChip workOrder={wo} />
        {dirty && <span className="text-sm text-muted">Unsaved changes</span>}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" isIconOnly aria-label="Undo" isDisabled={editor.past.length === 0} onPress={() => undo(key)}>
            <ArrowUturnCcwLeft className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" isIconOnly aria-label="Redo" isDisabled={editor.future.length === 0} onPress={() => redo(key)}>
            <ArrowUturnCwRight className="size-4" />
          </Button>
          <Button size="sm" variant="tertiary" onPress={() => open({ kind: 'print' })}>
            <Printer className="size-4" />
            Print…
          </Button>
          <Button size="sm" variant="tertiary" onPress={() => (dirty ? open({ kind: 'close' }) : close(key))}>
            Close
          </Button>
          <Button size="sm" variant="secondary" isDisabled={saving || !!wo.dateVoided} onPress={() => doSave(true)}>
            Save &amp; close
          </Button>
          <Button size="sm" isPending={saving} isDisabled={!!wo.dateVoided} onPress={() => doSave(false)}>
            <FloppyDisk className="size-4" />
            Save
          </Button>
        </div>
      </header>

      {wo.dateVoided && (
        <div role="status" className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-danger-soft p-3 text-sm text-danger-soft-foreground">
          <Ban className="size-5 shrink-0" />
          <p className="flex-1">Voided on {formatDate(wo.dateVoided)}. It’s kept for your records, but left out of totals and the dashboard, and can’t be changed. Restore it to make changes.</p>
          <Button size="sm" variant="secondary" onPress={() => setVoided(wo, false)}>
            <ArrowRotateLeft className="size-4" />
            Restore
          </Button>
        </div>
      )}

      {/* A voided work order is read-only: inert blocks clicks, typing, and focus in everything below. */}
      <div className={`flex gap-4 p-4 ${wo.dateVoided ? 'opacity-60' : ''}`} inert={!!wo.dateVoided}>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <CustomerVehicleSection workOrder={wo} onChange={typing} />
          <LineTable
            title="Parts"
            noun="part"
            items={wo.parts}
            describe={(p) => p.desc || p.name}
            columns={[
              { label: 'Description', render: (p) => p.desc },
              { label: 'Part #', render: (p) => p.name, className: 'font-mono text-xs' },
              { label: 'Qty', render: (p) => p.quantity, numeric: true },
              { label: 'Price', render: (p) => formatMoney(p.retailPrice), numeric: true },
              { label: 'Total', render: (p) => `${formatMoney(partSubtotal(p))}${p.taxable ? '' : ' (no tax)'}`, numeric: true }
            ]}
            onAdd={() => open({ kind: 'part', index: null })}
            onEdit={(index) => open({ kind: 'part', index })}
            onDelete={(index) => removeLine('parts', index)}
            emptyText="No parts yet."
          />
          <LineTable
            title="Labor"
            noun="labor"
            items={wo.labor}
            describe={(l) => l.desc || l.code}
            columns={[
              { label: 'Description', render: (l) => <span className="whitespace-pre-line">{l.desc}</span> },
              { label: 'Code', render: (l) => l.code },
              { label: 'Hours', render: (l) => l.billedHrs, numeric: true },
              { label: 'Rate', render: (l) => formatMoney(l.rate), numeric: true },
              { label: 'Total', render: (l) => `${formatMoney(laborSubtotal(l))}${l.taxable ? '' : ' (no tax)'}`, numeric: true }
            ]}
            onAdd={() => open({ kind: 'labor', index: null })}
            onEdit={(index) => open({ kind: 'labor', index })}
            onDelete={(index) => removeLine('labor', index)}
            emptyText="No labor yet."
          />
          <LineTable
            title="Payments"
            noun="payment"
            items={wo.payments}
            describe={(p) => `${p.method} ${formatMoney(p.amount)}`}
            columns={[
              { label: 'Date', render: (p) => formatDate(p.date) },
              { label: 'Method', render: (p) => p.method },
              { label: 'Amount', render: (p) => formatMoney(p.amount), numeric: true }
            ]}
            onAdd={() => open({ kind: 'payment', index: null })}
            onEdit={(index) => open({ kind: 'payment', index })}
            onDelete={(index) => removeLine('payments', index)}
            emptyText="No payments yet."
          />
        </div>
        <aside className="sticky top-16 w-72 shrink-0 self-start">
          <SummaryPanel workOrder={wo} onChange={typing} dateError={dateError} />
        </aside>
      </div>

      {dialog?.kind === 'part' && (
        <PartFormModal key={dialogKey} isOpen onOpenChange={onDialogOpenChange} part={dialog.index === null ? emptyPart() : wo.parts[dialog.index]} onSubmit={(part) => setLines('parts', replaceAt(wo.parts, dialog.index, part))} />
      )}
      {dialog?.kind === 'labor' && (
        <LaborFormModal
          key={dialogKey}
          isOpen
          onOpenChange={onDialogOpenChange}
          labor={dialog.index === null ? emptyLabor(settings?.laborRate ?? 0) : wo.labor[dialog.index]}
          parts={wo.parts}
          onSubmit={(labor) => setLines('labor', replaceAt(wo.labor, dialog.index, labor))}
        />
      )}
      {paymentDialog && (
        <PaymentFormModal
          key={dialogKey}
          isOpen
          onOpenChange={onDialogOpenChange}
          payment={paymentDialog.index === null ? emptyPayment(todayIso()) : wo.payments[paymentDialog.index]}
          balance={balance({ ...wo, payments: wo.payments.filter((_, i) => i !== paymentDialog.index) })}
          onSubmit={(payment) => setLines('payments', replaceAt(wo.payments, paymentDialog.index, payment))}
        />
      )}
      {dialog?.kind === 'print' && <PrintPreviewModal key={dialogKey} isOpen onOpenChange={onDialogOpenChange} workOrder={wo} />}
      {dialog?.kind === 'close' && (
        <ConfirmDialog key={dialogKey} isOpen onOpenChange={onDialogOpenChange} title={wo.id > 0 ? `Discard changes to work order #${wo.id}?` : 'Discard this new work order?'} confirmLabel="Discard changes" onConfirm={async () => close(key)}>
          <p>Your unsaved changes will be lost.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
