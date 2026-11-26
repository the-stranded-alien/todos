// ── Store context + hook (kept apart from the provider for fast refresh)
import { createContext, useContext } from 'react'

export const StoreContext = createContext(null)
export const useStore = () => useContext(StoreContext)
