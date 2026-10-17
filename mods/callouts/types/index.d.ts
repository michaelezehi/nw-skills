// Callouts: the blocks a reply marks for the person, and the colours they draw in.

export type CalloutKind = 'action' | 'ask' | 'input' | 'secret' | 'review' | 'done'

export type Callout = {
  kind: CalloutKind
  /** The first line after the marker. */
  title: string
  /** The quoted lines under it, list items of an ASK excluded. */
  body: string[]
  /** An ASK's list items: the answers to offer. */
  options: string[]
  /** A SECRET's variable and the .env file it goes in; absent when the title names neither. */
  secret?: { name: string; path: string }
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
      /** ACTION, ASK, INPUT, SECRET and REVIEW blocks of the last reply, until answered or dismissed. */
      open: Callout[]
      palette: Palette
      /** How many characters each SECRET's field holds, by item key; never the characters. */
      typed: Record<string, number>
    }
  }
}
