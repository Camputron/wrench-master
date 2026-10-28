/** State behind the `electron` mock in setup.ts. `sent` records events sent to windows (see services.emit). */
export const electronMock = {
  sent: [] as { channel: string; payload: unknown }[],
  windows: [] as unknown[]
}

electronMock.windows.push({
  webContents: { send: (channel: string, payload: unknown): void => void electronMock.sent.push({ channel, payload }) }
})
