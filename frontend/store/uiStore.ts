import { create } from "zustand";

type UiState = {
  /** Mobile off-canvas sidebar visibility. Desktop sidebar is always visible via CSS breakpoints. */
  mobileSidebarOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleMobileSidebar: () => void;
  /** Global search term typed in the topbar, consumed by the Services page for client-side filtering. */
  serviceSearchTerm: string;
  setServiceSearchTerm: (term: string) => void;
};

export const useUiStore = create<UiState>((set) => ({
  mobileSidebarOpen: false,
  openMobileSidebar: () => set({ mobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
  serviceSearchTerm: "",
  setServiceSearchTerm: (term) => set({ serviceSearchTerm: term }),
}));
