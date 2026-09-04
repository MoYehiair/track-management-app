import { describe, expect, it } from 'vitest'
import { compactChatHistory, type ChatTurn } from './chat'

describe('compactChatHistory', () => {
  it('keeps only the latest 12 non-empty messages and trims their content', () => {
    const turns: ChatTurn[] = Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `  message ${index + 1}  `,
    }))

    const result = compactChatHistory(turns)

    expect(result).toHaveLength(12)
    expect(result[0].content).toBe('message 3')
    expect(result.at(-1)?.content).toBe('message 14')
  })

  it('caps each message at the server limit', () => {
    const result = compactChatHistory([{ role: 'user', content: 'a'.repeat(900) }])
    expect(result[0].content).toHaveLength(800)
  })
})
