import { createContext } from 'react'
import type {
  AddExpenseInput,
  AddGuestEventInput,
  AddTodoInput,
  AddVendorInput,
  BudgetMetrics,
  ExpenseItem,
  TodoItem,
  WeddingPlannerData,
} from '../types/wedding'

export interface WeddingContextValue {
  data: WeddingPlannerData
  isHydrating: boolean
  syncError: string
  budgetMetrics: BudgetMetrics
  readinessPercent: number
  taskCompletion: { completed: number; total: number }
  upcomingPayments: ExpenseItem[]
  priorityTasks: TodoItem[]
  replaceData: (data: WeddingPlannerData) => void
  addExpense: (input: AddExpenseInput, eventId?: string) => void
  cycleExpenseStatus: (id: string) => void
  markExpensePaid: (id: string) => void
  updateExpenseAmounts: (id: string, totalAmount: number, paidAmount: number) => void
  addTodo: (input: AddTodoInput, eventId?: string) => void
  addGuestEvent: (input: AddGuestEventInput) => void
  addEventInvitees: (eventId: string, names: string[]) => void
  toggleEventInvitee: (eventId: string, inviteeId: string) => void
  removeEventInvitee: (eventId: string, inviteeId: string) => void
  removeGuestEvent: (eventId: string) => void
  toggleTodo: (id: string) => void
  updateTodo: (id: string, input: AddTodoInput & { completed: boolean }) => void
  removeTodo: (id: string) => void
  addVendor: (input: AddVendorInput, eventId?: string) => void
  updateVendorPhone: (id: string, phone: string) => void
}

export const WeddingContext = createContext<WeddingContextValue | undefined>(
  undefined,
)
