import { QueryClient } from '@tanstack/react-query'

/**
 * Cache for data loaded from the main process. Everything lives on this machine, so there's no
 * reason to refetch on window focus; mutations invalidate what they change instead.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: false, staleTime: Infinity }
  }
})

/** Query keys, grouped so related queries can be invalidated together. */
export const keys = {
  customers: ['customers'] as const,
  customerSearch: (query: string) => ['customers', 'search', query] as const,
  customerSuggestions: ['customers', 'suggestions'] as const,
  vehicles: ['vehicles'] as const,
  vehiclesOf: (customerId: number) => ['vehicles', 'customer', customerId] as const,
  vehicleSuggestions: ['vehicles', 'suggestions'] as const,
  workOrders: ['workOrders'] as const,
  workOrdersOf: (customerId: number) => ['workOrders', 'customer', customerId] as const,
  // Dashboard data lives under 'workOrders' so saving or deleting a work order refreshes it.
  workOrderStats: ['workOrders', 'stats'] as const,
  workOrderYears: ['workOrders', 'years'] as const,
  income: (year: number) => ['workOrders', 'income', year] as const,
  openWorkOrders: ['workOrders', 'open'] as const,
  recentWorkOrders: ['workOrders', 'recent'] as const
}
