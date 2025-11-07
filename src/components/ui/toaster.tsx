import { useToast } from "./toast-provider"
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-96 max-w-[90vw]">
      {toasts.map((toast) => {
        const Icon =
          toast.type === "success"
            ? CheckCircle
            : toast.type === "error"
            ? XCircle
            : toast.type === "warning"
            ? AlertTriangle
            : Info

        const colorClasses =
          toast.type === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : toast.type === "error"
            ? "bg-red-50 border-red-200 text-red-800"
            : toast.type === "warning"
            ? "bg-yellow-50 border-yellow-200 text-yellow-800"
            : "bg-blue-50 border-blue-200 text-blue-800"

        const iconColor =
          toast.type === "success"
            ? "text-green-500"
            : toast.type === "error"
            ? "text-red-500"
            : toast.type === "warning"
            ? "text-yellow-500"
            : "text-blue-500"

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-in slide-in-from-right ${colorClasses}`}
          >
            <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{toast.title}</p>
              {toast.description && (
                <p className="text-sm mt-1 opacity-90">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="flex-shrink-0 rounded-md p-1 hover:bg-black/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
