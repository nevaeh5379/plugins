import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { cn } from "@/lib/utils"

export interface MenuItem {
  key?: string
  label?: React.ReactNode
  icon?: React.ReactNode
  disabled?: boolean
  type?: "divider" | "item"
  onClick?: () => void
}

export interface LegacyDropdownProps {
  menu?: {
    items?: MenuItem[]
    onClick?: (info: { key: string }) => void
  }
  trigger?: ("click" | "hover")[]
  placement?: "bottomLeft" | "bottomRight" | "topLeft" | "topRight"
  getPopupContainer?: (node?: HTMLElement) => HTMLElement
  children: React.ReactElement
  className?: string
  style?: React.CSSProperties
}

const DropdownMenuRoot = DropdownMenuPrimitive.Root
const DropdownMenuTriggerPrimitive = DropdownMenuPrimitive.Trigger

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, style, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      style={{
        backgroundColor: 'var(--card, #18181b)',
        color: 'var(--foreground, #f4f4f5)',
        borderColor: 'var(--border, #27272a)',
        ...style
      }}
      className={cn(
        "z-[100000] min-w-[9rem] overflow-hidden rounded-md border border-border bg-card p-1 text-foreground shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-bottom-2 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItemPrimitive = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, style, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    style={{
      color: 'var(--foreground, #f4f4f5)',
      ...style
    }}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors hover:bg-secondary focus:bg-secondary focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  />
))
DropdownMenuItemPrimitive.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const Dropdown = React.forwardRef<HTMLDivElement, LegacyDropdownProps>(
  ({ menu, placement = "bottomLeft", children, className }) => {
    const side = placement.startsWith("top") ? "top" : "bottom"
    const align = placement.endsWith("Right") ? "end" : "start"

    return (
      <DropdownMenuRoot>
        <DropdownMenuTriggerPrimitive asChild>
          {children}
        </DropdownMenuTriggerPrimitive>
        <DropdownMenuContent side={side} align={align} className={className}>
          {menu?.items?.map((item, idx) => {
            if (item.type === "divider") {
              return <DropdownMenuSeparator key={`div-${idx}`} />
            }

            return (
              <DropdownMenuItemPrimitive
                key={item.key || idx}
                disabled={item.disabled}
                onClick={() => {
                  if (item.onClick) item.onClick()
                  if (item.key && menu.onClick) menu.onClick({ key: item.key })
                }}
              >
                {item.icon && <span className="mr-2 flex items-center">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
              </DropdownMenuItemPrimitive>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenuRoot>
    )
  }
) as React.ForwardRefExoticComponent<LegacyDropdownProps & React.RefAttributes<HTMLDivElement>> & {
  Root: typeof DropdownMenuRoot
  Trigger: typeof DropdownMenuTriggerPrimitive
  Content: typeof DropdownMenuContent
  Item: typeof DropdownMenuItemPrimitive
  Separator: typeof DropdownMenuSeparator
}

Dropdown.displayName = "Dropdown"
Dropdown.Root = DropdownMenuRoot
Dropdown.Trigger = DropdownMenuTriggerPrimitive
Dropdown.Content = DropdownMenuContent
Dropdown.Item = DropdownMenuItemPrimitive
Dropdown.Separator = DropdownMenuSeparator

export {
  Dropdown,
  DropdownMenuRoot as DropdownMenu,
  DropdownMenuTriggerPrimitive as DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItemPrimitive as DropdownMenuItem,
  DropdownMenuSeparator,
}
