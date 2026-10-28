import type { AutoPart, Labor, WorkOrder } from './types'

export const partSubtotal = (p: AutoPart): number => p.retailPrice * p.quantity

export const laborSubtotal = (l: Labor): number => l.billedHrs * l.rate

type Totals = Pick<WorkOrder, 'parts' | 'labor' | 'payments' | 'taxRate'>

export function partsSubtotal(wo: Pick<WorkOrder, 'parts'>): number {
  return wo.parts.reduce((sum, p) => sum + partSubtotal(p), 0)
}

export function laborsSubtotal(wo: Pick<WorkOrder, 'labor'>): number {
  return wo.labor.reduce((sum, l) => sum + laborSubtotal(l), 0)
}

export function subtotal(wo: Pick<WorkOrder, 'parts' | 'labor'>): number {
  return partsSubtotal(wo) + laborsSubtotal(wo)
}

/** Tax applies only to lines marked taxable. */
export function tax(wo: Pick<WorkOrder, 'parts' | 'labor' | 'taxRate'>): number {
  const parts = wo.parts.filter((p) => p.taxable).reduce((sum, p) => sum + partSubtotal(p), 0)
  const labor = wo.labor.filter((l) => l.taxable).reduce((sum, l) => sum + laborSubtotal(l), 0)
  return (parts + labor) * wo.taxRate
}

export function bill(wo: Pick<WorkOrder, 'parts' | 'labor' | 'taxRate'>): number {
  return subtotal(wo) + tax(wo)
}

/** The same total as `bill`, from line sums already split into taxable and non-taxable amounts. */
export function billFromSums(s: { untaxed: number; taxable: number; taxRate: number }): number {
  return s.untaxed + s.taxable + s.taxable * s.taxRate
}

export function totalPayments(wo: Pick<WorkOrder, 'payments'>): number {
  return wo.payments.reduce((sum, p) => sum + p.amount, 0)
}

/**
 * What's still owed, to the cent. Rounded because payments are made against the rounded total: paying
 * $147.68 on a $147.6758 bill settles it, rather than leaving it "overpaid" by a fraction of a cent.
 */
export function balance(wo: Totals): number {
  return Math.round((bill(wo) - totalPayments(wo)) * 100) / 100 + 0
}
