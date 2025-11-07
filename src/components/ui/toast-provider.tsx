import { createContext, useContext, ReactNode } from "react"
import { useToast as useToastHook, Toast, ToastType } from "./use-toast"

interface ToastContextType {
  toast: (params: {
    title: string
    description?: string
    type?: ToastType
    duration?: number
  }) => string
  toasts: Toast[]
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const toastHook = useToastHook()

  return (
    <ToastContext.Provider value={toastHook}>{children}</ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}
