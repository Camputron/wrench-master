import { AlertDialog, Button } from '@heroui/react'
import { useState, type ReactNode } from 'react'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  title: string
  children: ReactNode
  confirmLabel: string
  /** Runs when confirmed. The dialog stays open (showing progress) until it settles. */
  onConfirm: () => Promise<void>
  /** 'danger' (the default) for destructive actions; 'accent' for ones that aren't, like accepting an estimate. */
  tone?: 'danger' | 'accent'
}

/** Asks before a destructive (or otherwise significant) action. */
export default function ConfirmDialog({ isOpen, onOpenChange, title, children, confirmLabel, onConfirm, tone = 'danger' }: Props): React.ReactElement {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async (): Promise<void> => {
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-[420px]">
          <AlertDialog.Header>
            <AlertDialog.Icon status={tone} />
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-2 text-sm">
            {children}
            {error && <p className="text-danger">{error}</p>}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} isPending={pending} onPress={confirm}>
              {confirmLabel}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
