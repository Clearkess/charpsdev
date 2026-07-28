import { create } from "zustand";

type UiState = {
  /** Mobile off-canvas sidebar visibility. Desktop sidebar is always visible via CSS breakpoints. */
  mobileSidebarOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleMobileSidebar: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  mobileSidebarOpen: false,
  openMobileSidebar: () => set({ mobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
}));
