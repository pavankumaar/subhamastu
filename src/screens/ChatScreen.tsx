import { AlertTriangle, ArrowUp } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { executeAssistantQuery, fetchAssistantHistory } from '../ai/weddingAssistantEngine'
import { PageHeader } from '../components/ScreenChrome'
import { useWedding } from '../context/useWedding'

interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
  failed?: boolean
}

const quickPrompts = ['Add a task', 'Create payment reminder', 'Suggest next steps'] as const
const sessionStorageKey = 'subhamastu.assistant.session-id'

function createId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`
}

function getOrCreateSessionId() {
  const existing = window.localStorage.getItem(sessionStorageKey)?.trim()
  if (existing) {
    return existing
  }
  const generated = `session-${createId()}`
  window.localStorage.setItem(sessionStorageKey, generated)
  return generated
}

export function ChatScreen() {
  const { replaceData } = useWedding()
  const [sessionId, setSessionId] = useState(getOrCreateSessionId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isWorking, setWorking] = useState(false)
  const [isHistoryLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let isMounted = true
    fetchAssistantHistory(sessionId)
      .then((history) => {
        if (!isMounted) return
        setMessages(history.map((entry) => ({ id: entry.id ?? createId(), role: entry.role, text: entry.text })))
        setHistoryError('')
      })
      .catch((error: unknown) => {
        if (!isMounted) return
        setHistoryError(error instanceof Error ? error.message : 'Unable to load conversation history.')
      })
      .finally(() => {
        if (isMounted) setHistoryLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [sessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isWorking])

  async function submitText(text: string) {
    const query = text.trim()
    if (!query || isWorking) {
      return
    }

    setInput('')
    setMessages((current) => [...current, { id: createId(), role: 'user', text: query }])
    setWorking(true)

    const result = await executeAssistantQuery(query, { sessionId })
    if (result.state) {
      replaceData(result.state)
    }
    if (result.sessionId && result.sessionId !== sessionId) {
      window.localStorage.setItem(sessionStorageKey, result.sessionId)
      setSessionId(result.sessionId)
    }

    setMessages((current) => [
      ...current,
      { id: createId(), role: 'assistant', text: result.reply, failed: result.failed },
    ])
    setWorking(false)
    inputRef.current?.focus()
  }

  function submitQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitText(input)
  }

  const showWelcome = !isHistoryLoading && messages.length === 0

  return (
    <section className="screen-animate flex min-h-0 flex-1 flex-col">
      <PageHeader kicker="Concierge" title="Kalyana Mitra" rightMeta="AI Assistant" />

      <div className="clean-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-1 pb-4">
        {isHistoryLoading ? (
          <p className="py-6 text-center text-xs text-muted-taupe">Loading conversation…</p>
        ) : null}

        {historyError ? (
          <div className="flex items-start gap-2 rounded-2xl border border-blush-deep/30 bg-blush-soft px-4 py-3 text-xs text-blush-deep">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{historyError}</span>
          </div>
        ) : null}

        {showWelcome ? (
          <div className="flex justify-start">
            <div className="max-w-[82%] rounded-2xl rounded-bl-sm border border-brass-line bg-silk px-4 py-3 text-xs leading-relaxed text-charcoal shadow-soft">
              Namaskaram. I am Kalyana Mitra. Ask me to add a task, log a payment reminder, or
              suggest next steps for your Muhurtham.
            </div>
          </div>
        ) : null}

        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                message.role === 'user'
                  ? 'rounded-br-sm bg-charcoal text-ivory'
                  : message.failed
                    ? 'rounded-bl-sm border border-blush-deep/30 bg-blush-soft text-blush-deep'
                    : 'rounded-bl-sm border border-brass-line bg-silk text-charcoal shadow-soft'
              }`}
            >
              {message.failed ? (
                <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider">
                  <AlertTriangle className="h-3 w-3" />
                  Could not reach Mitra
                </span>
              ) : null}
              {message.text}
            </div>
          </div>
        ))}

        {isWorking ? (
          <div className="flex justify-start" aria-live="polite" aria-label="Kalyana Mitra is typing">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-brass-line bg-silk px-4 py-3.5 shadow-soft">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-champagne [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-champagne [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-champagne" />
            </div>
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 space-y-2.5 border-t border-brass-line/70 px-1 pb-3 pt-2.5">
        <div className="clean-scroll flex gap-1.5 overflow-x-auto">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isWorking}
              onClick={() => void submitText(prompt)}
              className="whitespace-nowrap rounded-full border border-brass-line bg-silk px-3 py-1.5 text-[11px] text-charcoal disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form onSubmit={submitQuery} className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask Kalyana Mitra..."
            maxLength={2000}
            className="flex-1 rounded-full bg-silk px-4 py-2.5 text-xs"
          />
          <button
            type="submit"
            disabled={isWorking || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sindoor text-white disabled:opacity-50"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </div>
    </section>
  )
}
