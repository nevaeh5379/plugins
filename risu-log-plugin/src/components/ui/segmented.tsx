import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

export interface SegmentedOption {
  label: React.ReactNode
  value: string
  icon?: React.ReactNode
  disabled?: boolean
}

export interface SegmentedProps {
  options: (string | SegmentedOption)[]
  value?: string
  onChange?: (value: string) => void
  block?: boolean
  disabled?: boolean
  size?: 'small' | 'default' | string
  className?: string
  style?: React.CSSProperties
}

const Segmented: React.FC<SegmentedProps> = ({
  options,
  value,
  onChange,
  block = false,
  disabled = false,
  className,
  style,
}) => {
  const normalizedOptions: SegmentedOption[] = options.map((opt) =>
    typeof opt === "string" ? { label: opt, value: opt } : opt
  )

  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={(val) => !disabled && onChange?.(val)}
      className={cn("w-full", className)}
      style={style}
    >
      <TabsPrimitive.List
        style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
        className={cn(
          "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground border border-border",
          block ? "w-full" : ""
        )}
      >
        {normalizedOptions.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <TabsPrimitive.Trigger
              key={opt.value}
              value={opt.value}
              disabled={disabled || opt.disabled}
              style={{
                backgroundColor: isSelected ? 'var(--card)' : 'transparent',
                color: isSelected ? 'var(--foreground)' : 'var(--muted-foreground)',
                border: isSelected ? '1px solid var(--border)' : '1px solid transparent',
              }}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow",
                block ? "flex-1" : ""
              )}
            >
              {opt.icon}
              {opt.label}
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  )
}

export { Segmented }
