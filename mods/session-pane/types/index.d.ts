export type Call = { id: string; tool: string; label: string; isDone: boolean; isError: boolean }

declare module 'claude-code' {
  interface PluginState {
    'session-pane': { files: string[]; calls: Call[] }
  }
}
