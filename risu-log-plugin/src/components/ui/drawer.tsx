import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface DrawerProps {
  open?: boolean
  onClose?: () => void
  title?: React.ReactNode
  placement?: "right" | "left" | "top" | "bottom"
  width?: string | number
  styles?: { body?: React.CSSProperties }
  getContainer?: () => HTMLElement | null
  children?: React.ReactNode
  className?: string
}

const Drawer: React.FC<DrawerProps> = ({
  open = false,
  onClose,
  title,
  placement = "right",
  width = "320px",
  styles,
  children,
  className,
}) => {
  const widthStyle = typeof width === "number" ? `${width}px` : width

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(val) => !val && onClose?.()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-[10001] flex flex-col bg-card text-foreground shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
            placement === "right" && "inset-y-0 right-0 h-full border-l border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            placement === "left" && "inset-y-0 left-0 h-full border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
            className
          )}
          style={{ width: widthStyle }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <DialogPrimitive.Title className="text-sm font-semibold text-foreground">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              onClick={onClose}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <X className="h-4.5 w-4.5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4" style={styles?.body}>
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export { Drawer }
