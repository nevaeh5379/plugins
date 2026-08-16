/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SelectOption {
  label: React.ReactNode
  value: any
  disabled?: boolean
}

export interface LegacySelectProps {
  value?: any
  onChange?: (value: any) => void
  options?: readonly SelectOption[] | SelectOption[]
  disabled?: boolean
  size?: 'small' | 'middle' | 'large' | 'sm' | 'default' | 'lg'
  popupMatchSelectWidth?: boolean
  style?: React.CSSProperties
  className?: string
  placeholder?: string
  children?: React.ReactNode
}

export interface OptionProps {
  value: any
  children: React.ReactNode
  disabled?: boolean
}

const Option: React.FC<OptionProps> = ({ children }) => <>{children}</>

export interface SelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> {
  size?: 'small' | 'middle' | 'large' | 'sm' | 'default' | 'lg'
}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, size = 'default', style, ...props }, ref) => {
  const isSmall = size === 'small' || size === 'sm'

  return (
    <SelectPrimitive.Trigger
      ref={ref}
      style={{
        backgroundColor: 'var(--card, #18181b)',
        color: 'var(--foreground, #f4f4f5)',
        borderColor: 'var(--border, #27272a)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        caretColor: 'transparent',
        ...style,
      }}
      className={cn(
        "flex w-full cursor-pointer items-center justify-between rounded-md border border-input bg-card text-foreground shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        isSmall ? "h-7 px-2.5 py-1 text-xs" : "h-8.5 px-3 py-1.5 text-xs",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-3.5 w-3.5 opacity-50 ml-1.5 flex-shrink-0 text-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
})
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", style, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      style={{
        backgroundColor: 'var(--popover, #18181b)',
        color: 'var(--popover-foreground, #f4f4f5)',
        borderColor: 'var(--border, #27272a)',
        ...style,
      }}
      className={cn(
        "relative z-[10050] max-h-60 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, style, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    style={{
      userSelect: 'none',
      WebkitUserSelect: 'none',
      caretColor: 'transparent',
      ...style,
    }}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5 text-foreground" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const Select = React.forwardRef<HTMLDivElement, LegacySelectProps>(
  ({ value, onChange, options, disabled, size = 'default', style, className, placeholder = "선택...", children }, ref) => {
    const parsedOptions: readonly SelectOption[] = options || React.Children.toArray(children)
      .filter((child): child is React.ReactElement<OptionProps> => React.isValidElement<OptionProps>(child))
      .map((child) => ({
        value: child.props.value,
        label: child.props.children,
        disabled: child.props.disabled,
      }))

    return (
      <div ref={ref} style={style} className={cn("w-full", className)}>
        <SelectPrimitive.Root
          value={value !== undefined ? String(value) : undefined}
          onValueChange={(val) => onChange?.(val)}
          disabled={disabled}
        >
          <SelectTrigger size={size}>
            <SelectPrimitive.Value placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {parsedOptions.map((opt, idx) => (
              <SelectItem key={idx} value={String(opt.value)} disabled={opt.disabled}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </SelectPrimitive.Root>
      </div>
    )
  }
) as React.ForwardRefExoticComponent<LegacySelectProps & React.RefAttributes<HTMLDivElement>> & {
  Option: typeof Option
  Root: typeof SelectPrimitive.Root
  Trigger: typeof SelectTrigger
  Value: typeof SelectPrimitive.Value
  Content: typeof SelectContent
  Item: typeof SelectItem
}

Select.displayName = "Select"
Select.Option = Option
Select.Root = SelectPrimitive.Root
Select.Trigger = SelectTrigger
Select.Value = SelectPrimitive.Value
Select.Content = SelectContent
Select.Item = SelectItem

export { Select, SelectTrigger, SelectContent, SelectItem }
