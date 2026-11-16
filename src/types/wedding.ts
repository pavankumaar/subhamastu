export type ExpenseCategory =
  | 'Venue'
  | 'Catering'
  | 'Attire'
  | 'Photography'
  | 'Decor'

export type ExpenseStatus = 'Paid' | 'Deposit Paid' | 'Due Soon'
export type TodoPriority = 'High' | 'Medium' | 'Low'

export type TodoMilestone = 'General'

export interface EventMeta {
  coupleNames: string
  weddingDate: string
  planningStartDate: string
  venueName: string
  venueCity: string
  totalBudget: number
}

export interface ExpenseItem {
  id: string
  title: string
  vendorName: string
  eventId?: string
  category: ExpenseCategory
  totalAmount: number
  paidAmount: number
  dueDate: string
  status: ExpenseStatus
}

export interface TodoItem {
  id: string
  title: string
  eventId?: string
  milestone: TodoMilestone
  dueDate?: string
  completed: boolean
  priority: TodoPriority
}

export interface VendorItem {
  id: string
  name: string
  eventId?: string
  role: string
  phone: string
  email: string
  totalContract: number
  paidAmount: number
  notes: string
}

export interface GuestMealCounts {
  vegetarian: number
  nonVegetarian: number
  vegan: number
}

export interface InviteeChecklistItem {
  id: string
  name: string
  completed: boolean
}

export interface GuestEventItem {
  id: string
  name: string
  date?: string
  details?: string
  invitees: InviteeChecklistItem[]
}

export interface GuestStats {
  totalInvited: number
  pending: number
  declined: number
  events: GuestEventItem[]
  mealCounts: GuestMealCounts
}

export interface WeddingPlannerData {
  event: EventMeta
  expenses: ExpenseItem[]
  todos: TodoItem[]
  vendors: VendorItem[]
  guests: GuestStats
}

export interface BudgetMetrics {
  totalBudget: number
  committedAmount: number
  totalPaid: number
  remainingBalance: number
  paidPercent: number
  committedPercent: number
}

export type WeddingView = 'overview' | 'budget' | 'todos' | 'directory'

export interface AddExpenseInput {
  title: string
  vendorName: string
  category: ExpenseCategory
  totalAmount: number
  paidAmount: number
  dueDate: string
}

export interface AddTodoInput {
  title: string
  dueDate?: string
  priority: TodoPriority
}

export interface AddVendorInput {
  name: string
  role: string
  phone: string
  email: string
  totalContract: number
  paidAmount: number
  notes: string
}

export interface AddGuestEventInput {
  name: string
  date?: string
  details?: string
  members: string[]
  quickAddEventIds?: string[]
}
