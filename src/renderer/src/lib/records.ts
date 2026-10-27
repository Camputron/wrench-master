import type { Customer, Vehicle } from '../../../shared/types'

/** A blank customer for the "new customer" form. */
export const EMPTY_CUSTOMER: Customer = { id: 0, firstName: '', lastName: '', phone: '', email: '', company: '', street: '', city: '', state: 'UNKNOWN', zip: '' }

/** A blank vehicle for the "new vehicle" form. */
export const emptyVehicle = (customerId: number): Vehicle => ({ id: 0, customerId, vin: '', year: '', make: '', model: '', licensePlate: '', color: '', engine: '', transmission: '' })
