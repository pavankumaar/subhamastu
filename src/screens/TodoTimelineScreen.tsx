import { ArrowLeft, Check, Circle } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { EmptyStateCard, PageHeader } from '../components/ScreenChrome'
import { useWedding } from '../context/useWedding'
import type { TodoPriority } from '../types/wedding'
import { formatDate } from '../utils/weddingFormat'

interface TodoTimelineScreenProps {
  onQuickActionVisibilityChange?: (visible: boolean) => void
}

function isInviteTodo(title: string) {
  return /^invite(?:\s*[:-]\s*|\s+)/i.test(title.trim())
}

function priorityBadgeStyle(priority: TodoPriority) {
  if (priority === 'High') {
    return 'text-blush-deep bg-blush-soft'
  }
  if (priority === 'Medium') {
    return 'text-champagne bg-champagne-light'
  }
  return 'text-sage bg-sage-light'
}

export function TodoTimelineScreen({ onQuickActionVisibilityChange }: TodoTimelineScreenProps) {
  const { data, taskCompletion, toggleTodo, updateTodo, removeTodo } = useWedding()
  const [selectedTodoId, setSelectedTodoId] = useState('')
  const [todoTitle, setTodoTitle] = useState('')
  const [todoDueDate, setTodoDueDate] = useState('')
  const [todoPriority, setTodoPriority] = useState<TodoPriority>('Medium')
  const [todoCompleted, setTodoCompleted] = useState(false)
  const [todoError, setTodoError] = useState('')

  const eventNameById = useMemo(
    () => new Map(data.guests.events.map((event) => [event.id, event.name])),
    [data.guests.events],
  )

  const openTasks = useMemo(() => {
    return data.todos
      .filter((todo) => !isInviteTodo(todo.title))
      .map((todo, index) => ({ todo, index }))
      .sort((left, right) => {
        const leftHasDueDate = Boolean(left.todo.dueDate)
        const rightHasDueDate = Boolean(right.todo.dueDate)

        if (leftHasDueDate && !rightHasDueDate) {
          return -1
        }
        if (!leftHasDueDate && rightHasDueDate) {
          return 1
        }
        if (leftHasDueDate && rightHasDueDate) {
          const leftDate = left.todo.dueDate ?? ''
          const rightDate = right.todo.dueDate ?? ''
          if (leftDate !== rightDate) {
            return leftDate.localeCompare(rightDate)
          }
        }
        return left.index - right.index
      })
      .map(({ todo }) => todo)
  }, [data.todos])

  const selectedTodo = useMemo(
    () => openTasks.find((todo) => todo.id === selectedTodoId) ?? null,
    [openTasks, selectedTodoId],
  )
  const isDetailView = Boolean(selectedTodo)
  const completionPercent =
    taskCompletion.total === 0
      ? 0
      : Math.round((taskCompletion.completed / taskCompletion.total) * 100)

  useEffect(() => {
    if (!onQuickActionVisibilityChange) {
      return
    }
    onQuickActionVisibilityChange(!isDetailView)
    return () => onQuickActionVisibilityChange(true)
  }, [isDetailView, onQuickActionVisibilityChange])

  function openTodoDetails(todoId: string) {
    const todo = openTasks.find((entry) => entry.id === todoId)
    if (!todo) {
      return
    }
    setSelectedTodoId(todo.id)
    setTodoTitle(todo.title)
    setTodoDueDate(todo.dueDate ?? '')
    setTodoPriority(todo.priority)
    setTodoCompleted(todo.completed)
    setTodoError('')
  }

  function closeTodoDetails() {
    setSelectedTodoId('')
    setTodoTitle('')
    setTodoDueDate('')
    setTodoPriority('Medium')
    setTodoCompleted(false)
    setTodoError('')
  }

  function handleTodoUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTodo) {
      return
    }

    if (!todoTitle.trim()) {
      setTodoError('Please enter a task title.')
      return
    }
    if (!todoDueDate) {
      setTodoError('Please select a due date.')
      return
    }

    updateTodo(selectedTodo.id, {
      title: todoTitle,
      dueDate: todoDueDate,
      priority: todoPriority,
      completed: todoCompleted,
    })
    closeTodoDetails()
  }

  function handleTodoDelete() {
    if (!selectedTodo) {
      return
    }
    removeTodo(selectedTodo.id)
    closeTodoDetails()
  }

  if (selectedTodo) {
    return (
      <section className="screen-animate space-y-5">
        <button
          type="button"
          onClick={closeTodoDetails}
          className="inline-flex items-center gap-1.5 px-1 text-sm font-medium text-muted-taupe hover:text-charcoal"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Checklist
        </button>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-champagne">Edit Task</p>
          <h1 className="mt-0.5 font-display text-[42px] font-semibold leading-none text-charcoal">
            Task Details
          </h1>
        </div>

        <form onSubmit={handleTodoUpdate} className="rounded-3xl border border-brass-line bg-silk p-5 shadow-soft space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-muted-taupe">Title</label>
            <input
              value={todoTitle}
              onChange={(event) => setTodoTitle(event.target.value)}
              placeholder="Task title"
              className="bg-ivory"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted-taupe">Due Date</label>
              <input type="date" value={todoDueDate} onChange={(event) => setTodoDueDate(event.target.value)} className="bg-ivory tabular-nums" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted-taupe">Priority</label>
              <select
                value={todoPriority}
                onChange={(event) => setTodoPriority(event.target.value as TodoPriority)}
                className="bg-ivory"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between border-t border-brass-line pt-2">
            <span className="text-sm font-medium text-charcoal">Mark as completed</span>
            <input
              type="checkbox"
              checked={todoCompleted}
              onChange={(event) => setTodoCompleted(event.target.checked)}
              className="h-4 w-4 rounded accent-sage"
            />
          </label>

          {todoError ? (
            <div className="rounded-xl bg-blush-soft px-3.5 py-2.5 text-xs text-blush-deep">
              {todoError}
            </div>
          ) : null}
          <div className="space-y-2.5 pt-1">
            <button type="submit" className="w-full rounded-2xl bg-charcoal py-3 text-base font-medium text-ivory">
              Update Task
            </button>
            <button
              type="button"
              onClick={handleTodoDelete}
              className="w-full rounded-2xl border border-brass-line py-3 text-base font-medium text-blush-deep"
            >
              Delete Task
            </button>
          </div>
        </form>
      </section>
    )
  }

  return (
    <section className="screen-animate">
      <PageHeader
        kicker="Subha Kalyanam"
        title="Checklist"
        rightMeta={`${taskCompletion.completed}/${taskCompletion.total} done`}
      />

      <div className="space-y-4 px-1 pb-2">
        <div className="rounded-2xl border border-brass-line bg-silk px-4 py-3.5 shadow-soft">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-muted-taupe">Readiness</span>
            <span className="tabular-nums font-semibold text-charcoal">{completionPercent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F3EFE8]">
            <div className="h-full rounded-full bg-sage transition-all duration-500" style={{ width: `${completionPercent}%` }} />
          </div>
        </div>

        {openTasks.length === 0 ? (
          <EmptyStateCard
            title="Begin Your Preparations"
            subtitle="Add rituals, attire fittings, and Purohit milestones. Tasks with dates sort automatically."
          />
        ) : (
          <div className="space-y-2.5">
            {openTasks.map((todo) => (
              <article
                key={todo.id}
                className="flex items-start gap-3 rounded-2xl border border-brass-line bg-silk p-3.5 shadow-soft transition-all hover:border-champagne/60"
              >
                <button
                  type="button"
                  onClick={() => toggleTodo(todo.id)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    todo.completed
                      ? 'border-sage bg-sage text-white'
                      : 'border-champagne/60 text-charcoal hover:border-charcoal'
                  }`}
                >
                  {todo.completed ? <Check className="h-3 w-3 stroke-[2.5]" /> : null}
                  {!todo.completed ? <Circle className="h-3.5 w-3.5 opacity-0" /> : null}
                </button>
                <button
                  type="button"
                  onClick={() => openTodoDetails(todo.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className={`text-[13px] font-medium leading-snug ${todo.completed ? 'text-muted-taupe line-through' : 'text-charcoal'}`}>
                    {todo.title}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${priorityBadgeStyle(todo.priority)}`}>
                      {todo.priority}
                    </span>
                    {todo.dueDate ? <span className="tabular-nums text-muted-taupe">{formatDate(todo.dueDate)}</span> : null}
                    {todo.eventId && eventNameById.get(todo.eventId) ? (
                      <span className="max-w-[140px] truncate text-champagne">· {eventNameById.get(todo.eventId)}</span>
                    ) : null}
                  </div>
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
