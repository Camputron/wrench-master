import { addDays, ESTIMATE_VALID_DAYS } from '../../../shared/estimates'
import type { AutoPart, Customer, Estimate, Labor, Payment, Vehicle, WorkOrder, WorkOrderVehicle } from '../../../shared/types'

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

/** A blank estimate dated today, valid for the usual number of days, using the shop's default tax rate. */
export function emptyEstimate(taxRate: number, today: string): Estimate {
  const { vehicle, customer } = emptyWorkOrder(taxRate, today)
  return { id: 0, dateCreated: today, validUntil: addDays(today, ESTIMATE_VALID_DAYS), customer, vehicle, taxRate, parts: [], labor: [], status: 'open', workOrderId: null }
}

/** A saved vehicle as recorded on a work order or estimate (mileage is entered per visit). */
export const toWorkOrderVehicle = ({ vin, year, make, model, licensePlate, color, engine, transmission }: Vehicle): WorkOrderVehicle => ({
  vin,
  year,
  make,
  model,
  licensePlate,
  color,
  engine,
  transmission,
  mileageIn: '',
  mileageOut: ''
})

export const emptyPart = (): AutoPart => ({ id: 0, name: '', desc: '', retailPrice: 0, listPrice: 0, quantity: 1, taxable: true })

export const emptyLabor = (rate: number): Labor => ({ id: 0, code: '', desc: '', billedHrs: 1, rate, taxable: true })

export const emptyPayment = (today: string): Payment => ({ id: 0, date: today, method: 'Cash', amount: 0 })

/** A problem that blocks saving the estimate, or null. */
export function validateEstimate(e: Estimate): string | null {
  if (e.validUntil < e.dateCreated) return 'The valid-until date can’t be before the estimate’s date.'
  return null
}

/** A problem that blocks saving the work order, or null. */
export function validateWorkOrder(wo: WorkOrder): string | null {
  if (wo.dateCompleted && wo.dateCompleted < wo.dateCreated) return 'The completed date can’t be before the created date.'
  return null
}
