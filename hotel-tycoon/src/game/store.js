import { create } from 'zustand'
import { snapshot } from './engine'

export const useGame = create((set) => ({
  snap: snapshot(),
  tool: null, // room type id, 'demolish' or null
  selected: null, // room key
  hovered: null,
  panel: null, // 'staff' | 'goals' | 'stats' | null
  setTool: (tool) => set({ tool, selected: null }),
  setSelected: (selected) => set({ selected }),
  setHovered: (hovered) => set({ hovered }),
  setPanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel })),
}))

export function syncUI() {
  useGame.setState({ snap: snapshot() })
}
