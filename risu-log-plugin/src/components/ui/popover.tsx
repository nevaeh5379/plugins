import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn } from "@/lib/utils"

export interface LegacyPopoverProps {
  content: React.ReactNode
  title?: React.ReactNode
  trigger?: "hover" | "click"
  placement?: "top" | "bottom" | "left" | "right" | "bottomRight" | "bottomLeft" | "topRight" | "topLeft"
  children: React.ReactElement
  className?: string
  style?: React.CSSProperties
}

const PopoverRoot = PopoverPrimitive.Root
const PopoverTriggerPrimitive = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, style, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      style={{ backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)', borderColor: 'var(--border)', ...style }}
      className={cn(
        "z-[100000] w-auto max-w-sm rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

const Popover = React.forwardRef<HTMLDivElement, LegacyPopoverProps>(
  ({ content, title, children, placement = "bottom", className }) => {
    const side = (placement.startsWith("top") ? "top" : placement.startsWith("bottom") ? "bottom" : placement.startsWith("left") ? "left" : placement.startsWith("right") ? "right" : "bottom") as "top" | "bottom" | "left" | "right"
    const align = (placement.endsWith("Right") ? "end" : placement.endsWith("Left") ? "start" : "center") as "start" | "center" | "end"

    return (
      <PopoverRoot>
        <PopoverTriggerPrimitive asChild>
          {children}
        </PopoverTriggerPrimitive>
        <PopoverContent side={side} align={align} className={className}>
          {title && (
            <div className="font-semibold text-xs mb-2 pb-1.5 border-b border-border text-foreground">
              {title}
            </div>
          )}
          <div className="text-xs text-foreground">{content}</div>
        </PopoverContent>
      </PopoverRoot>
    )
  }
) as React.ForwardRefExoticComponent<LegacyPopoverProps & React.RefAttributes<HTMLDivElement>> & {
  Root: typeof PopoverRoot
  Trigger: typeof PopoverTriggerPrimitive
  Content: typeof PopoverContent
}

Popover.displayName = "Popover"
Popover.Root = PopoverRoot
Popover.Trigger = PopoverTriggerPrimitive
Popover.Content = PopoverContent

export { Popover, PopoverRoot, PopoverTriggerPrimitive as PopoverTrigger, PopoverContent }
