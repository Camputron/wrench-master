import type { AutoPart, Customer, Labor, Payment, Vehicle, WorkOrder } from '../../../shared/types'

/** A blank customer for the "new customer" form. */
export const EMPTY_CUSTOMER: Customer = { id: 0, firstName: '', lastName: '', phone: '', email: '', company: '', street: '', city: '', state: 'UNKNOWN', zip: '' }

/** A blank vehicle for the "new vehicle" form. */
export const emptyVehicle = (customerId: number): Vehicle => ({ id: 0, customerId, vin: '', year: '', make: '', model: '', licensePlate: '', color: '', engine: '', transmission: '' })

/** A blank work order dated today, using the shop's default tax rate. */
export function emptyWorkOrder(taxRate: number, today: string): WorkOrder {
  return {
    id: 0,
    dateCreated: today,
    dateCompleted: null,
    customer: EMPTY_CUSTOMER,
    vehicle: { vin: '', year: '', make: '', model: '', licensePlate: '', color: '', engine: '', transmission: '', mileageIn: '', mileageOut: '' },
    taxRate,
    dateVoided: null,
    parts: [],
    labor: [],
    payments: []
  }
}

export const emptyPart = (): AutoPart => ({ id: 0, name: '', desc: '', retailPrice: 0, listPrice: 0, quantity: 1, taxable: true })

export const emptyLabor = (rate: number): Labor => ({ id: 0, code: '', desc: '', billedHrs: 1, rate, taxable: true })

export const emptyPayment = (today: string): Payment => ({ id: 0, date: today, method: 'Cash', amount: 0 })

/** A problem that blocks saving the work order, or null. */
export function validateWorkOrder(wo: WorkOrder): string | null {
  if (wo.dateCompleted && wo.dateCompleted < wo.dateCreated) return 'The completed date can’t be before the created date.'
  return null
}
