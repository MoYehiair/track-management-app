import { supabase } from './supabase'

export type ChatRole = 'user' | 'assistant'

export interface ChatTurn {
  role: ChatRole
  content: string
}

export interface PendingChatAction {
  confirmation_token: string
  summary: string
}

export interface ChatResponse {
  message: string
  pending_action?: PendingChatAction
  action_completed?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (isRecord(error) && error.context instanceof Response) {
    try {
      const body: unknown = await error.context.json()
      if (isRecord(body) && typeof body.error === 'string') return body.error
    } catch {
      // Fall through to the client error message when the response is not JSON.
    }
  }
  return error instanceof Error ? error.message : 'The assistant could not respond.'
}

export function compactChatHistory(turns: ChatTurn[]): ChatTurn[] {
  return turns
    .filter((turn) => (turn.role === 'user' || turn.role === 'assistant') && turn.content.trim())
    .slice(-12)
    .map((turn) => ({ role: turn.role, content: turn.content.trim().slice(0, 800) }))
}

export async function sendCatalogChat(
  turns: ChatTurn[],
  confirmationToken?: string,
): Promise<ChatResponse> {
  if (!supabase) throw new Error('Connect Supabase before using the catalog assistant.')

  const { data, error } = await supabase.functions.invoke('catalog-chat', {
    body: {
      messages: compactChatHistory(turns),
      ...(confirmationToken ? { confirmation_token: confirmationToken } : {}),
    },
  })

  if (error) throw new Error(await getFunctionErrorMessage(error))
  if (!isRecord(data) || typeof data.message !== 'string') {
    throw new Error('The assistant returned an invalid response.')
  }

  return data as unknown as ChatResponse
}
