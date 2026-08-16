import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

export interface SwitchProps extends Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>, 'onChange'> {
  size?: 'small' | 'default'
  onChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, size = 'default', onChange, onCheckedChange, checked, style, ...props }, ref) => {
  const isSmall = size === 'small'
  
  const handleCheckedChange = (val: boolean) => {
    onCheckedChange?.(val)
    onChange?.(val)
  }

  return (
    <SwitchPrimitives.Root
      style={{
        backgroundColor: checked ? 'var(--primary, #fafafa)' : 'var(--input, #27272a)',
        ...style
      }}
      className={cn(
        "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        isSmall ? "h-4.5 w-8" : "h-5 w-9",
        className
      )}
      checked={checked}
      onCheckedChange={handleCheckedChange}
      ref={ref}
      {...props}
    >
      <SwitchPrimitives.Thumb
        style={{
          backgroundColor: checked ? 'var(--primary-foreground, #09090b)' : '#fafafa',
        }}
        className={cn(
          "pointer-events-none block rounded-full shadow-lg ring-0 transition-transform data-[state=unchecked]:translate-x-0",
          isSmall ? "h-3.5 w-3.5 data-[state=checked]:translate-x-3.5" : "h-4 w-4 data-[state=checked]:translate-x-4"
        )}
      />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
