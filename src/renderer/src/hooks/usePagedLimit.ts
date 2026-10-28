import { useCallback, useState } from 'react'

/**
 * How many results a list that loads more as you scroll should ask for. Starts at one page, grows a
 * page at a time with `loadMore`, and goes back to one page whenever `resetKey` (the search) changes.
 */
export function usePagedLimit(resetKey: string, pageSize: number): [limit: number, loadMore: () => void] {
  const [state, setState] = useState({ key: resetKey, limit: pageSize })
  // A new search starts over (adjusting state during render rather than in an effect).
  if (state.key !== resetKey) setState({ key: resetKey, limit: pageSize })
  const limit = state.key === resetKey ? state.limit : pageSize
  const loadMore = useCallback(() => setState((s) => ({ ...s, limit: s.limit + pageSize })), [pageSize])
  return [limit, loadMore]
}
