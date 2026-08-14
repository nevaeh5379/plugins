import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface StepItem {
  title: React.ReactNode
  description?: React.ReactNode
}

export interface StepsProps {
  current?: number
  items: StepItem[]
  size?: 'small' | 'default' | string
  className?: string
  style?: React.CSSProperties
}

const Steps: React.FC<StepsProps> = ({ current = 0, items, className, style }) => {
  return (
    <div className={cn("flex w-full items-start gap-2", className)} style={style}>
      {items.map((item, idx) => {
        const isDone = idx < current
        const isCurrent = idx === current

        return (
          <React.Fragment key={idx}>
            <div className="flex flex-1 flex-col items-center min-w-0">
              <div className="flex items-center gap-2 w-full">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors border",
                    isDone || isCurrent
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  {isDone ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : idx + 1}
                </div>
                {idx < items.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 transition-colors",
                      isDone ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </div>
              <div className="mt-1.5 text-center w-full">
                <div
                  className={cn(
                    "text-xs",
                    isCurrent ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                  )}
                >
                  {item.title}
                </div>
                {item.description && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {item.description}
                  </div>
                )}
              </div>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}

export { Steps }
