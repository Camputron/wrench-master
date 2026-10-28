import { Button, toast } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

/** Preferences › Backups. These take effect right away rather than on Save. */
export default function BackupSection(): React.ReactElement {
  const status = useQuery({ queryKey: ['backups'], queryFn: () => window.api.backups.status(), staleTime: 0 })
  const [backingUp, setBackingUp] = useState(false)
  const s = status.data

  const run = async (what: string, action: () => Promise<unknown>): Promise<void> => {
    try {
      await action()
    } catch (e) {
      toast.danger(`Couldn’t ${what}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      await status.refetch()
    }
  }
  const backUpNow = async (): Promise<void> => {
    setBackingUp(true)
    await run('back up', async () => {
      const path = await window.api.backups.backUpNow()
      toast.success('Backed up your data', { actionProps: { children: 'Show in folder', onPress: () => void window.api.app.showItemInFolder(path) } })
    })
    setBackingUp(false)
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Backups</h3>
      <p className="text-xs text-muted">
        Your data is backed up once a day, and the last 14 daily backups are kept. Backups you make yourself, and the ones saved before an import or a restore, are kept until you delete them. A folder on another drive, or one that cloud storage syncs, also
        protects you if this computer is lost or breaks.
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-default/50 p-3 text-sm">
        <dt className="text-muted">Folder</dt>
        <dd className="break-all select-text">
          {s?.folder ?? '…'}
          {s?.isDefault && <span className="text-muted"> (default)</span>}
        </dd>
        <dt className="text-muted">Last backup</dt>
        <dd>{s ? (s.last ? new Date(s.last.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'None yet') : '…'}</dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" isPending={backingUp} onPress={backUpNow}>
          Back up now
        </Button>
        <Button size="sm" variant="secondary" onPress={() => run('change the backup folder', () => window.api.backups.chooseFolder())}>
          Change folder…
        </Button>
        {s && !s.isDefault && (
          <Button size="sm" variant="ghost" onPress={() => run('change the backup folder', () => window.api.settings.update({ backupFolder: '' }))}>
            Use default folder
          </Button>
        )}
        <Button size="sm" variant="ghost" onPress={() => run('open the backup folder', () => window.api.backups.showFolder())}>
          Show backups
        </Button>
        <Button size="sm" variant="ghost" onPress={() => run('restore', () => window.api.backups.restore())}>
          Restore from backup…
        </Button>
      </div>
    </section>
  )
}
