import { create } from 'zustand'
import { snapshot } from './engine'

export const useGame = create((set) => ({
  snap: snapshot(),
  tool: null, // room type id, 'demolish' or null
  selected: null, // room key
  hovered: null,
  focusOnSelect: false,
  rail: null, // open flyout in the left tool rail
  setTool: (tool) => set({ tool, selected: null }),
  setSelected: (selected) => set({ selected }),
  selectAndFocus: (selected) => set({ selected, focusOnSelect: true, tool: null }),
  setHovered: (hovered) => set({ hovered }),
  setRail: (rail) => set((s) => ({ rail: s.rail === rail ? null : rail })),
}))

export function syncUI() {
  useGame.setState({ snap: snapshot() })
}
