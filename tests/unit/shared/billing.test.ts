import { describe, expect, it } from 'vitest'
import { balance, bill, billFromSums, laborsSubtotal, partsSubtotal, subtotal, tax, totalPayments } from '../../../src/shared/billing'
import type { AutoPart, Labor, Payment } from '../../../src/shared/types'

const part = (retailPrice: number, quantity: number, taxable: boolean): AutoPart => ({ id: 0, name: '', desc: '', retailPrice, listPrice: 0, quantity, taxable })
const labor = (billedHrs: number, rate: number, taxable: boolean): Labor => ({ id: 0, code: '', desc: '', billedHrs, rate, taxable })
const pay = (amount: number): Payment => ({ id: 0, date: '2026-01-01', method: 'Cash', amount })

describe('billing', () => {
  const wo = { parts: [part(45, 2, true), part(10, 1, false)], labor: [labor(1.5, 90, true)], payments: [pay(100), pay(50)], taxRate: 0.08625 }

  it('totals parts and labor separately and together', () => {
    expect(partsSubtotal(wo)).toBe(100)
    expect(laborsSubtotal(wo)).toBe(135)
    expect(subtotal(wo)).toBe(235)
  })

  it('taxes only taxable lines', () => {
    expect(tax(wo)).toBeCloseTo(225 * 0.08625, 10)
    expect(bill(wo)).toBeCloseTo(235 + 225 * 0.08625, 10)
  })

  it('subtracts payments for the balance, to the cent, which can go negative when overpaid', () => {
    expect(totalPayments(wo)).toBe(150)
    expect(balance(wo)).toBe(Math.round((bill(wo) - 150) * 100) / 100)
    expect(balance({ ...wo, payments: [pay(1000)] })).toBeLessThan(0)
    // Paying the rounded total settles it exactly (not "overpaid" by a fraction of a cent, and never -0).
    const rounded = Math.round(bill(wo) * 100) / 100
    expect(bill(wo)).not.toBe(rounded)
    expect(Object.is(balance({ ...wo, payments: [pay(rounded)] }), 0)).toBe(true)
  })

  it('handles an empty work order', () => {
    const empty = { parts: [], labor: [], payments: [], taxRate: 0.1 }
    expect(bill(empty)).toBe(0)
    expect(balance(empty)).toBe(0)
  })

  it('billFromSums matches bill for the same lines', () => {
    expect(billFromSums({ untaxed: 10, taxable: 225, taxRate: 0.08625 })).toBeCloseTo(bill(wo), 10)
  })
})
