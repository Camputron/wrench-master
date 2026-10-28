import { Gear } from '@gravity-ui/icons'
import { Button, Description, Input, Label, ListBox, Modal, NumberField, Select, Switch, TextField } from '@heroui/react'
import { useState } from 'react'
import { US_STATES } from '../../../../shared/states'
import { ZOOM_LEVELS, type Settings, type SettingsPatch, type ShopInfo, type Theme } from '../../../../shared/types'
import BackupSection from './BackupSection'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  /** Saved settings. The form edits a copy and only saves on "Save". */
  settings: Settings
}

const THEMES: { id: Theme; label: string }[] = [
  { id: 'system', label: 'Match system' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' }
]

function SelectField<K extends string | number>(props: { label: string; value: K; options: { id: K; label: string }[]; onChange: (value: K) => void; className?: string }): React.ReactElement {
  return (
    <Select className={props.className} variant="secondary" value={props.value} onChange={(key) => key !== null && props.onChange(key as K)}>
      <Label>{props.label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {props.options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

const PreferencesModal = ({ isOpen, onOpenChange, settings }: Props): React.ReactElement => {
  const [draft, setDraft] = useState<Settings>(settings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setShop = (field: keyof ShopInfo) => (value: string) => setDraft((d) => ({ ...d, shop: { ...d.shop, [field]: value } }))
  const shopField = (field: keyof ShopInfo, label: string, className?: string): React.ReactElement => (
    <TextField className={className} variant="secondary" value={draft.shop[field]} onChange={setShop(field)}>
      <Label>{label}</Label>
      <Input />
    </TextField>
  )

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      // The backup folder is changed from its own section, right away; don't put back the one the form started with.
      const patch: SettingsPatch = { ...draft }
      delete patch.backupFolder
      await window.api.settings.update(patch)
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
              <Gear className="size-5" />
            </Modal.Icon>
            <Modal.Heading>Preferences</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Shop</h3>
              <p className="text-xs text-muted">Printed at the top of every invoice.</p>
              <div className="grid grid-cols-6 gap-3">
                {shopField('company', 'Company name', 'col-span-6')}
                {shopField('invoiceTitle', 'Invoice title', 'col-span-6')}
                {shopField('street', 'Street address', 'col-span-6')}
                {shopField('city', 'City', 'col-span-3')}
                <SelectField className="col-span-2" label="State" value={draft.shop.state} options={US_STATES.map((s) => ({ id: s.key, label: s.name }))} onChange={setShop('state')} />
                {shopField('zip', 'ZIP', 'col-span-1')}
                {shopField('phone', 'Phone', 'col-span-3')}
                {shopField('repairShopId', 'Repair shop ID', 'col-span-3')}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Billing defaults</h3>
              <div className="grid grid-cols-2 gap-3">
                <NumberField variant="secondary" value={draft.laborRate} minValue={0} step={1} formatOptions={{ style: 'currency', currency: 'USD' }} onChange={(v) => setDraft((d) => ({ ...d, laborRate: v }))}>
                  <Label>Labor rate (per hour)</Label>
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                </NumberField>
                <NumberField variant="secondary" value={draft.taxRate} minValue={0} maxValue={0.99} step={0.00125} formatOptions={{ style: 'percent', maximumFractionDigits: 3 }} onChange={(v) => setDraft((d) => ({ ...d, taxRate: v }))}>
                  <Label>Sales tax</Label>
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                  <Description>Used for new work orders</Description>
                </NumberField>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Appearance</h3>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Theme" value={draft.theme} options={THEMES} onChange={(theme) => setDraft((d) => ({ ...d, theme }))} />
                <SelectField label="Interface size" value={draft.zoom} options={ZOOM_LEVELS.map((z) => ({ id: z, label: `${Math.round(z * 100)}%` }))} onChange={(zoom) => setDraft((d) => ({ ...d, zoom }))} />
              </div>
              <Switch isSelected={draft.confirmExit} onChange={(confirmExit) => setDraft((d) => ({ ...d, confirmExit }))}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  Ask before quitting
                </Switch.Content>
              </Switch>
            </section>

            <BackupSection />

            {error && <p className="text-sm text-danger">Couldn’t save preferences: {error}</p>}
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            <Button isPending={saving} onPress={save}>
              Save
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

export default PreferencesModal
