import { Wrench } from '@gravity-ui/icons'
import { Button } from '@heroui/react'
import { useState } from 'react'
import { laborSubtotal } from '../../../../shared/billing'
import type { AutoPart, Labor } from '../../../../shared/types'
import { formatMoney, MONEY } from '../../lib/format'
import { NumberInput, TextAreaInput, TextInput } from '../fields/Fields'
import Toggle from '../fields/Toggle'
import LineItemModal from './LineItemModal'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  /** The labor line to edit, or a blank one (`id: 0`) to add. */
  labor: Labor
  /** The work order's parts, for "Describe from parts". */
  parts: AutoPart[]
  onSubmit: (labor: Labor) => void
}

/** Add or edit a labor line. Mount with a new `key` each time it opens. */
export default function LaborFormModal({ isOpen, onOpenChange, labor, parts, onSubmit }: Props): React.ReactElement {
  const isNew = labor.id <= 0 && !labor.code && !labor.desc
  const [draft, setDraft] = useState<Labor>(labor)
  const [showErrors, setShowErrors] = useState(false)
  const missing = !draft.desc.trim() && !draft.code.trim() ? 'Enter a description or labor code.' : null
  const hoursError = draft.billedHrs <= 0 ? 'Billed hours must be more than 0.' : null
  const partNames = parts.map((p) => p.desc || p.name).filter(Boolean)

  const submit = (): boolean => {
    setShowErrors(true)
    if (missing || hoursError) return false
    onSubmit({ ...draft, code: draft.code.trim(), desc: draft.desc.trim() })
    return true
  }

  return (
    <LineItemModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={isNew ? 'Add labor' : 'Edit labor'}
      icon={<Wrench className="size-5" />}
      submitLabel={isNew ? 'Add labor' : 'Save'}
      onSubmit={submit}
      footerStart={<span className="text-sm text-muted">Line total {formatMoney(laborSubtotal(draft))}</span>}
    >
      <TextInput className="col-span-2" label="Labor code" value={draft.code} onChange={(code) => setDraft((d) => ({ ...d, code }))} autoFocus />
      <div className="col-span-4 flex items-end justify-end">
        {/* Like the Java app's auto-generated description. */}
        <Button size="sm" variant="tertiary" isDisabled={partNames.length === 0} onPress={() => setDraft((d) => ({ ...d, desc: `Installed ${partNames.join(', ')}` }))}>
          Describe from parts
        </Button>
      </div>
      <TextAreaInput className="col-span-6" label="Description" value={draft.desc} onChange={(desc) => setDraft((d) => ({ ...d, desc }))} error={showErrors ? missing : null} />
      <NumberInput className="col-span-2" label="Billed hours" value={draft.billedHrs} onChange={(billedHrs) => setDraft((d) => ({ ...d, billedHrs }))} step={0.1} error={showErrors ? hoursError : null} />
      <NumberInput className="col-span-2" label="Rate (per hour)" value={draft.rate} onChange={(rate) => setDraft((d) => ({ ...d, rate }))} formatOptions={MONEY} />
      <div className="col-span-2 flex items-end pb-2">
        <Toggle label="Taxable" isSelected={draft.taxable} onChange={(taxable) => setDraft((d) => ({ ...d, taxable }))} />
      </div>
    </LineItemModal>
  )
}
