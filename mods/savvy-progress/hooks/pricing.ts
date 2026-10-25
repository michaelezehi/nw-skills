// What a model request costs. The engine reports tokens per agent, not money,
// so an agent's cost is an estimate; the session total comes from the engine.

type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

// USD per million tokens: input, output, cache read, cache write (5-minute TTL,
// 1.25x input). First match wins, so a bare family name means its newest model.
// Anthropic list prices as of 2026-10.
const PRICES: [RegExp, [number, number, number, number]][] = [
  [/(fable|mythos)-5-1/, [10, 50, 0.25, 12.5]],
  [/fable|mythos/, [10, 50, 1, 12.5]],
  [/opus-5-5/, [4, 20, 0.2, 5]],
  [/opus-4-(1|2025)|opus-3/, [15, 75, 1.5, 18.75]],
  [/opus/, [5, 25, 0.5, 6.25]],
  [/sonnet-[34]/, [3, 15, 0.3, 3.75]],
  [/sonnet/, [2, 10, 0.2, 2.5]],
  [/haiku-[34]/, [1, 5, 0.1, 1.25]],
  [/haiku/, [0.1, 0.5, 0.01, 0.125]],
]

// Claude Haiku 5.5 charges 5x on a prompt over 100K tokens.
const LONG_PROMPT = 100_000

export const priceOf = (model: string): [number, number, number, number] =>
  PRICES.find(([re]) => re.test(model.toLowerCase()))?.[1] ?? [4, 20, 0.2, 5]

export const costOf = (model: string, u: Usage): number => {
  const [i, o, r, w] = priceOf(model)
  const prompt = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)
  const scale = /haiku/i.test(model) && !/haiku-[34]/i.test(model) && prompt > LONG_PROMPT ? 5 : 1
  return (
    (scale *
      ((u.input_tokens || 0) * i +
        (u.output_tokens || 0) * o +
        (u.cache_read_input_tokens || 0) * r +
        (u.cache_creation_input_tokens || 0) * w)) /
    1e6
  )
}

// Haiku 4.5 and older have 200K; every current model has 1M.
export const windowOf = (model: string): number => (/haiku-[34]/i.test(model) ? 200_000 : 1_000_000)
