import { create } from 'zustand'
import type { AgentInsightsSnapshot, ExternalSessionRef } from '@shared/types'

function insightKey(session: ExternalSessionRef): string {
  return `${session.provider}:${session.id}`
}

interface ContextWindowState {
  isOpen: boolean
  toggle: () => void
  setOpen: (open: boolean) => void
  insightSnapshots: Record<string, AgentInsightsSnapshot>
  setInsightSnapshot: (snapshot: AgentInsightsSnapshot) => void
  removeInsightSnapshot: (session: ExternalSessionRef) => void
}

export const useContextWindowStore = create<ContextWindowState>((set) => ({
  isOpen: false,
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  insightSnapshots: {},
  setInsightSnapshot: (snapshot) => set((state) => ({
    insightSnapshots: {
      ...state.insightSnapshots,
      [insightKey(snapshot.session)]: snapshot,
    },
  })),
  removeInsightSnapshot: (session) => set((state) => {
    const insightSnapshots = { ...state.insightSnapshots }
    delete insightSnapshots[insightKey(session)]
    return { insightSnapshots }
  }),
}))
