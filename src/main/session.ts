import { JsonFile } from './jsonFile'

interface SessionData {
  recentWorkOrderIds: number[]
  openWorkOrderIds: number[]
  openEstimateIds: number[]
}

const MAX_RECENT = 10

const ids = (value: unknown): number[] => (Array.isArray(value) ? value.filter((v): v is number => Number.isInteger(v) && v > 0) : [])

/** App state that survives restarts: recently saved and currently open work orders, and open estimates. */
export class SessionStore {
  private file: JsonFile<SessionData>
  private data: SessionData

  constructor(path: string) {
    this.file = new JsonFile(path)
    const saved = this.file.read()
    this.data = { recentWorkOrderIds: ids(saved?.recentWorkOrderIds), openWorkOrderIds: ids(saved?.openWorkOrderIds), openEstimateIds: ids(saved?.openEstimateIds) }
  }

  recentWorkOrderIds(): number[] {
    return this.data.recentWorkOrderIds
  }

  openWorkOrderIds(): number[] {
    return this.data.openWorkOrderIds
  }

  openEstimateIds(): number[] {
    return this.data.openEstimateIds
  }

  setOpenEstimates(openIds: number[]): void {
    this.data.openEstimateIds = [...new Set(ids(openIds))]
    this.save()
  }

  /** Forgets a deleted estimate. */
  forgetEstimate(id: number): void {
    this.data.openEstimateIds = this.data.openEstimateIds.filter((x) => x !== id)
    this.save()
  }

  /** Moves the work order to the front of the recent list. */
  addRecent(id: number): void {
    this.data.recentWorkOrderIds = [id, ...this.data.recentWorkOrderIds.filter((x) => x !== id)].slice(0, MAX_RECENT)
    this.save()
  }

  /** Forgets a deleted work order. */
  forget(id: number): void {
    this.data.recentWorkOrderIds = this.data.recentWorkOrderIds.filter((x) => x !== id)
    this.data.openWorkOrderIds = this.data.openWorkOrderIds.filter((x) => x !== id)
    this.save()
  }

  setOpen(openIds: number[]): void {
    this.data.openWorkOrderIds = [...new Set(ids(openIds))]
    this.save()
  }

  /** Clears everything, e.g. after the database is replaced and old ids no longer apply. */
  clear(): void {
    this.data = { recentWorkOrderIds: [], openWorkOrderIds: [], openEstimateIds: [] }
    this.save()
  }

  private save(): void {
    this.file.write(this.data)
  }
}
