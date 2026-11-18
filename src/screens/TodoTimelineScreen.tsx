import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { TodoCard } from '../components/Cards'
import { DetailHeader, EmptyStateCard, FieldLabel, PageHeader } from '../components/ScreenChrome'
import { useWedding } from '../context/useWedding'
import { useBackLayer } from '../hooks/useBackLayer'
import type { TodoItem, TodoKind, TodoPriority } from '../types/wedding'

interface TodoTimelineScreenProps {
  onQuickActionVisibilityChange?: (visible: boolean) => void
  initialItemId?: string
  onItemClosed?: () => void
}

interface TodoFormState {
  title: string
  dueDate: string
  priority: TodoPriority
  kind: TodoKind
  eventId: string
  completed: boolean
}

function isInviteTodo(title: string) {
  return /^invite(?:\s*[:-]\s*|\s+)/i.test(title.trim())
}

function formFromTodo(todo: TodoItem): TodoFormState {
  return {
    title: todo.title,
    dueDate: todo.dueDate ?? '',
    priority: todo.priority,
    kind: todo.kind === 'buy' ? 'buy' : 'task',
    eventId: todo.eventId ?? '',
    completed: todo.completed,
  }
}

// Open items first, completed items sink to the bottom. Within each group: due dates first (nearest first).
function sortTodos(todos: TodoItem[]) {
  return todos
    .map((todo, index) => ({ todo, index }))
    .sort((left, right) => {
      if (left.todo.completed !== right.todo.completed) return left.todo.completed ? 1 : -1
      const leftDate = left.todo.dueDate ?? ''
      const rightDate = right.todo.dueDate ?? ''
      if (leftDate && !rightDate) return -1
      if (!leftDate && rightDate) return 1
      if (leftDate !== rightDate) return leftDate.localeCompare(rightDate)
      return left.index - right.index
    })
    .map(({ todo }) => todo)
}

export function TodoTimelineScreen({ onQuickActionVisibilityChange, initialItemId, onItemClosed }: TodoTimelineScreenProps) {
  const { data, taskCompletion, toggleTodo, updateTodo, removeTodo } = useWedding()
  const initialTodo = initialItemId ? data.todos.find((todo) => todo.id === initialItemId) : undefined

  const [selectedId, setSelectedId] = useState(initialTodo?.id ?? '')
  const [form, setForm] = useState<TodoFormState | null>(() => (initialTodo ? formFromTodo(initialTodo) : null))
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const eventNameById = useMemo(
    () => new Map(data.guests.events.map((event) => [event.id, event.name])),
    [data.guests.events],
  )
  const todos = useMemo(() => sortTodos(data.todos.filter((todo) => !isInviteTodo(todo.title))), [data.todos])
  const selectedTodo = todos.find((todo) => todo.id === selectedId) ?? null
  const isDetail = Boolean(selectedTodo && form)
  useBackLayer(isDetail, () => closeTodo())
  const completionPercent =
    taskCompletion.total === 0 ? 0 : Math.round((taskCompletion.completed / taskCompletion.total) * 100)

  useEffect(() => {
    if (!onQuickActionVisibilityChange) return
    onQuickActionVisibilityChange(!isDetail)
    return () => onQuickActionVisibilityChange(true)
  }, [isDetail, onQuickActionVisibilityChange])

  function openTodo(todo: TodoItem) {
    setSelectedId(todo.id)
    setForm(formFromTodo(todo))
    setError('')
  }

  function closeTodo() {
    setSelectedId('')
    setForm(null)
    setError('')
    setConfirmDelete(false)
    onItemClosed?.()
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTodo || !form) return
    if (!form.title.trim()) {
      setError('Please enter a title.')
      return
    }
    if (!form.dueDate) {
      setError('Please choose a due date.')
      return
    }
    updateTodo(selectedTodo.id, {
      title: form.title,
      dueDate: form.dueDate,
      priority: form.priority,
      kind: form.kind,
      eventId: form.eventId || undefined,
      completed: form.completed,
    })
    closeTodo()
  }

  if (selectedTodo && form) {
    return (
      <section className="screen-animate space-y-3 pb-4">
        <DetailHeader
          backLabel="Checklist"
          onBack={closeTodo}
          title={selectedTodo.title}
          subtitle={selectedTodo.kind === 'buy' ? 'Item to buy' : 'Task'}
          action={
            <button
              type="button"
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true)
                  return
                }
                removeTodo(selectedTodo.id)
                closeTodo()
              }}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-blush-deep active:bg-blush-soft"
            >
              <Trash2 className="h-4 w-4" />
              {confirmDelete ? 'Tap again to delete' : 'Delete'}
            </button>
          }
        />

        <form onSubmit={handleSave} className="space-y-3 rounded-2xl border border-brass-line bg-silk p-3.5 shadow-soft">
          <div>
            <FieldLabel>Title *</FieldLabel>
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <FieldLabel>Due date</FieldLabel>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                className="tabular-nums"
              />
            </div>
            <div>
              <FieldLabel>Priority</FieldLabel>
              <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TodoPriority })}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <FieldLabel>Type</FieldLabel>
              <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as TodoKind })}>
                <option value="task">Task</option>
                <option value="buy">Item to buy</option>
              </select>
            </div>
            <div>
              <FieldLabel>Event</FieldLabel>
              <select value={form.eventId} onChange={(event) => setForm({ ...form, eventId: event.target.value })}>
                <option value="">Not linked</option>
                {data.guests.events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex cursor-pointer items-center justify-between border-t border-brass-line pt-2.5">
            <span className="text-sm font-medium text-charcoal">{form.kind === 'buy' ? 'Bought' : 'Completed'}</span>
            <input
              type="checkbox"
              checked={form.completed}
              onChange={(event) => setForm({ ...form, completed: event.target.checked })}
              className="h-4 w-4 accent-sage"
            />
          </label>
          {error ? <p className="rounded-xl bg-blush-soft px-3 py-2 text-xs text-blush-deep">{error}</p> : null}
          <button type="submit" className="w-full rounded-2xl bg-charcoal py-3 text-sm font-semibold text-ivory">
            Save changes
          </button>
        </form>
      </section>
    )
  }

  return (
    <section className="screen-animate space-y-3">
      <PageHeader title="Checklist" rightMeta={`${taskCompletion.completed}/${taskCompletion.total} done`} />

      <div className="rounded-2xl border border-brass-line bg-silk px-3.5 py-2.5 shadow-soft">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-muted-taupe">Readiness</span>
          <span className="font-bold tabular-nums text-charcoal">{completionPercent}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F3EFE8]">
          <div className="h-full rounded-full bg-sage transition-all duration-500" style={{ width: `${completionPercent}%` }} />
        </div>
      </div>

      {todos.length === 0 ? (
        <EmptyStateCard
          title="Begin your preparations"
          subtitle="Add rituals, attire fittings and Purohit milestones. Tasks with dates sort automatically."
        />
      ) : (
        <div className="space-y-2">
          {todos.map((todo) => (
            <TodoCard
              key={todo.id}
              todo={todo}
              eventName={todo.eventId ? eventNameById.get(todo.eventId) : undefined}
              onToggle={() => toggleTodo(todo.id)}
              onOpen={() => openTodo(todo)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
