// Callouts: the blocks a reply marks for the person, and the colours they draw in.

export type CalloutKind = 'action' | 'ask' | 'input' | 'done'

export type Callout = {
  kind: CalloutKind
  /** The first line after the marker. */
  title: string
  /** The quoted lines under it, list items of an ASK excluded. */
  body: string[]
  /** An ASK's list items: the answers to offer. */
  options: string[]
}

/** The Devdeck theme's colours (theme.json `colors`), every token `#rrggbb`. */
export type Palette = {
  accent: string
  activity: string
  text: string
  muted: string
  line: string
  error: string
}

declare module 'claude-code' {
  interface PluginState {
    callouts: {
      /** ACTION, ASK and INPUT blocks of the last reply, until answered or dismissed. */
      open: Callout[]
      palette: Palette
    }
  }
}
