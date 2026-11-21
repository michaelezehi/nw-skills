// Readout: a reply's run of `**label:** text` lines, drawn as one framed table.

export type Row = {
  label: string
  /** The text after the label, wrapped source lines joined with a space. */
  text: string
  /** The lines as written, so a lone row goes back to the engine untouched. */
  source: string
}

export type Segment = { kind: 'markdown'; text: string } | { kind: 'readout'; rows: Row[] }

declare module 'claude-code' {
  interface PluginState {
    readout: {
      /** Cards the person opened, as `<run>-<row>` keys, per message. */
      open: string[]
    }
  }
}
