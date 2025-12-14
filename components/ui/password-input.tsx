import * as React from "react"
import { IconEye, IconEyeOff } from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface PasswordInputProps extends React.ComponentProps<"input"> {}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)

    return (
      <div className="relative">
        <Input
          type={showPassword ? "text" : "password"}
          className={cn("pr-10", className)}
          ref={ref}
          {...props}
        />
        <button
          type="button"
          className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 flex items-center justify-center"
          onClick={() => setShowPassword((prev) => !prev)}
          disabled={props.disabled}
        >
          {showPassword ? (
            <IconEyeOff className="h-4 w-4" />
          ) : (
            <IconEye className="h-4 w-4" />
          )}
          <span className="sr-only">
            {showPassword ? "Hide password" : "Show password"}
          </span>
        </button>
      </div>
    )
  }
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }