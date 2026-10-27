import { Button, Modal } from '@heroui/react'
import type { ReactNode } from 'react'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  title: string
  icon: ReactNode
  submitLabel: string
  /** Called on submit (button or Enter). Return false to keep the dialog open, e.g. when invalid. */
  onSubmit: () => boolean
  children: ReactNode
  footerStart?: ReactNode
}

/** Dialog frame shared by the part, labor, and payment forms. */
export default function LineItemModal({ isOpen, onOpenChange, title, icon, submitLabel, onSubmit, children, footerStart }: Props): React.ReactElement {
  const submit = (): void => {
    if (onSubmit()) onOpenChange(false)
  }
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon className="bg-default text-foreground">{icon}</Modal.Icon>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form
              className="grid grid-cols-6 gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              {children}
              <button type="submit" hidden />
            </form>
          </Modal.Body>
          <Modal.Footer>
            {footerStart && <div className="mr-auto">{footerStart}</div>}
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            <Button onPress={submit}>{submitLabel}</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
