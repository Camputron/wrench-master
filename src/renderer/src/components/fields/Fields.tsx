import { parseDate } from '@internationalized/date'
import { Calendar, ComboBox, DateField, DatePicker, Description, FieldError, Input, Label, ListBox, NumberField, TextArea, TextField } from '@heroui/react'
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

interface NumberInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  /** e.g. `{ style: 'currency', currency: 'USD' }` or `{ style: 'percent' }` */
  formatOptions?: Intl.NumberFormatOptions
  minValue?: number
  maxValue?: number
  step?: number
  description?: string
  error?: string | null
  className?: string
  autoFocus?: boolean
}

/** A labeled number field with stepper buttons. Clearing it reads as 0. */
export function NumberInput(props: NumberInputProps): React.ReactElement {
  return (
    <NumberField
      className={props.className}
      variant="secondary"
      value={props.value}
      onChange={(v) => props.onChange(Number.isFinite(v) ? v : 0)}
      formatOptions={props.formatOptions}
      minValue={props.minValue ?? 0}
      maxValue={props.maxValue}
      step={props.step}
      isInvalid={!!props.error}
      autoFocus={props.autoFocus}
      validationBehavior="aria"
    >
      <Label>{props.label}</Label>
      <NumberField.Group>
        <NumberField.DecrementButton />
        <NumberField.Input />
        <NumberField.IncrementButton />
      </NumberField.Group>
      {props.description && <Description>{props.description}</Description>}
      <FieldError>{props.error}</FieldError>
    </NumberField>
  )
}

interface DateInputProps {
  label: string
  /** `YYYY-MM-DD`, or null for no date */
  value: string | null
  onChange: (value: string | null) => void
  error?: string | null
  className?: string
  /** Keep the label for screen readers only, e.g. in a toolbar. */
  hideLabel?: boolean
}

/** A labeled date field with a calendar popover. Works in `YYYY-MM-DD` strings. */
export function DateInput({ label, value, onChange, error, className, hideLabel }: DateInputProps): React.ReactElement {
  return (
    <DatePicker className={className} value={value ? parseDate(value) : null} onChange={(d) => onChange(d ? d.toString() : null)} isInvalid={!!error} validationBehavior="aria">
      <Label className={hideLabel ? 'sr-only' : undefined}>{label}</Label>
      <DateField.Group fullWidth variant="secondary">
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <FieldError>{error}</FieldError>
      <DatePicker.Popover>
        <Calendar aria-label={label}>
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
          <Calendar.YearPickerGrid>
            <Calendar.YearPickerGridBody>{({ year }) => <Calendar.YearPickerCell year={year} />}</Calendar.YearPickerGridBody>
          </Calendar.YearPickerGrid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  )
}

/** A labeled multi-line text field. */
export function TextAreaInput(props: { label: string; value: string; onChange: (value: string) => void; rows?: number; className?: string; error?: string | null }): React.ReactElement {
  return (
    <TextField className={props.className} variant="secondary" value={props.value} onChange={props.onChange} isInvalid={!!props.error} validationBehavior="aria">
      <Label>{props.label}</Label>
      <TextArea rows={props.rows ?? 3} />
      <FieldError>{props.error}</FieldError>
    </TextField>
  )
}
