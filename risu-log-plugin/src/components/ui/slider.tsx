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
        "relative flex w-full touch-none select-none items-center py-2 cursor-pointer outline-none",
        className
      )}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        caretColor: 'transparent',
        ...props.style,
      }}
      {...props}
    >
      <SliderPrimitive.Track
        style={{ backgroundColor: 'var(--muted, #27272a)' }}
        className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted cursor-pointer"
      >
        <SliderPrimitive.Range
          style={{ backgroundColor: 'var(--primary, #fafafa)' }}
          className="absolute h-full bg-primary"
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        style={{
          backgroundColor: 'var(--primary, #fafafa)',
          border: '2px solid var(--background, #09090b)',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
          outline: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          caretColor: 'transparent',
        }}
        className="block h-4 w-4 rounded-full bg-primary shadow transition-all hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing"
      />
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
