import { useState, useEffect } from "react"

export type ToastType = "success" | "error" | "info" | "warning"

export interface Toast {
  id: string
  title: string
  description?: string
  type: ToastType
}

const toastTimeouts = new Map<string, NodeJS.Timeout>()

let toastCount = 0

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = ({
    title,
    description,
    type = "info",
    duration = 5000,
  }: {
    title: string
    description?: string
    type?: ToastType
    duration?: number
  }) => {
    const id = (toastCount++).toString()
    const newToast: Toast = { id, title, description, type }

    setToasts((prev) => [...prev, newToast])

    if (duration > 0) {
      const timeout = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
        toastTimeouts.delete(id)
      }, duration)
      toastTimeouts.set(id, timeout)
    }

    return id
  }

  const dismiss = (id: string) => {
    const timeout = toastTimeouts.get(id)
    if (timeout) {
      clearTimeout(timeout)
      toastTimeouts.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  useEffect(() => {
    return () => {
      toastTimeouts.forEach((timeout) => clearTimeout(timeout))
      toastTimeouts.clear()
    }
  }, [])

  return { toast, toasts, dismiss }
}
