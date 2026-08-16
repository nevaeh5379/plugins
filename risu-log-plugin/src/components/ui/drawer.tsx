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
  styles?: { body?: React.CSSProperties; header?: React.CSSProperties }
  getContainer?: () => HTMLElement | null
  children?: React.ReactNode
  className?: string
  dataTheme?: string
}

const Drawer: React.FC<DrawerProps> = ({
  open = false,
  onClose,
  title,
  placement = "right",
  width = "320px",
  styles,
  getContainer,
  children,
  className,
  dataTheme,
}) => {
  const widthStyle = typeof width === "number" ? `${width}px` : width
  const containerElement = getContainer ? getContainer() : undefined

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(val) => !val && onClose?.()}>
      <DialogPrimitive.Portal container={containerElement}>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          data-theme={dataTheme}
          className={cn(
            "fixed z-[10001] flex flex-col bg-card text-foreground shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
            placement === "right" && "inset-y-0 right-0 h-full border-l border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            placement === "left" && "inset-y-0 left-0 h-full border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
            className
          )}
          style={{ width: widthStyle }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-card text-foreground"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--card)',
              color: 'var(--foreground)',
              flexShrink: 0,
              ...styles?.header,
            }}
          >
            <DialogPrimitive.Title
              className="text-sm font-semibold text-foreground"
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--foreground)',
                margin: 0,
              }}
            >
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              type="button"
              onClick={onClose}
              className="flex items-center justify-center rounded-md border border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'transparent',
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="설정 닫기"
              aria-label="설정 닫기"
            >
              <X size={15} />
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
