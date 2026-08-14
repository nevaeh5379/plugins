/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        primary: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 rounded-md px-2.5 text-xs",
        lg: "h-9 rounded-md px-4 text-sm",
        icon: "h-8 w-8",
        small: "h-7 rounded-md px-2.5 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  type?: 'submit' | 'reset' | 'button' | 'primary' | 'default' | 'dashed' | 'link' | 'text'
  danger?: boolean
  icon?: React.ReactNode
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", danger, icon, loading, asChild = false, style, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    let computedVariant = variant || "default"
    if (type === "primary") computedVariant = danger ? "destructive" : "primary"
    else if (danger) computedVariant = "destructive"
    else if (type === "link") computedVariant = "link"
    else if (type === "text") computedVariant = "ghost"

    const htmlType = (type === 'submit' || type === 'reset' || type === 'button') ? type : 'button'

    const getVariantStyles = (): React.CSSProperties => {
      if (computedVariant === 'primary') return { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }
      if (computedVariant === 'destructive') return { backgroundColor: 'var(--destructive)', color: 'var(--destructive-foreground)' }
      if (computedVariant === 'secondary') return { backgroundColor: 'var(--secondary)', color: 'var(--secondary-foreground)', borderColor: 'var(--border)' }
      if (computedVariant === 'outline' || computedVariant === 'default') return { backgroundColor: 'var(--card)', color: 'var(--foreground)', borderColor: 'var(--border)' }
      return {}
    }

    return (
      <Comp
        style={{ ...getVariantStyles(), ...style }}
        className={cn(buttonVariants({ variant: computedVariant, size, className }))}
        ref={ref}
        type={htmlType}
        {...props}
      >
        {loading ? (
          <span className="animate-spin">⏳</span>
        ) : (
          icon
        )}
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
