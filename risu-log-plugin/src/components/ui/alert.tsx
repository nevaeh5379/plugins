import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border p-3.5 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-3.5 [&>svg]:top-3.5 [&>svg]:text-foreground text-xs",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground border-border",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive bg-destructive/10",
        warning:
          "border-amber-500/50 text-amber-500 [&>svg]:text-amber-500 bg-amber-500/10",
        info: "border-blue-500/50 text-blue-500 [&>svg]:text-blue-500 bg-blue-500/10",
        success:
          "border-emerald-500/50 text-emerald-500 [&>svg]:text-emerald-500 bg-emerald-500/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  type?: "warning" | "info" | "error" | "success"
  message?: React.ReactNode
  description?: React.ReactNode
  showIcon?: boolean
  icon?: React.ReactNode
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      variant,
      type = "info",
      message,
      description,
      showIcon = false,
      icon,
      children,
      ...props
    },
    ref
  ) => {
    const computedVariant = variant || (type === "error" ? "destructive" : type)

    let iconElement = icon
    if (!iconElement && (showIcon || icon !== undefined)) {
      if (computedVariant === "destructive") iconElement = <AlertCircle className="h-4 w-4" />
      else if (computedVariant === "warning") iconElement = <AlertTriangle className="h-4 w-4" />
      else if (computedVariant === "success") iconElement = <CheckCircle2 className="h-4 w-4" />
      else iconElement = <Info className="h-4 w-4" />
    }

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant: computedVariant }), className)}
        {...props}
      >
        {iconElement}
        <div>
          {(message || children) && <AlertTitle>{message || children}</AlertTitle>}
          {description && <AlertDescription>{description}</AlertDescription>}
        </div>
      </div>
    )
  }
)
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight text-xs mb-1", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-xs opacity-90 [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
