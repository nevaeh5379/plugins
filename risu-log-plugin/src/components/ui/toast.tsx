/* eslint-disable @typescript-eslint/no-explicit-any, react-refresh/only-export-components */
import * as React from "react"
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner"

export type ToastType = "success" | "error" | "warning" | "info" | "loading"

export interface ToastOptions {
  content: React.ReactNode
  duration?: number
  style?: React.CSSProperties
}

export const Toaster: React.FC = () => {
  return (
    <SonnerToaster
      position="top-center"
      toastOptions={{
        style: {
          background: "var(--card, #18181b)",
          color: "var(--foreground, #f4f4f5)",
          border: "1px solid var(--border, #27272a)",
          fontSize: "13px",
        },
      }}
    />
  )
}

function parseContent(contentOrOptions: React.ReactNode | ToastOptions) {
  if (
    typeof contentOrOptions === "object" &&
    contentOrOptions !== null &&
    !React.isValidElement(contentOrOptions) &&
    "content" in (contentOrOptions as any)
  ) {
    const opts = contentOrOptions as ToastOptions
    return { content: opts.content, duration: opts.duration ? opts.duration * 1000 : undefined, style: opts.style }
  }
  return { content: contentOrOptions as React.ReactNode }
}

export const message = {
  success: (content: React.ReactNode | ToastOptions, duration?: number) => {
    const parsed = parseContent(content)
    return sonnerToast.success(parsed.content, { duration: parsed.duration ?? (duration ? duration * 1000 : 3000), style: parsed.style })
  },
  error: (content: React.ReactNode | ToastOptions, duration?: number) => {
    const parsed = parseContent(content)
    return sonnerToast.error(parsed.content, { duration: parsed.duration ?? (duration ? duration * 1000 : 4000), style: parsed.style })
  },
  warning: (content: React.ReactNode | ToastOptions, duration?: number) => {
    const parsed = parseContent(content)
    return sonnerToast.warning(parsed.content, { duration: parsed.duration ?? (duration ? duration * 1000 : 3500), style: parsed.style })
  },
  info: (content: React.ReactNode | ToastOptions, duration?: number) => {
    const parsed = parseContent(content)
    return sonnerToast.info(parsed.content, { duration: parsed.duration ?? (duration ? duration * 1000 : 3000), style: parsed.style })
  },
  loading: (content: React.ReactNode | ToastOptions) => {
    const parsed = parseContent(content)
    return sonnerToast.loading(parsed.content, { style: parsed.style })
  },
  destroy: () => {
    sonnerToast.dismiss()
  },
}

export const toast = message
