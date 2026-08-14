import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

export interface LegacySliderProps extends Omit<React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>, 'value' | 'onChange'> {
  min?: number
  max?: number
  step?: number
  value?: number | number[]
  onChange?: (value: number) => void
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  LegacySliderProps
>(({ className, min = 0, max = 100, step = 1, value, onChange, disabled, ...props }, ref) => {
  const handleValueChange = (val: number[]) => {
    onChange?.(val[0])
  }

  const sliderValue = Array.isArray(value) ? value : value !== undefined ? [value] : undefined

  return (
    <SliderPrimitive.Root
      ref={ref}
      min={min}
      max={max}
      step={step}
      value={sliderValue}
      onValueChange={handleValueChange}
      disabled={disabled}
      className={cn(
        "relative flex w-full touch-none select-none items-center py-2",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        style={{ backgroundColor: 'var(--muted, #3f3f46)' }}
        className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted"
      >
        <SliderPrimitive.Range
          style={{ backgroundColor: 'var(--primary, #2563eb)' }}
          className="absolute h-full bg-primary"
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        style={{ backgroundColor: 'var(--primary, #2563eb)', borderColor: '#ffffff' }}
        className="block h-4 w-4 rounded-full border-2 border-white bg-primary shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
      />
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
