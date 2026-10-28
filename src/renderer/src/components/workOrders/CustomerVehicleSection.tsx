import { Button, toast } from '@heroui/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Customer, WorkOrderVehicle } from '../../../../shared/types'
import { cleanVin, customerName, formatPhone, isCompleteVin, vehicleName } from '../../lib/format'
import { keys } from '../../lib/queryClient'
import { AutocompleteInput, StateInput, TextInput } from '../fields/Fields'
import { CustomerPickerModal, VehiclePickerModal } from './PickerModals'

/** A work order or estimate: both record a copy of the customer and vehicle. */
interface WithCustomerAndVehicle {
  customer: Customer
  vehicle: WorkOrderVehicle
}

interface Props<T extends WithCustomerAndVehicle> {
  doc: T
  /** Updates the draft (not recorded for undo; these are typing edits). */
  onChange: (update: (doc: T) => T) => void
  /** Estimates only record the mileage when the car came in. */
  hideMileageOut?: boolean
}

function Card({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex gap-2">{actions}</div>
      </div>
      {children}
    </section>
  )
}

/**
 * The customer and vehicle as recorded on this work order or estimate. Choosing a saved customer or vehicle
 * copies its details here; edits here only change this document unless saved back to the customer's record.
 */
export default function CustomerVehicleSection<T extends WithCustomerAndVehicle>({ doc, onChange, hideMileageOut = false }: Props<T>): React.ReactElement {
  const queryClient = useQueryClient()
  const [picker, setPicker] = useState<'customer' | 'vehicle' | null>(null)
  const [busy, setBusy] = useState<'customer' | 'vehicle' | 'decode' | null>(null)
  const { customer, vehicle } = doc
  const { data: customerSuggestions } = useQuery({ queryKey: keys.customerSuggestions, queryFn: () => window.api.customers.suggestions() })
  const { data: vehicleSuggestions } = useQuery({ queryKey: keys.vehicleSuggestions, queryFn: () => window.api.vehicles.suggestions() })

  const setCustomer = (field: keyof Customer) => (value: string) => onChange((wo) => ({ ...wo, customer: { ...wo.customer, [field]: value } }))
  const setVehicle = (field: keyof WorkOrderVehicle) => (value: string) => onChange((wo) => ({ ...wo, vehicle: { ...wo.vehicle, [field]: value } }))
  const hasCustomerInfo = !!(customer.firstName.trim() || customer.lastName.trim() || customer.company.trim())
  const hasVehicleInfo = !!(vehicle.vin.trim() || vehicle.make.trim())

  /** Java's "Update Customer": save these details to the customer's record, adding a new customer if needed. */
  const saveCustomer = async (): Promise<void> => {
    setBusy('customer')
    try {
      if (customer.id > 0) {
        await window.api.customers.update(customer)
        toast.success(`Updated ${customerName(customer)}’s record`)
      } else {
        const created = await window.api.customers.create(customer)
        if (!created) {
          toast.warning('A customer with exactly these details already exists. Use Choose customer to pick them.')
          return
        }
        onChange((wo) => ({ ...wo, customer: { ...wo.customer, id: created.id } }))
        toast.success(`Added ${customerName(created)} to customers`)
      }
      await queryClient.invalidateQueries({ queryKey: keys.customers })
    } catch (e) {
      toast.danger(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  /** Java's "Add Vehicle": save this vehicle to the customer's vehicles. */
  const saveVehicle = async (): Promise<void> => {
    setBusy('vehicle')
    try {
      const { vin, year, make, model, licensePlate, color, engine, transmission } = vehicle
      const created = await window.api.vehicles.create({ id: 0, customerId: customer.id, vin, year, make, model, licensePlate, color, engine, transmission })
      if (created) {
        toast.success(`Added ${vehicleName(vehicle)} to ${customerName(customer)}’s vehicles`)
        await queryClient.invalidateQueries({ queryKey: keys.vehicles })
      } else toast.warning('This customer already has a vehicle with this VIN.')
    } catch (e) {
      toast.danger(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const decodeVin = async (): Promise<void> => {
    setBusy('decode')
    const result = await window.api.vehicles.decodeVin(vehicle.vin)
    setBusy(null)
    if (!result.ok) {
      toast.danger(result.error)
      return
    }
    const found = Object.fromEntries(Object.entries(result.vehicle).filter(([, v]) => v))
    onChange((wo) => ({ ...wo, vehicle: { ...wo.vehicle, ...found } }))
    if (result.warning) toast.warning(`Filled in from NHTSA, but double-check it: ${result.warning}`)
    else toast.success('Filled in the vehicle details from NHTSA')
  }

  return (
    <>
      <Card
        title="Customer"
        actions={
          <>
            <Button size="sm" variant="secondary" onPress={() => setPicker('customer')}>
              Choose customer…
            </Button>
            <Button size="sm" variant="tertiary" isDisabled={!hasCustomerInfo} isPending={busy === 'customer'} onPress={saveCustomer}>
              {customer.id > 0 ? 'Update customer record' : 'Save as new customer'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-6 gap-3">
          <TextInput className="col-span-2" label="First name" value={customer.firstName} onChange={setCustomer('firstName')} />
          <TextInput className="col-span-2" label="Last name" value={customer.lastName} onChange={setCustomer('lastName')} />
          <AutocompleteInput className="col-span-2" label="Company" value={customer.company} onChange={setCustomer('company')} suggestions={customerSuggestions?.company ?? []} />
          <TextInput className="col-span-2" label="Phone" type="tel" value={customer.phone} onChange={setCustomer('phone')} transform={formatPhone} />
          <TextInput className="col-span-4" label="Email" type="email" value={customer.email} onChange={setCustomer('email')} />
          <AutocompleteInput className="col-span-6" label="Billing address" value={customer.street} onChange={setCustomer('street')} suggestions={customerSuggestions?.street ?? []} />
          <AutocompleteInput className="col-span-3" label="City" value={customer.city} onChange={setCustomer('city')} suggestions={customerSuggestions?.city ?? []} />
          <StateInput className="col-span-2" value={customer.state} onChange={setCustomer('state')} />
          <AutocompleteInput className="col-span-1" label="ZIP" value={customer.zip} onChange={setCustomer('zip')} suggestions={customerSuggestions?.zip ?? []} />
        </div>
      </Card>

      <Card
        title="Vehicle"
        actions={
          <>
            <Button size="sm" variant="secondary" isDisabled={customer.id <= 0} onPress={() => setPicker('vehicle')}>
              Choose vehicle…
            </Button>
            <Button size="sm" variant="tertiary" isDisabled={customer.id <= 0 || !hasVehicleInfo} isPending={busy === 'vehicle'} onPress={saveVehicle}>
              Add to customer’s vehicles
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-4 flex items-end gap-2">
            <TextInput className="flex-1" inputClassName="font-mono" label="VIN" value={vehicle.vin} onChange={setVehicle('vin')} transform={cleanVin} />
            <Button variant="secondary" isDisabled={!isCompleteVin(vehicle.vin)} isPending={busy === 'decode'} onPress={decodeVin}>
              Decode VIN
            </Button>
          </div>
          <TextInput className="col-span-2" inputClassName="font-mono" label="License plate" value={vehicle.licensePlate} onChange={setVehicle('licensePlate')} transform={(v) => v.toUpperCase()} />
          <TextInput className="col-span-1" label="Year" value={vehicle.year} onChange={setVehicle('year')} transform={(v) => v.replace(/\D/g, '').slice(0, 4)} />
          <AutocompleteInput className="col-span-2" label="Make" value={vehicle.make} onChange={setVehicle('make')} suggestions={vehicleSuggestions?.make ?? []} />
          <AutocompleteInput className="col-span-2" label="Model" value={vehicle.model} onChange={setVehicle('model')} suggestions={vehicleSuggestions?.model ?? []} />
          <AutocompleteInput className="col-span-1" label="Color" value={vehicle.color} onChange={setVehicle('color')} suggestions={vehicleSuggestions?.color ?? []} />
          <AutocompleteInput className="col-span-2" label="Engine" value={vehicle.engine} onChange={setVehicle('engine')} suggestions={vehicleSuggestions?.engine ?? []} />
          <AutocompleteInput className="col-span-2" label="Transmission" value={vehicle.transmission} onChange={setVehicle('transmission')} suggestions={vehicleSuggestions?.transmission ?? []} />
          <TextInput className={hideMileageOut ? 'col-span-2' : 'col-span-1'} label={hideMileageOut ? 'Mileage' : 'Mileage in'} value={vehicle.mileageIn} onChange={setVehicle('mileageIn')} transform={(v) => v.replace(/\D/g, '').slice(0, 9)} />
          {!hideMileageOut && <TextInput className="col-span-1" label="Mileage out" value={vehicle.mileageOut} onChange={setVehicle('mileageOut')} transform={(v) => v.replace(/\D/g, '').slice(0, 9)} />}
        </div>
      </Card>

      {picker === 'customer' && <CustomerPickerModal isOpen onOpenChange={(open) => !open && setPicker(null)} onPick={(picked) => onChange((wo) => ({ ...wo, customer: picked }))} />}
      {picker === 'vehicle' && (
        <VehiclePickerModal
          isOpen
          customer={customer}
          onOpenChange={(open) => !open && setPicker(null)}
          onPick={({ vin, year, make, model, licensePlate, color, engine, transmission }) => onChange((wo) => ({ ...wo, vehicle: { ...wo.vehicle, vin, year, make, model, licensePlate, color, engine, transmission } }))}
        />
      )}
    </>
  )
}
