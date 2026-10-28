import { CreditCard } from '@gravity-ui/icons'
import { Button, Label, ListBox, Select } from '@heroui/react'
import { useState } from 'react'
import { PAYMENT_METHODS, type Payment, type PaymentMethod } from '../../../../shared/types'
import { formatMoney, MONEY } from '../../lib/format'
import { DateInput, NumberInput } from '../fields/Fields'
import LineItemModal from './LineItemModal'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  /** The payment to edit, or a blank one (`id: 0`, amount 0) to add. */
  payment: Payment
  /** What's still owed, not counting this payment. */
  balance: number
  onSubmit: (payment: Payment) => void
}

/** Add or edit a payment. Mount with a new `key` each time it opens. */
export default function PaymentFormModal({ isOpen, onOpenChange, payment, balance, onSubmit }: Props): React.ReactElement {
  const isNew = payment.id <= 0 && payment.amount === 0
  const [draft, setDraft] = useState<Payment>(payment)
  const [showErrors, setShowErrors] = useState(false)
  const amountError = draft.amount <= 0 ? 'Enter an amount more than $0.00.' : null
  const dateError = !draft.date ? 'Enter the payment date.' : null

  const submit = (): boolean => {
    setShowErrors(true)
    if (amountError || dateError) return false
    onSubmit(draft)
    return true
  }

  return (
    <LineItemModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={isNew ? 'Add payment' : 'Edit payment'}
      icon={<CreditCard className="size-5" />}
      submitLabel={isNew ? 'Add payment' : 'Save'}
      onSubmit={submit}
      footerStart={<span className="text-sm text-muted">Balance before this payment {formatMoney(balance)}</span>}
    >
      <DateInput className="col-span-3" label="Date" value={draft.date} onChange={(date) => setDraft((d) => ({ ...d, date: date ?? '' }))} error={showErrors ? dateError : null} />
      <Select className="col-span-3" variant="secondary" value={draft.method} onChange={(key) => key !== null && setDraft((d) => ({ ...d, method: key as PaymentMethod }))}>
        <Label>Method</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {PAYMENT_METHODS.map((m) => (
              <ListBox.Item key={m} id={m} textValue={m}>
                {m}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <NumberInput className="col-span-3" label="Amount" value={draft.amount} onChange={(amount) => setDraft((d) => ({ ...d, amount }))} formatOptions={MONEY} error={showErrors ? amountError : null} autoFocus />
      <div className="col-span-3 flex items-start pt-6">
        <Button size="sm" variant="tertiary" isDisabled={balance <= 0} onPress={() => setDraft((d) => ({ ...d, amount: Math.round(balance * 100) / 100 }))}>
          Pay full balance
        </Button>
      </div>
    </LineItemModal>
  )
}
