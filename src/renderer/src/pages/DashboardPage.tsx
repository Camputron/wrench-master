import { Plus } from '@gravity-ui/icons'
import { Button, Label, ListBox, Select } from '@heroui/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import IncomeChart from '../components/dashboard/IncomeChart'
import StatTile from '../components/dashboard/StatTile'
import WorkOrderSummaryTable from '../components/dashboard/WorkOrderSummaryTable'
import { useEditors } from '../editors/editorsContext'
import { useSettings } from '../hooks/useSettings'
import { formatMoney } from '../lib/format'
import { keys } from '../lib/queryClient'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function Section({ title, action, children }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** "↑ 3 vs. last month": direction is shown with an arrow and words, not color alone. */
function change(current: number, previous: number): string {
  const diff = current - previous
  if (diff === 0) return 'Same as last month'
  return `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} than last month`
}

/** The shop at a glance: headline numbers, income by month, open and recent work orders (the Java app's "My Company"). */
export default function DashboardPage(): React.ReactElement {
  const settings = useSettings()
  const { newWorkOrder } = useEditors()
  const now = new Date()
  const thisYear = now.getFullYear()
  const [year, setYear] = useState(thisYear)

  const stats = useQuery({ queryKey: keys.workOrderStats, queryFn: () => window.api.workOrders.stats() })
  const years = useQuery({ queryKey: keys.workOrderYears, queryFn: () => window.api.workOrders.years() })
  const income = useQuery({ queryKey: keys.income(year), queryFn: () => window.api.workOrders.incomeByMonth(year), placeholderData: keepPreviousData })
  const open = useQuery({ queryKey: keys.openWorkOrders, queryFn: () => window.api.workOrders.listIncomplete() })
  const recent = useQuery({ queryKey: keys.recentWorkOrders, queryFn: () => window.api.session.recentWorkOrders() })

  // Always offer this year, even before anything is completed in it.
  const yearOptions = [...new Set([thisYear, year, ...(years.data ?? [])])].sort((a, b) => b - a)
  const s = stats.data
  const company = settings?.shop.company.trim()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{company || 'Dashboard'}</h1>
          <p className="text-sm text-muted">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <Button onPress={() => newWorkOrder()}>
          <Plus className="size-4" />
          New work order
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label={`Completed in ${MONTH_NAMES[now.getMonth()]}`} value={s ? String(s.completedThisMonth) : '–'} detail={s && change(s.completedThisMonth, s.completedLastMonth)} />
        <StatTile label={`Completed in ${thisYear}`} value={s ? String(s.completedThisYear) : '–'} />
        <StatTile label="Open work orders" value={s ? String(s.openCount) : '–'} detail="Not marked completed yet" />
        <StatTile label="Unpaid balance" value={s ? formatMoney(s.unpaidTotal) : '–'} detail={s && (s.unpaidCount === 0 ? 'Everything is paid' : `Across ${s.unpaidCount} work order${s.unpaidCount === 1 ? '' : 's'}`)} />
      </div>

      <Section
        title="Income"
        action={
          <Select className="w-32" value={year} onChange={(k) => k !== null && setYear(Number(k))}>
            <Label className="sr-only">Year</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {yearOptions.map((y) => (
                  <ListBox.Item key={y} id={y} textValue={String(y)}>
                    {y}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        }
      >
        <div className="rounded-2xl bg-surface p-4">{income.data && <IncomeChart year={year} months={income.data} isRefreshing={income.isPlaceholderData} />}</div>
      </Section>

      <div className="grid gap-8 2xl:grid-cols-2">
        <Section title={`Open work orders${open.data ? ` (${open.data.length})` : ''}`}>
          <WorkOrderSummaryTable title="Open work orders" workOrders={open.data} emptyText="No open work orders." />
        </Section>
        <Section title="Recently saved">
          <WorkOrderSummaryTable title="Recently saved work orders" workOrders={recent.data} emptyText="Work orders you save show up here." />
        </Section>
      </div>
    </div>
  )
}
