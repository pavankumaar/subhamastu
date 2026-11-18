import type { AppTab } from './App'

export type ItemTab = Exclude<AppTab, 'chat'>

// Opens an item's detail page in another tab, e.g. a vendor from a payment row or a chat card.
export type OpenItem = (tab: ItemTab, id: string) => void
