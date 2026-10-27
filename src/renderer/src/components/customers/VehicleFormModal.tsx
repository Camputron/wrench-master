import { Car } from '@gravity-ui/icons'
import { Button, Modal } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { Vehicle } from '../../../../shared/types'
import { cleanVin, isCompleteVin, trimStrings } from '../../lib/format'
import { keys } from '../../lib/queryClient'
import { AutocompleteInput, TextInput } from '../fields/Fields'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  /** The vehicle to edit, or one with `id: 0` to add a vehicle to `customerId`. */
  vehicle: Vehicle
  /** Shown under the heading, e.g. the owner's name. */
  ownerName: string
  onSaved: (vehicle: Vehicle) => void
}

type DecodeState = { status: 'idle' } | { status: 'decoding' } | { status: 'done'; message: string; tone: 'success' | 'warning' | 'danger' }

const TONE_CLASS = { success: 'text-success', warning: 'text-warning', danger: 'text-danger' }

/** Add or edit a vehicle. Mount with a new `key` each time it opens so the form starts fresh. */
export default function VehicleFormModal({ isOpen, onOpenChange, vehicle, ownerName, onSaved }: Props): React.ReactElement {
  const isNew = vehicle.id <= 0
  const [draft, setDraft] = useState<Vehicle>(vehicle)
  const [decode, setDecode] = useState<DecodeState>({ status: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const { data: suggestions } = useQuery({ queryKey: keys.vehicleSuggestions, queryFn: () => window.api.vehicles.suggestions() })

  const set =
    (field: keyof Vehicle) =>
    (value: string): void => {
      setDraft((d) => ({ ...d, [field]: value }))
      setError(null)
    }
  const trimmed = trimStrings(draft)
  const vinError = trimmed.vin && !isCompleteVin(trimmed.vin) ? `A VIN has 17 characters (this one has ${trimmed.vin.length}).` : null
  const requiredError = !trimmed.vin && !trimmed.make ? 'Enter a VIN or the make.' : null

  const decodeVin = async (): Promise<void> => {
    setDecode({ status: 'decoding' })
    const result = await window.api.vehicles.decodeVin(draft.vin)
    if (!result.ok) {
      setDecode({ status: 'done', message: result.error, tone: 'danger' })
      return
    }
    // Only fill in what NHTSA knows; keep anything it left blank.
    const found = Object.fromEntries(Object.entries(result.vehicle).filter(([, v]) => v))
    setDraft((d) => ({ ...d, ...found }))
    setDecode(result.warning ? { status: 'done', message: `Filled in from NHTSA, but double-check it: ${result.warning}`, tone: 'warning' } : { status: 'done', message: 'Filled in year, make, model, engine, and transmission from NHTSA.', tone: 'success' })
  }

  const save = async (): Promise<void> => {
    setShowErrors(true)
    if (vinError || requiredError) return
    setSaving(true)
    setError(null)
    try {
      const saved = isNew ? await window.api.vehicles.create(trimmed) : await window.api.vehicles.update(trimmed)
      if (!saved) {
        setError('This customer already has a vehicle with this VIN.')
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
              <Car className="size-5" />
            </Modal.Icon>
            <Modal.Heading>{isNew ? 'New vehicle' : 'Edit vehicle'}</Modal.Heading>
            <p className="text-sm text-muted">{ownerName}</p>
          </Modal.Header>
          <Modal.Body>
            <form
              className="grid grid-cols-6 gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
            >
              <div className="col-span-6 flex items-start gap-2">
                <TextInput
                  className="flex-1"
                  inputClassName="font-mono"
                  label="VIN"
                  value={draft.vin}
                  onChange={(v) => {
                    set('vin')(v)
                    setDecode({ status: 'idle' })
                  }}
                  transform={cleanVin}
                  error={showErrors ? vinError ?? requiredError : null}
                  autoFocus
                />
                <Button className="mt-6" variant="secondary" isDisabled={!isCompleteVin(draft.vin)} isPending={decode.status === 'decoding'} onPress={decodeVin}>
                  Decode VIN
                </Button>
              </div>
              {decode.status === 'done' && <p className={`col-span-6 -mt-1 text-sm ${TONE_CLASS[decode.tone]}`}>{decode.message}</p>}
              <TextInput className="col-span-2" label="Year" value={draft.year} onChange={set('year')} transform={(v) => v.replace(/\D/g, '').slice(0, 4)} />
              <AutocompleteInput className="col-span-2" label="Make" value={draft.make} onChange={set('make')} suggestions={suggestions?.make ?? []} />
              <AutocompleteInput className="col-span-2" label="Model" value={draft.model} onChange={set('model')} suggestions={suggestions?.model ?? []} />
              <TextInput className="col-span-3" inputClassName="font-mono" label="License plate" value={draft.licensePlate} onChange={set('licensePlate')} transform={(v) => v.toUpperCase()} />
              <AutocompleteInput className="col-span-3" label="Color" value={draft.color} onChange={set('color')} suggestions={suggestions?.color ?? []} />
              <AutocompleteInput className="col-span-3" label="Engine" value={draft.engine} onChange={set('engine')} suggestions={suggestions?.engine ?? []} />
              <AutocompleteInput className="col-span-3" label="Transmission" value={draft.transmission} onChange={set('transmission')} suggestions={suggestions?.transmission ?? []} />
              <button type="submit" hidden />
            </form>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            <Button isPending={saving} onPress={save}>
              {isNew ? 'Add vehicle' : 'Save'}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
