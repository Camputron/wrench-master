import { Switch } from '@heroui/react'

/** A labeled on/off switch. */
export default function Toggle({ label, isSelected, onChange, className }: { label: string; isSelected: boolean; onChange: (value: boolean) => void; className?: string }): React.ReactElement {
  return (
    <Switch className={className} isSelected={isSelected} onChange={onChange}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        {label}
      </Switch.Content>
    </Switch>
  )
}
