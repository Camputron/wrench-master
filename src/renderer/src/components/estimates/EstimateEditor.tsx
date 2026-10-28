import { ArrowRotateLeft, ArrowUturnCcwLeft, ArrowUturnCwRight, CircleCheck, FloppyDisk, Printer } from '@gravity-ui/icons'
import { Button } from '@heroui/react'
import { useState } from 'react'
import { laborSubtotal, partSubtotal } from '../../../../shared/billing'
import { estimateNumber, isExpired } from '../../../../shared/estimates'
import type { Estimate } from '../../../../shared/types'
import { useEditors, useEstimateEditors } from '../../editors/editorsContext'
import { isDirty, type Editor } from '../../editors/editorsReducer'
import { useEstimateActions, useSaveEstimate } from '../../editors/estimateActions'
import { useSettings } from '../../hooks/useSettings'
import { formatDate, formatMoney, todayIso } from '../../lib/format'
import { emptyLabor, emptyPart, validateEstimate } from '../../lib/records'
import ConfirmDialog from '../ConfirmDialog'
import CustomerVehicleSection from '../workOrders/CustomerVehicleSection'
import LaborFormModal from '../workOrders/LaborFormModal'
import LineTable from '../workOrders/LineTable'
import PartFormModal from '../workOrders/PartFormModal'
import PrintPreviewModal from '../workOrders/PrintPreviewModal'
import EstimateStatusChip from './EstimateStatusChip'
import EstimateSummaryPanel from './EstimateSummaryPanel'

type LineKind = 'parts' | 'labor'
type Dialog = { kind: 'part' | 'labor'; index: number | null } | { kind: 'close' } | { kind: 'print' } | { kind: 'accept' }

const replaceAt = <T,>(list: T[], index: number | null, item: T): T[] => (index === null ? [...list, item] : list.map((x, i) => (i === index ? item : x)))

interface Props {
  editor: Editor<Estimate>
  /** Changes each time File > Print is chosen. */
  printRequest: number
  /** Changes each time File > Close Tab is chosen while this estimate has unsaved changes. */
  closeRequest: number
}

/** Edits one estimate: customer and vehicle, parts, labor, dates, and the estimated total; accepts or declines it. */
export default function EstimateEditor({ editor, printRequest, closeRequest }: Props): React.ReactElement {
  const { edit, undo, redo, close } = useEstimateEditors()
  const { openWorkOrder } = useEditors()
  const saveEstimate = useSaveEstimate()
  const { accept, decline, reopen } = useEstimateActions()
  const settings = useSettings()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [dialogKey, setDialogKey] = useState(0)
  const [busy, setBusy] = useState<'save' | 'decline' | null>(null)
  const e = editor.draft
  const key = editor.key
  const dirty = isDirty(editor)
  const locked = e.status !== 'open'
  const dateError = validateEstimate(e)
  const expired = isExpired(e, todayIso())

  const open = (d: Dialog): void => {
    setDialogKey((k) => k + 1)
    setDialog(d)
  }
  // Open the print preview, or ask about unsaved changes, when the menu asks (adjusting state on a prop change).
  const [handledPrint, setHandledPrint] = useState(printRequest)
  if (printRequest !== handledPrint) {
    setHandledPrint(printRequest)
    open({ kind: 'print' })
  }
  const [handledClose, setHandledClose] = useState(closeRequest)
  if (closeRequest !== handledClose) {
    setHandledClose(closeRequest)
    open({ kind: 'close' })
  }
  const onDialogOpenChange = (isOpen: boolean): void => {
    if (!isOpen) setDialog(null)
  }
  const typing = (update: (x: Estimate) => Estimate): void => edit(key, update)
  const setLines = <K extends LineKind>(kind: K, lines: Estimate[K]): void => edit(key, (x) => ({ ...x, [kind]: lines }), true)
  const removeLine = (kind: LineKind, index: number): void => setLines(kind, e[kind].filter((_, i) => i !== index) as Estimate[typeof kind])

  const run = async (what: 'save' | 'decline', action: () => Promise<unknown>): Promise<void> => {
    setBusy(what)
    await action()
    setBusy(null)
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-separator bg-background/90 px-4 py-2 backdrop-blur">
        <h2 className="text-lg font-semibold">{e.id > 0 ? `Estimate ${estimateNumber(e.id)}` : 'New estimate'}</h2>
        <EstimateStatusChip estimate={e} />
        {dirty && <span className="text-sm text-muted">Unsaved changes</span>}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" isIconOnly aria-label="Undo" isDisabled={editor.past.length === 0 || locked} onPress={() => undo(key)}>
            <ArrowUturnCcwLeft className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" isIconOnly aria-label="Redo" isDisabled={editor.future.length === 0 || locked} onPress={() => redo(key)}>
            <ArrowUturnCwRight className="size-4" />
          </Button>
          <Button size="sm" variant="tertiary" onPress={() => open({ kind: 'print' })}>
            <Printer className="size-4" />
            Print…
          </Button>
          <Button size="sm" variant="tertiary" onPress={() => (dirty ? open({ kind: 'close' }) : close(key))}>
            Close
          </Button>
          {!locked && (
            <>
              <Button size="sm" variant="tertiary" isPending={busy === 'decline'} isDisabled={busy !== null} onPress={() => run('decline', () => decline(key))}>
                Decline
              </Button>
              <Button size="sm" variant="secondary" isDisabled={busy !== null} onPress={() => open({ kind: 'accept' })}>
                <CircleCheck className="size-4" />
                Accept…
              </Button>
              <Button size="sm" isPending={busy === 'save'} isDisabled={busy !== null} onPress={() => run('save', () => saveEstimate(key))}>
                <FloppyDisk className="size-4" />
                Save
              </Button>
            </>
          )}
        </div>
      </header>

      {e.status === 'accepted' && (
        <div role="status" className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-success-soft p-3 text-sm text-success-soft-foreground">
          <CircleCheck className="size-5 shrink-0" />
          <p className="flex-1">Accepted{e.workOrderId ? ` and turned into work order #${e.workOrderId}` : ''}. It’s kept as the record of what was quoted, so it can’t be changed.</p>
          {e.workOrderId && (
            <Button size="sm" variant="secondary" onPress={() => void openWorkOrder(e.workOrderId!)}>
              Open work order #{e.workOrderId}
            </Button>
          )}
        </div>
      )}
      {e.status === 'declined' && (
        <div role="status" className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-default p-3 text-sm">
          <p className="flex-1">Declined. Reopen it to change it or accept it after all.</p>
          <Button size="sm" variant="secondary" onPress={() => void reopen(e)}>
            <ArrowRotateLeft className="size-4" />
            Reopen
          </Button>
        </div>
      )}

      {/* Accepted and declined estimates are read-only: inert blocks clicks, typing, and focus in everything below. */}
      <div className={`flex gap-4 p-4 ${locked ? 'opacity-60' : ''}`} inert={locked}>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <CustomerVehicleSection doc={e} onChange={typing} hideMileageOut />
          <LineTable
            title="Parts"
            noun="part"
            items={e.parts}
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
            items={e.labor}
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
        </div>
        <aside className="sticky top-16 w-72 shrink-0 self-start">
          <EstimateSummaryPanel estimate={e} onChange={typing} dateError={dateError} />
        </aside>
      </div>

      {dialog?.kind === 'part' && <PartFormModal key={dialogKey} isOpen onOpenChange={onDialogOpenChange} part={dialog.index === null ? emptyPart() : e.parts[dialog.index]} onSubmit={(part) => setLines('parts', replaceAt(e.parts, dialog.index, part))} />}
      {dialog?.kind === 'labor' && (
        <LaborFormModal
          key={dialogKey}
          isOpen
          onOpenChange={onDialogOpenChange}
          labor={dialog.index === null ? emptyLabor(settings?.laborRate ?? 0) : e.labor[dialog.index]}
          parts={e.parts}
          onSubmit={(labor) => setLines('labor', replaceAt(e.labor, dialog.index, labor))}
        />
      )}
      {dialog?.kind === 'print' && <PrintPreviewModal key={dialogKey} isOpen onOpenChange={onDialogOpenChange} document={{ estimate: e }} />}
      {dialog?.kind === 'accept' && (
        <ConfirmDialog key={dialogKey} isOpen onOpenChange={onDialogOpenChange} title={e.id > 0 ? `Accept estimate ${estimateNumber(e.id)}?` : 'Accept this estimate?'} confirmLabel="Create work order" tone="accent" onConfirm={() => accept(key)}>
          <p>This creates a work order with the same customer, vehicle, parts, and labor, and opens it.{dirty || e.id <= 0 ? ' Your changes to the estimate are saved first.' : ''}</p>
          <p>The estimate is then kept as it is, as the record of what was quoted.</p>
          {expired && <p className="font-medium text-warning">It expired on {formatDate(e.validUntil)}, so check that prices are still right.</p>}
        </ConfirmDialog>
      )}
      {dialog?.kind === 'close' && (
        <ConfirmDialog key={dialogKey} isOpen onOpenChange={onDialogOpenChange} title={e.id > 0 ? `Discard changes to estimate ${estimateNumber(e.id)}?` : 'Discard this new estimate?'} confirmLabel="Discard changes" onConfirm={async () => close(key)}>
          <p>Your unsaved changes will be lost.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
