import { Person } from '@gravity-ui/icons'
import { Button, Modal } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { Customer } from '../../../../shared/types'
import { formatPhone, trimStrings } from '../../lib/format'
import { keys } from '../../lib/queryClient'
import { AutocompleteInput, StateInput, TextInput } from '../fields/Fields'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  /** The customer to edit, or one with `id: 0` to add a new customer. */
  customer: Customer
  /** Called with the saved customer. */
  onSaved: (customer: Customer) => void
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Add or edit a customer. Mount with a new `key` each time it opens so the form starts fresh. */
export default function CustomerFormModal({ isOpen, onOpenChange, customer, onSaved }: Props): React.ReactElement {
  const isNew = customer.id <= 0
  const [draft, setDraft] = useState<Customer>(customer)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const { data: suggestions } = useQuery({ queryKey: keys.customerSuggestions, queryFn: () => window.api.customers.suggestions() })

  const set =
    (field: keyof Customer) =>
    (value: string): void => {
      setDraft((d) => ({ ...d, [field]: value }))
      setError(null)
    }
  const trimmed = trimStrings(draft)
  const nameError = !trimmed.firstName && !trimmed.lastName && !trimmed.company ? 'Enter a name or a company.' : null
  const emailError = trimmed.email && !EMAIL.test(trimmed.email) ? 'Enter a valid email address, or leave it blank.' : null

  const save = async (): Promise<void> => {
    setShowErrors(true)
    if (nameError || emailError) return
    setSaving(true)
    setError(null)
    try {
      const saved = isNew ? await window.api.customers.create(trimmed) : await window.api.customers.update(trimmed)
      if (!saved) {
        setError('A customer with exactly these details already exists.')
        return
      }
      onSaved(saved)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon className="bg-default text-foreground">
              <Person className="size-5" />
            </Modal.Icon>
            <Modal.Heading>{isNew ? 'New customer' : 'Edit customer'}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form
              className="grid grid-cols-6 gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
            >
              <TextInput className="col-span-3" label="First name" value={draft.firstName} onChange={set('firstName')} error={showErrors ? nameError : null} autoFocus />
              <TextInput className="col-span-3" label="Last name" value={draft.lastName} onChange={set('lastName')} />
              <AutocompleteInput className="col-span-6" label="Company" value={draft.company} onChange={set('company')} suggestions={suggestions?.company ?? []} />
              <TextInput className="col-span-3" label="Phone" type="tel" value={draft.phone} onChange={set('phone')} transform={formatPhone} placeholder="555-555-5555" />
              <TextInput className="col-span-3" label="Email" type="email" value={draft.email} onChange={set('email')} error={showErrors ? emailError : null} />
              <AutocompleteInput className="col-span-6" label="Street address" value={draft.street} onChange={set('street')} suggestions={suggestions?.street ?? []} />
              <AutocompleteInput className="col-span-3" label="City" value={draft.city} onChange={set('city')} suggestions={suggestions?.city ?? []} />
              <StateInput className="col-span-2" value={draft.state} onChange={set('state')} />
              <AutocompleteInput className="col-span-1" label="ZIP" value={draft.zip} onChange={set('zip')} suggestions={suggestions?.zip ?? []} />
              {/* Lets Enter submit the form. */}
              <button type="submit" hidden />
            </form>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            <Button isPending={saving} onPress={save}>
              {isNew ? 'Add customer' : 'Save'}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
