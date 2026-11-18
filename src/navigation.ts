import type { AppTab } from './App'

export type ItemTab = Exclude<AppTab, 'chat'>

// Where a detail page was opened from, so closing it returns there (e.g. back to the event or the chat).
export interface ItemOrigin {
  tab: AppTab
  id?: string
}

// Opens an item's detail page in another tab, e.g. a vendor from a payment row or a chat card.
export type OpenItem = (tab: ItemTab, id: string, origin?: ItemOrigin) => void
