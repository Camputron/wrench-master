import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { DocumentKind } from '../../../shared/types'
import { initialEditorsState, isDirty, type createEditorsReducer, type Doc, type Editor } from './editorsReducer'

/** What every kind of document editor offers (work orders and estimates add their own "open" and "new"). */
export interface DocumentEditorsApi<D extends Doc> {
  editors: Editor<D>[]
  /** The editor being shown, or null for the list. */
  active: Editor<D> | null
  /** Shows the list. */
  showList: () => void
  /** Shows an open editor. */
  show: (key: string) => void
  /** Changes the draft. Pass `record` for changes that should be undoable (lines added, edited, removed). */
  edit: (key: string, update: (draft: D) => D, record?: boolean) => void
  undo: (key: string) => void
  redo: (key: string) => void
  /** Saves the draft. Resolves to the stored document. */
  save: (key: string) => Promise<D>
  /** Replaces the document in its editor, if open, with the stored one (e.g. after voiding it). */
  reload: (doc: D) => void
  /** Closes without asking; callers confirm discarding unsaved changes first. */
  close: (key: string) => void
  /** The editor key of a saved document. */
  keyFor: (id: number) => string
}

export interface DocumentEditorsConfig<D extends Doc> {
  kind: DocumentKind
  /** e.g. "work order", for error messages. */
  noun: string
  editors: ReturnType<typeof createEditorsReducer<D>>
  get: (id: number) => Promise<D | null>
  getByIds: (ids: number[]) => Promise<D[]>
  store: (doc: D) => Promise<D>
  /** Which saved documents were open last time, and remembering them for next time. */
  openIds: () => Promise<number[]>
  setOpenIds: (ids: number[]) => Promise<void>
  /** Queries to refresh after saving. */
  queryKey: QueryKey
  /** Called when an editor should be shown, so the app can switch to its page. */
  onShow: () => void
}

/**
 * Keeps one kind of document's open editors (and their unsaved drafts) for the whole app, so switching
 * pages doesn't lose work. Reopens the ones that were open last time, and keeps the main process informed
 * about unsaved changes so quitting can warn. Also returns `open` and `openNew` for the provider to wrap.
 */
export function useDocumentEditors<D extends Doc>(config: DocumentEditorsConfig<D>): DocumentEditorsApi<D> & { open: (id: number) => Promise<void>; openNew: (draft: D) => void } {
  const { kind, noun, editors: reducers, onShow } = config
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(reducers.reducer, initialEditorsState)
  const editorsRef = useRef(state.editors)
  const configRef = useRef(config)
  useEffect(() => {
    editorsRef.current = state.editors
    configRef.current = config
  })

  // Reopen the ones that were open when the app was last closed.
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    void (async () => {
      const ids = await configRef.current.openIds()
      const docs = ids.length ? await configRef.current.getByIds(ids) : []
      for (const doc of docs) dispatch({ type: 'open', doc, activate: false })
    })()
  }, [])

  // Remember which saved ones are open.
  const openIdsKey = state.editors
    .filter((e) => reducers.isSavedKey(e.key))
    .map((e) => e.draft.id)
    .join(',')
  useEffect(() => {
    if (restoredRef.current) void configRef.current.setOpenIds(openIdsKey ? openIdsKey.split(',').map(Number) : [])
  }, [openIdsKey])

  const dirtyCount = state.editors.filter(isDirty).length
  useEffect(() => {
    void window.api.app.setUnsavedChanges(kind, dirtyCount)
  }, [kind, dirtyCount])

  const open = useCallback(
    async (id: number) => {
      onShow()
      const key = reducers.keyFor(id)
      if (editorsRef.current.some((e) => e.key === key)) {
        dispatch({ type: 'activate', key })
        return
      }
      const doc = await configRef.current.get(id)
      if (doc) dispatch({ type: 'open', doc, activate: true })
    },
    [onShow, reducers]
  )

  const save = useCallback(
    async (key: string) => {
      const editor = editorsRef.current.find((e) => e.key === key)
      if (!editor) throw new Error(`This ${noun} is no longer open.`)
      const stored = await configRef.current.store(editor.draft)
      dispatch({ type: 'saved', key, doc: stored })
      await queryClient.invalidateQueries({ queryKey: configRef.current.queryKey })
      return stored
    },
    [queryClient, noun]
  )

  return useMemo(
    () => ({
      editors: state.editors,
      active: state.editors.find((e) => e.key === state.active) ?? null,
      showList: () => dispatch({ type: 'activate', key: null }),
      show: (key: string) => dispatch({ type: 'activate', key }),
      open,
      openNew: (draft: D) => {
        dispatch({ type: 'openNew', draft })
        onShow()
      },
      edit: (key: string, update: (draft: D) => D, record = false) => dispatch({ type: 'edit', key, update, record }),
      undo: (key: string) => dispatch({ type: 'undo', key }),
      redo: (key: string) => dispatch({ type: 'redo', key }),
      save,
      reload: (doc: D) => dispatch({ type: 'reload', doc }),
      close: (key: string) => dispatch({ type: 'close', key }),
      keyFor: reducers.keyFor
    }),
    [state, open, save, onShow, reducers]
  )
}
