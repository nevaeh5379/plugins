import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  addonAfter?: React.ReactNode
  size?: 'small' | 'middle' | 'large' | 'sm' | 'default' | 'lg'
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, prefix, suffix, addonAfter, size = 'default', ...props }, ref) => {
    const isSmall = size === 'small' || size === 'sm'

    if (prefix || suffix || addonAfter) {
      return (
        <div className="flex items-center w-full relative">
          <div
            className={cn(
              "flex items-center w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring",
              isSmall ? "h-7" : "h-8.5",
              addonAfter ? "rounded-r-none" : ""
            )}
          >
            {prefix && <span className="mr-1.5 flex items-center text-muted-foreground">{prefix}</span>}
            <input
              type={type}
              className={cn(
                "flex h-full w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                className
              )}
              ref={ref}
              {...props}
            />
            {suffix && <span className="ml-1.5 flex items-center text-muted-foreground">{suffix}</span>}
          </div>
          {addonAfter && (
            <div
              className={cn(
                "flex items-center px-2.5 bg-muted text-muted-foreground border border-l-0 border-input rounded-r-md text-xs whitespace-nowrap",
                isSmall ? "h-7" : "h-8.5"
              )}
            >
              {addonAfter}
            </div>
          )}
        </div>
      )
    }

    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-sm transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          isSmall ? "h-7 text-[11px]" : "h-8.5 text-xs",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
) as React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>> & {
  TextArea: typeof Textarea
  Password: typeof PasswordInput
}

Input.displayName = "Input"

const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  (props, ref) => <Input ref={ref} type="password" {...props} />
)
PasswordInput.displayName = "Input.Password"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoSize?: boolean | { minRows?: number; maxRows?: number }
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoSize, ...props }, ref) => {
    const minRows = typeof autoSize === 'object' && autoSize.minRows ? autoSize.minRows : 3
    return (
      <textarea
        rows={minRows}
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

Input.TextArea = Textarea
Input.Password = PasswordInput

export { Input, Textarea, PasswordInput }
