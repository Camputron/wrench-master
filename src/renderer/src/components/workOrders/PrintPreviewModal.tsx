import { FileArrowDown, Printer } from '@gravity-ui/icons'
import { Button, Modal, Spinner, toast } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { Estimate, WorkOrder } from '../../../../shared/types'
import { estimateNumber } from '../../../../shared/estimates'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  /** The work order or estimate as it is now, including unsaved changes. */
  document: { workOrder: WorkOrder } | { estimate: Estimate }
}

/** How to render, print, and save each kind of document, and what to call it. */
function describe(document: Props['document']): { title: string; isNew: boolean; noun: string; html: () => Promise<string>; print: () => Promise<boolean>; savePdf: () => Promise<string | null> } {
  if ('estimate' in document) {
    const e = document.estimate
    return { title: e.id > 0 ? `estimate ${estimateNumber(e.id)}` : 'new estimate', isNew: e.id <= 0, noun: 'estimate', html: () => window.api.estimates.html(e), print: () => window.api.estimates.print(e), savePdf: () => window.api.estimates.savePdf(e) }
  }
  const wo = document.workOrder
  return { title: wo.id > 0 ? `work order #${wo.id}` : 'new work order', isNew: wo.id <= 0, noun: 'invoice', html: () => window.api.invoices.html(wo), print: () => window.api.invoices.print(wo), savePdf: () => window.api.invoices.savePdf(wo) }
}

/** Shows the invoice (or estimate) as it will print, with Print and Save as PDF. */
export default function PrintPreviewModal({ isOpen, onOpenChange, document }: Props): React.ReactElement {
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null)
  const doc = describe(document)
  // Rendered by the main process so the preview, the printout, and the PDF are the same document.
  const { data: html } = useQuery({ queryKey: ['printable', document], queryFn: doc.html, gcTime: 0 })

  const print = async (): Promise<void> => {
    setBusy('print')
    try {
      if (await doc.print()) onOpenChange(false)
    } catch (e) {
      toast.danger(`Couldn’t print: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const savePdf = async (): Promise<void> => {
    setBusy('pdf')
    try {
      const path = await doc.savePdf()
      if (path) {
        toast.success(`Saved the ${doc.noun} as a PDF`, { actionProps: { children: 'Show in folder', onPress: () => void window.api.app.showItemInFolder(path) } })
        onOpenChange(false)
      }
    } catch (e) {
      toast.danger(`Couldn’t save the PDF: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog className="sm:max-w-[9.5in]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon className="bg-default text-foreground">
              <Printer className="size-5" />
            </Modal.Icon>
            <Modal.Heading>Print {doc.title}</Modal.Heading>
            {doc.isNew && <p className="text-sm text-muted">This {doc.noun === 'invoice' ? 'work order' : 'estimate'} isn’t saved yet, so it’s marked “Draft”.</p>}
          </Modal.Header>
          <Modal.Body>
            <div className="flex h-[65vh] items-center justify-center overflow-hidden rounded-lg bg-white">{html ? <iframe title={`Preview of ${doc.title}`} srcDoc={html} sandbox="" className="size-full border-0" /> : <Spinner />}</div>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            <Button variant="secondary" isDisabled={!html || busy !== null} isPending={busy === 'pdf'} onPress={savePdf}>
              <FileArrowDown className="size-4" />
              Save as PDF…
            </Button>
            <Button isDisabled={!html || busy !== null} isPending={busy === 'print'} onPress={print}>
              <Printer className="size-4" />
              Print…
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
