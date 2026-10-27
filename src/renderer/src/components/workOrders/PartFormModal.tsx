import { Gear } from '@gravity-ui/icons'
import { ComboBox, Description, Input, Label, ListBox } from '@heroui/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { partSubtotal } from '../../../../shared/billing'
import type { AutoPart, PartSuggestion } from '../../../../shared/types'
import { formatMoney, MONEY } from '../../lib/format'
import { suggestPartNumber } from '../../lib/partNumber'
import { NumberInput, TextInput } from '../fields/Fields'
import Toggle from '../fields/Toggle'
import LineItemModal from './LineItemModal'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  /** The part to edit, or a blank one (`id: 0`) to add. */
  part: AutoPart
  onSubmit: (part: AutoPart) => void
}

/** Add or edit a part line. Mount with a new `key` each time it opens. */
export default function PartFormModal({ isOpen, onOpenChange, part, onSubmit }: Props): React.ReactElement {
  const queryClient = useQueryClient()
  const isNew = part.id <= 0 && !part.name && !part.desc
  const [draft, setDraft] = useState<AutoPart>(part)
  // Suggest a part number from the description until the user types their own.
  const [numberEdited, setNumberEdited] = useState(part.name !== '')
  const [showErrors, setShowErrors] = useState(false)
  // The catalog is small, so load it once and let the field filter it by description as you type.
  const { data: catalog = [] } = useQuery({ queryKey: ['parts', 'catalog'], queryFn: () => window.api.parts.search('', 2000) })

  const setDesc = (desc: string): void => setDraft((d) => ({ ...d, desc, name: numberEdited ? d.name : suggestPartNumber(desc) }))
  const pick = (s: PartSuggestion): void => {
    setDraft((d) => ({ ...d, ...s, quantity: d.quantity || 1 }))
    setNumberEdited(true)
  }
  const missing = !draft.desc.trim() && !draft.name.trim() ? 'Enter a description or part number.' : null
  const qtyError = draft.quantity < 1 || !Number.isInteger(draft.quantity) ? 'Quantity must be a whole number, at least 1.' : null

  const submit = (): boolean => {
    setShowErrors(true)
    if (missing || qtyError) return false
    const result = { ...draft, name: draft.name.trim(), desc: draft.desc.trim() }
    // Like the Java app, every part used goes into the catalog for next time.
    void window.api.parts.remember({ name: result.name, desc: result.desc, retailPrice: result.retailPrice, listPrice: result.listPrice, quantity: 1, taxable: result.taxable }).then(() => queryClient.invalidateQueries({ queryKey: ['parts'] }))
    onSubmit(result)
    return true
  }

  return (
    <LineItemModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={isNew ? 'Add part' : 'Edit part'}
      icon={<Gear className="size-5" />}
      submitLabel={isNew ? 'Add part' : 'Save'}
      onSubmit={submit}
      footerStart={<span className="text-sm text-muted">Line total {formatMoney(partSubtotal(draft))}</span>}
    >
      <ComboBox
        className="col-span-6"
        variant="secondary"
        allowsCustomValue
        menuTrigger="input"
        inputValue={draft.desc}
        onInputChange={setDesc}
        defaultItems={catalog}
        onSelectionChange={(key) => {
          const found = catalog.find((c) => c.name === key)
          if (found) pick(found)
        }}
        isInvalid={showErrors && !!missing}
        autoFocus
      >
        <Label>Description</Label>
        <ComboBox.InputGroup>
          <Input placeholder="e.g. Brake pads front" />
        </ComboBox.InputGroup>
        <Description>{showErrors && missing ? <span className="text-danger">{missing}</span> : 'Type to search parts you’ve used before.'}</Description>
        <ComboBox.Popover>
          <ListBox>
            {(s: PartSuggestion) => (
              <ListBox.Item id={s.name} textValue={s.desc}>
                <div className="flex w-full justify-between gap-4">
                  <span>{s.desc}</span>
                  <span className="text-muted tabular-nums">
                    {s.name} · {formatMoney(s.retailPrice)}
                  </span>
                </div>
              </ListBox.Item>
            )}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>
      <TextInput
        className="col-span-3"
        inputClassName="font-mono"
        label="Part number"
        value={draft.name}
        onChange={(name) => {
          setNumberEdited(true)
          setDraft((d) => ({ ...d, name }))
        }}
        transform={(v) => v.toUpperCase()}
      />
      <NumberInput className="col-span-3" label="Quantity" value={draft.quantity} onChange={(quantity) => setDraft((d) => ({ ...d, quantity }))} minValue={1} step={1} error={showErrors ? qtyError : null} />
      <NumberInput className="col-span-3" label="Price (each)" value={draft.retailPrice} onChange={(retailPrice) => setDraft((d) => ({ ...d, retailPrice }))} formatOptions={MONEY} description="What the customer pays" />
      <NumberInput className="col-span-3" label="Cost (each)" value={draft.listPrice} onChange={(listPrice) => setDraft((d) => ({ ...d, listPrice }))} formatOptions={MONEY} description="What the shop paid (not printed)" />
      <Toggle className="col-span-6" label="Taxable" isSelected={draft.taxable} onChange={(taxable) => setDraft((d) => ({ ...d, taxable }))} />
    </LineItemModal>
  )
}
