import { Check } from 'lucide-react'
import { useWedding } from '../context/useWedding'
import { formatDate } from '../utils/weddingFormat'

export function PriorityChecklistPanel() {
  const { priorityTasks, toggleTodo } = useWedding()

  return (
    <article className="editorial-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-2xl font-semibold text-charcoal">Priority Checklist</h3>
        <span className="rounded-full border border-champagne/30 bg-champagne-light px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-champagne">
          Focus
        </span>
      </div>
      <div className="space-y-2.5">
        {priorityTasks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-warm px-4 py-6 text-center text-sm text-muted-taupe">
            No priority tasks yet. Add a to-do from the floating quick action button.
          </p>
        ) : (
          priorityTasks.map((todo) => (
            <button
              key={todo.id}
              type="button"
              onClick={() => toggleTodo(todo.id)}
              className="group flex w-full items-start gap-3 rounded-2xl border border-border-warm bg-white/80 px-3 py-3 text-left transition-colors duration-200 hover:bg-ivory-bg"
            >
              <span
                className={`custom-check mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${
                  todo.completed
                    ? 'border-sage bg-sage text-white'
                    : 'border-champagne bg-white text-transparent'
                }`}
              >
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-semibold ${
                    todo.completed ? 'text-muted-taupe line-through' : 'text-charcoal'
                  }`}
                >
                  {todo.title}
                </span>
                {todo.dueDate ? (
                  <span className="mt-1 block text-xs text-muted-taupe">
                    Due {formatDate(todo.dueDate)}
                  </span>
                ) : null}
              </span>
            </button>
          ))
        )}
      </div>
    </article>
  )
}
