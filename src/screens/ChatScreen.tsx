import { AlertTriangle, ArrowUp, CalendarDays, Mic, RotateCcw, Sparkles, Square } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  executeAssistantQuery,
  fetchAssistantHistory,
  type AssistantCard,
} from '../ai/weddingAssistantEngine'
import { PaymentCard, TodoCard, VendorCard } from '../components/Cards'
import { PageHeader } from '../components/ScreenChrome'
import { useWedding } from '../context/useWedding'
import { useSpeechInput } from '../hooks/useSpeechInput'
import type { OpenItem } from '../navigation'
import { formatDate } from '../utils/weddingFormat'

interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
  cards: AssistantCard[]
  failed?: boolean
  retryQuery?: string
}

const quickPrompts = ['Add a task', 'Create payment reminder', 'Show vendor contacts'] as const
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

function ChatCards({ cards, onOpenItem }: { cards: AssistantCard[]; onOpenItem?: OpenItem }) {
  const { data, toggleTodo, markExpensePaid, markVendorPaid } = useWedding()
  const eventName = (id?: string) => (id ? data.guests.events.find((event) => event.id === id)?.name : undefined)

  const rendered = cards
    .map((card) => {
      const key = `${card.type}-${card.id}`
      if (card.type === 'vendor') {
        const vendor = data.vendors.find((entry) => entry.id === card.id)
        return vendor ? (
          <VendorCard
            key={key}
            vendor={vendor}
            eventName={eventName(vendor.eventId)}
            onOpen={() => onOpenItem?.('vendors', vendor.id, { tab: 'chat' })}
            onMarkPaid={() => markVendorPaid(vendor.id)}
          />
        ) : null
      }
      if (card.type === 'payment') {
        const expense = data.expenses.find((entry) => entry.id === card.id)
        return expense ? (
          <PaymentCard
            key={key}
            title={expense.title}
            subtitle={[expense.category, formatDate(expense.dueDate), eventName(expense.eventId)].filter(Boolean).join(' · ')}
            totalAmount={expense.totalAmount}
            paidAmount={expense.paidAmount}
            onOpen={() => onOpenItem?.('payments', expense.id, { tab: 'chat' })}
            onMarkPaid={() => markExpensePaid(expense.id)}
          />
        ) : null
      }
      if (card.type === 'task') {
        const todo = data.todos.find((entry) => entry.id === card.id)
        return todo ? (
          <TodoCard
            key={key}
            todo={todo}
            eventName={eventName(todo.eventId)}
            onToggle={() => toggleTodo(todo.id)}
            onOpen={() => onOpenItem?.('todos', todo.id, { tab: 'chat' })}
          />
        ) : null
      }
      const event = data.guests.events.find((entry) => entry.id === card.id)
      return event ? (
        <button
          key={key}
          type="button"
          onClick={() => onOpenItem?.('invites', event.id, { tab: 'chat' })}
          className="flex w-full items-center gap-3 rounded-2xl border border-brass-line bg-silk p-3 text-left shadow-soft"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-champagne-light text-champagne">
            <CalendarDays className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-charcoal">{event.name}</span>
            <span className="block text-xs text-muted-taupe">
              {event.date ? formatDate(event.date) : 'Date pending'} · {event.invitees.length} invitees
            </span>
          </span>
        </button>
      ) : null
    })
    .filter(Boolean)

  return rendered.length > 0 ? <div className="mt-2 space-y-2">{rendered}</div> : null
}

export function ChatScreen({ onOpenItem }: { onOpenItem?: OpenItem }) {
  const { replaceData } = useWedding()
  const [sessionId, setSessionId] = useState(getOrCreateSessionId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isWorking, setWorking] = useState(false)
  const [isHistoryLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const voice = useSpeechInput(setInput)

  useEffect(() => {
    let isMounted = true
    fetchAssistantHistory(sessionId)
      .then((history) => {
        if (!isMounted) return
        setMessages(
          history.map((entry) => ({ id: entry.id ?? createId(), role: entry.role, text: entry.text, cards: entry.cards })),
        )
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

  async function ask(query: string) {
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
      {
        id: createId(),
        role: 'assistant',
        text: result.reply,
        cards: result.cards,
        failed: result.failed,
        retryQuery: result.failed ? query : undefined,
      },
    ])
    setWorking(false)
    inputRef.current?.focus()
  }

  function submitText(text: string) {
    const query = text.trim()
    if (!query || isWorking) return
    if (voice.isListening) voice.cancel()
    setInput('')
    setMessages((current) => [...current, { id: createId(), role: 'user', text: query, cards: [] }])
    void ask(query)
  }

  function retry(message: ChatMessage) {
    if (!message.retryQuery || isWorking) return
    setMessages((current) => current.filter((entry) => entry.id !== message.id))
    void ask(message.retryQuery)
  }

  function submitQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitText(input)
  }

  const showWelcome = !isHistoryLoading && messages.length === 0

  return (
    <section className="screen-animate flex min-h-0 flex-1 flex-col">
      <PageHeader title="Mitra AI" rightMeta="AI assistant" />

      <div className="clean-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
        {isHistoryLoading ? <p className="py-6 text-center text-sm text-muted-taupe">Loading conversation…</p> : null}

        {historyError ? (
          <div className="flex items-start gap-2 rounded-2xl border border-blush-deep/30 bg-blush-soft px-4 py-3 text-sm text-blush-deep">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{historyError}</span>
          </div>
        ) : null}

        {showWelcome ? (
          <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-brass-line bg-silk px-3.5 py-2.5 text-sm leading-relaxed text-charcoal shadow-soft">
            <span className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-champagne">
              <Sparkles className="h-3.5 w-3.5" />
              Mitra AI
            </span>
            Namaskaram! I&apos;m Mitra, your AI wedding assistant. Ask me to add tasks, track payments, plan events or find a
            vendor&apos;s contact.
          </div>
        ) : null}

        {messages.map((message) =>
          message.role === 'user' ? (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-charcoal px-3.5 py-2.5 text-sm leading-relaxed text-ivory">
                {message.text}
              </div>
            </div>
          ) : (
            <div key={message.id} className="max-w-[92%]">
              <div
                className={`whitespace-pre-wrap rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-relaxed ${
                  message.failed
                    ? 'border border-blush-deep/30 bg-blush-soft text-blush-deep'
                    : 'border border-brass-line bg-silk text-charcoal shadow-soft'
                }`}
              >
                {message.failed ? (
                  <span className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Mitra couldn&apos;t reply
                  </span>
                ) : null}
                {message.text}
                {message.failed && message.retryQuery ? (
                  <button
                    type="button"
                    onClick={() => retry(message)}
                    disabled={isWorking}
                    className="mt-2.5 flex items-center gap-1.5 rounded-full bg-blush-deep px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Retry
                  </button>
                ) : null}
              </div>
              <ChatCards cards={message.cards} onOpenItem={onOpenItem} />
            </div>
          ),
        )}

        {isWorking ? (
          <div className="flex justify-start" aria-live="polite" aria-label="Mitra AI is typing">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-brass-line bg-silk px-4 py-4 shadow-soft">
              <span className="h-2 w-2 animate-bounce rounded-full bg-champagne [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-champagne [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-champagne" />
            </div>
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 space-y-2.5 border-t border-brass-line/70 pb-3 pt-2.5">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isWorking}
              onClick={() => submitText(prompt)}
              className="whitespace-nowrap rounded-full border border-brass-line bg-silk px-3.5 py-2 text-sm font-medium text-charcoal disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {voice.error ? (
          <p role="status" className="rounded-xl bg-blush-soft px-3 py-2 text-xs leading-snug text-blush-deep">
            {voice.error}
          </p>
        ) : voice.isListening ? (
          <p role="status" className="flex items-center gap-2 px-1 text-xs font-medium text-blush-deep">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blush-deep" />
            Listening… speak now, then tap Send. Tap ■ to stop.
          </p>
        ) : null}

        <form onSubmit={submitQuery} className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={voice.isListening ? 'Listening…' : 'Ask Mitra AI…'}
            enterKeyHint="send"
            autoComplete="off"
            maxLength={2000}
            className={`min-w-0 flex-1 rounded-full bg-silk px-4 py-3 text-base ${voice.isListening ? 'border-blush-deep' : ''}`}
          />
          {voice.isSupported ? (
            <button
              type="button"
              onClick={() => (voice.isListening ? voice.stop() : voice.start(input))}
              disabled={isWorking}
              className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border disabled:opacity-50 ${
                voice.isListening ? 'border-blush-deep bg-blush-soft text-blush-deep' : 'border-brass-line bg-silk text-charcoal'
              }`}
              aria-label={voice.isListening ? 'Stop voice input' : 'Speak your message'}
              aria-pressed={voice.isListening}
            >
              {voice.isListening ? (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-blush-deep/20" />
                  <Square className="h-4 w-4 fill-current" />
                </>
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isWorking || !input.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sindoor text-white disabled:opacity-50"
            aria-label="Send"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </form>
      </div>
    </section>
  )
}
