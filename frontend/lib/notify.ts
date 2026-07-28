import { toast as toastManager } from "@/components/ui/toast";

/** Thin, consistent wrapper around the base-ui toast manager for use in mutation callbacks. */
export const notify = {
  success: (title: string, description?: string) => toastManager.add({ title, description, type: "success" }),
  error: (title: string, description?: string) => toastManager.add({ title, description, type: "error" }),
  info: (title: string, description?: string) => toastManager.add({ title, description, type: "info" }),
  warning: (title: string, description?: string) => toastManager.add({ title, description, type: "warning" }),
};
