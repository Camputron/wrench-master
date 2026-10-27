import { Wrench } from '@gravity-ui/icons'
import { Button, Link, Modal } from '@heroui/react'
import { useEffect, useState } from 'react'
import type { AppInfo } from '../../../../shared/types'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

const AboutModal = ({ isOpen, onOpenChange }: Props): React.ReactElement => {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    if (isOpen && !info) window.api.app.info().then(setInfo)
  }, [isOpen, info])

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
              <Wrench className="size-5" />
            </Modal.Icon>
            <Modal.Heading>Wrench Master</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3 text-sm">
            <p>Invoices and work orders for auto repair shops.</p>
            {info && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                <dt className="text-muted">Version</dt>
                <dd>{info.version}</dd>
                <dt className="text-muted">Electron</dt>
                <dd>{info.electron}</dd>
                <dt className="text-muted">Chromium</dt>
                <dd>{info.chrome}</dd>
                <dt className="text-muted">Node.js</dt>
                <dd>{info.node}</dd>
                <dt className="text-muted">Database</dt>
                <dd className="break-all select-text">{info.databasePath}</dd>
              </dl>
            )}
            <Link href="https://github.com/Camposm97/Autoshop-Invoice-Manager" target="_blank">
              Source code on GitHub
            </Link>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close">Close</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

export default AboutModal
