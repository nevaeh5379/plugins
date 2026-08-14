import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SpinProps {
  size?: "small" | "default" | "large" | "sm" | "lg"
  tip?: React.ReactNode
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

const Spin: React.FC<SpinProps> = ({
  size = "default",
  tip,
  children,
  className,
  style,
}) => {
  const isSmall = size === "small" || size === "sm"
  const isLarge = size === "large" || size === "lg"
  const iconSizeClass = isSmall ? "h-4 w-4" : isLarge ? "h-8 w-8" : "h-6 w-6"

  const spinner = (
    <div className={cn("inline-flex flex-col items-center justify-center gap-2", className)} style={style}>
      <Loader2 className={cn("animate-spin text-primary", iconSizeClass)} />
      {tip && <span className="text-xs text-muted-foreground">{tip}</span>}
    </div>
  )

  if (children) {
    return (
      <div className="relative">
        {children}
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          {spinner}
        </div>
      </div>
    )
  }

  return spinner
}

export { Spin }
