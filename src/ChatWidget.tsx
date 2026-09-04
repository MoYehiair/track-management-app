import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { sendCatalogChat, type ChatTurn, type PendingChatAction } from './lib/chat'

interface DisplayMessage extends ChatTurn {
  id: number
}

const welcomeMessage: DisplayMessage = {
  id: 1,
  role: 'assistant',
  content: 'Ask me about tracks, artists, release status, or DSP delivery. I can also distribute one of your tracks after you confirm.',
}

export function ChatWidget({
  session,
  onRequireSignIn,
  onCatalogChanged,
}: {
  session: Session | null
  onRequireSignIn: () => void
  onCatalogChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<DisplayMessage[]>([welcomeMessage])
  const [input, setInput] = useState('')
  const [pendingAction, setPendingAction] = useState<PendingChatAction | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const messageListRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(2)

  useEffect(() => {
    const list = messageListRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages, loading, pendingAction])

  useEffect(() => {
    if (!session) {
      setPendingAction(null)
      setMessages([welcomeMessage])
    }
  }, [session])

  function append(role: ChatTurn['role'], content: string) {
    setMessages((current) => [...current, { id: nextId.current++, role, content }])
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const content = input.trim()
    if (!content || loading || pendingAction) return
    if (!session) return onRequireSignIn()

    const userMessage: DisplayMessage = { id: nextId.current++, role: 'user', content }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    setError('')

    try {
      const response = await sendCatalogChat(nextMessages)
      append('assistant', response.message)
      setPendingAction(response.pending_action ?? null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The assistant could not respond.')
    } finally {
      setLoading(false)
    }
  }

  async function confirmAction() {
    if (!pendingAction || loading) return
    setLoading(true)
    setError('')
    append('user', 'Yes, go ahead.')

    try {
      const response = await sendCatalogChat(messages, pendingAction.confirmation_token)
      append('assistant', response.message)
      setPendingAction(null)
      if (response.action_completed) onCatalogChanged()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The action could not be completed.')
      setPendingAction(null)
    } finally {
      setLoading(false)
    }
  }

  function cancelAction() {
    append('user', 'No, cancel it.')
    append('assistant', 'Cancelled. Nothing was changed.')
    setPendingAction(null)
    setError('')
  }

  return (
    <aside className={open ? 'chat chat--open' : 'chat'} aria-label="Catalog assistant">
      {open && (
        <section id="catalog-chat-panel" className="chat__panel" aria-labelledby="chat-title">
          <header className="chat__header">
            <div>
              <p className="eyebrow">TOOL-ASSISTED</p>
              <h2 id="chat-title">Catalog assistant</h2>
            </div>
            <button type="button" className="chat__close" onClick={() => setOpen(false)} aria-label="Close assistant">×</button>
          </header>

          <div className="chat__messages" ref={messageListRef} aria-live="polite">
            {messages.map((message) => (
              <div className={`chat__message chat__message--${message.role}`} key={message.id}>
                <span>{message.role === 'assistant' ? 'Assistant' : 'You'}</span>
                <p>{message.content}</p>
              </div>
            ))}
            {loading && <div className="chat__thinking" role="status"><i /><i /><i /><span className="sr-only">Assistant is thinking</span></div>}
          </div>

          {error && <div className="chat__error" role="alert">{error}</div>}

          {!session ? (
            <div className="chat__signin">
              <p>Sign in to use the assistant and protect model usage.</p>
              <button className="primary-button" type="button" onClick={onRequireSignIn}>Sign in</button>
            </div>
          ) : pendingAction ? (
            <div className="chat__confirmation" role="group" aria-label="Confirm catalog action">
              <p>{pendingAction.summary}</p>
              <div>
                <button type="button" className="secondary-button" onClick={cancelAction} disabled={loading}>Cancel</button>
                <button type="button" className="primary-button" onClick={confirmAction} disabled={loading}>Confirm</button>
              </div>
            </div>
          ) : (
            <form className="chat__form" onSubmit={submit}>
              <label className="sr-only" htmlFor="chat-input">Message the catalog assistant</label>
              <textarea
                id="chat-input"
                rows={2}
                maxLength={800}
                value={input}
                disabled={loading}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
                placeholder="Which tracks are still drafts?"
              />
              <button className="chat__send" type="submit" disabled={loading || !input.trim()} aria-label="Send message">↗</button>
            </form>
          )}
          <p className="chat__disclaimer">Read tools answer from Supabase. Writes always require confirmation.</p>
        </section>
      )}

      <button
        className="chat__launcher"
        type="button"
        aria-expanded={open}
        aria-controls="catalog-chat-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">{open ? '×' : '✦'}</span>
        <span>{open ? 'Close' : 'Ask catalog'}</span>
      </button>
    </aside>
  )
}
