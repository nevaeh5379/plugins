/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { cn } from "@/lib/utils"

export interface TitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5
}

export const Title: React.FC<TitleProps> = ({ level = 1, className, children, ...props }) => {
  const sizeClasses = {
    1: "text-2xl font-bold tracking-tight",
    2: "text-xl font-semibold tracking-tight",
    3: "text-lg font-semibold",
    4: "text-base font-semibold",
    5: "text-xs font-semibold text-foreground",
  }

  const cls = cn(sizeClasses[level], className)
  if (level === 1) return <h1 className={cls} {...props}>{children}</h1>
  if (level === 2) return <h2 className={cls} {...props}>{children}</h2>
  if (level === 3) return <h3 className={cls} {...props}>{children}</h3>
  if (level === 4) return <h4 className={cls} {...props}>{children}</h4>
  return <h5 className={cls} {...props}>{children}</h5>
}

export const Text: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ className, children, ...props }) => (
  <span className={cn("text-xs text-foreground", className)} {...props}>
    {children}
  </span>
)

export const Paragraph: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, children, ...props }) => (
  <p className={cn("text-xs leading-relaxed text-foreground mb-2", className)} {...props}>
    {children}
  </p>
)

export const Typography = {
  Title,
  Text,
  Paragraph,
}
