import * as React from "react"
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ResultProps {
  status?: "success" | "error" | "info" | "warning"
  title?: React.ReactNode
  subTitle?: React.ReactNode
  extra?: React.ReactNode
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

const Result: React.FC<ResultProps> = ({
  status = "info",
  title,
  subTitle,
  extra,
  children,
  className,
  style,
}) => {
  let icon = <Info className="h-12 w-12 text-blue-500" />
  if (status === "success") icon = <CheckCircle2 className="h-12 w-12 text-emerald-500" />
  else if (status === "error") icon = <AlertCircle className="h-12 w-12 text-destructive" />
  else if (status === "warning") icon = <AlertTriangle className="h-12 w-12 text-amber-500" />

  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center gap-3", className)} style={style}>
      <div className="mb-1">{icon}</div>
      {title && <h3 className="text-lg font-semibold text-foreground tracking-tight">{title}</h3>}
      {subTitle && <p className="text-xs text-muted-foreground max-w-sm">{subTitle}</p>}
      {extra && <div className="mt-3 flex gap-2">{extra}</div>}
      {children}
    </div>
  )
}

export { Result }
