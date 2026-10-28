import { FileArrowDown, Printer } from '@gravity-ui/icons'
import { Button, Modal, Spinner, toast } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { WorkOrder } from '../../../../shared/types'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  /** The work order as it is now, including unsaved changes. */
  workOrder: WorkOrder
}

/** Shows the invoice as it will print, with Print and Save as PDF. */
export default function PrintPreviewModal({ isOpen, onOpenChange, workOrder }: Props): React.ReactElement {
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null)
  // Rendered by the main process so the preview, the printout, and the PDF are the same document.
  const { data: html } = useQuery({ queryKey: ['invoice', workOrder], queryFn: () => window.api.invoices.html(workOrder), gcTime: 0 })
  const title = workOrder.id > 0 ? `Work order #${workOrder.id}` : 'New work order'

  const print = async (): Promise<void> => {
    setBusy('print')
    try {
      if (await window.api.invoices.print(workOrder)) onOpenChange(false)
    } catch (e) {
      toast.danger(`Couldn’t print: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const savePdf = async (): Promise<void> => {
    setBusy('pdf')
    try {
      const path = await window.api.invoices.savePdf(workOrder)
      if (path) {
        toast.success('Saved the invoice as a PDF', { actionProps: { children: 'Show in folder', onPress: () => void window.api.app.showItemInFolder(path) } })
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
            <Modal.Heading>Print {workOrder.id > 0 ? `work order #${workOrder.id}` : 'new work order'}</Modal.Heading>
            {workOrder.id <= 0 && <p className="text-sm text-muted">This work order isn’t saved yet, so the invoice is marked “Draft”.</p>}
          </Modal.Header>
          <Modal.Body>
            <div className="flex h-[65vh] items-center justify-center overflow-hidden rounded-lg bg-white">{html ? <iframe title={`Invoice preview for ${title}`} srcDoc={html} sandbox="" className="size-full border-0" /> : <Spinner />}</div>
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
