import { ComboBox, Description, FieldError, Input, Label, ListBox, TextField } from '@heroui/react'
import { US_STATES } from '../../../../shared/states'

interface TextInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  /** Applied to every change, e.g. to format a phone number as it's typed. */
  transform?: (value: string) => string
  description?: string
  error?: string | null
  type?: 'text' | 'email' | 'tel'
  isRequired?: boolean
  autoFocus?: boolean
  placeholder?: string
  className?: string
  inputClassName?: string
}

/** A labeled text field styled for use inside dialogs. */
export function TextInput(props: TextInputProps): React.ReactElement {
  return (
    <TextField
      className={props.className}
      variant="secondary"
      type={props.type ?? 'text'}
      value={props.value}
      onChange={(v) => props.onChange(props.transform ? props.transform(v) : v)}
      isInvalid={!!props.error}
      isRequired={props.isRequired}
      autoFocus={props.autoFocus}
      validationBehavior="aria"
    >
      <Label>{props.label}</Label>
      <Input className={props.inputClassName} placeholder={props.placeholder} />
      {props.description && <Description>{props.description}</Description>}
      <FieldError>{props.error}</FieldError>
    </TextField>
  )
}

interface AutocompleteInputProps extends Omit<TextInputProps, 'type' | 'error'> {
  /** Values already in the database to suggest. Typing anything else is allowed. */
  suggestions: string[]
}

/** A free-text field that suggests values already used elsewhere, like the Java app's autocompletion. */
export function AutocompleteInput(props: AutocompleteInputProps): React.ReactElement {
  const items = props.suggestions.map((s) => ({ id: s, label: s }))
  return (
    <ComboBox className={props.className} variant="secondary" allowsCustomValue menuTrigger="input" inputValue={props.value} onInputChange={(v) => props.onChange(props.transform ? props.transform(v) : v)} defaultItems={items}>
      <Label>{props.label}</Label>
      <ComboBox.InputGroup>
        <Input className={props.inputClassName} placeholder={props.placeholder} />
      </ComboBox.InputGroup>
      {props.description && <Description>{props.description}</Description>}
      <ComboBox.Popover>
        <ListBox>
          {(item: { id: string; label: string }) => (
            <ListBox.Item id={item.id} textValue={item.label}>
              {item.label}
            </ListBox.Item>
          )}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  )
}

/** Searchable US state picker. The value is the stored state key (e.g. `NEW_YORK`). */
export function StateInput({ value, onChange, className }: { value: string; onChange: (key: string) => void; className?: string }): React.ReactElement {
  return (
    <ComboBox className={className} variant="secondary" selectedKey={value || 'UNKNOWN'} onSelectionChange={(key) => onChange(key === null ? 'UNKNOWN' : String(key))} defaultItems={US_STATES}>
      <Label>State</Label>
      <ComboBox.InputGroup>
        <Input />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>
          {(s: (typeof US_STATES)[number]) => (
            <ListBox.Item id={s.key} textValue={s.name}>
              {s.name}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          )}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  )
}
