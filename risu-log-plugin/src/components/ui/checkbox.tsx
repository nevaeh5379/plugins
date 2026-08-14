import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CheckboxProps extends Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, 'onChange'> {
  onChange?: (e: { target: { checked: boolean } }) => void
  children?: React.ReactNode
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, onChange, onCheckedChange, checked, children, style, ...props }, ref) => {
  const handleCheckedChange = (val: boolean) => {
    onCheckedChange?.(val)
    onChange?.({ target: { checked: val } })
  }

  const checkboxEl = (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked}
      onCheckedChange={handleCheckedChange}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        className
      )}
      style={children ? undefined : style}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("flex items-center justify-center text-current")}
      >
        <Check className="h-3.5 w-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )

  if (children) {
    return (
      <label className="inline-flex items-center gap-2 text-xs text-foreground cursor-pointer select-none" style={style}>
        {checkboxEl}
        <span>{children}</span>
      </label>
    )
  }

  return checkboxEl
})
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
