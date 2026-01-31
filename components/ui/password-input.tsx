import * as React from "react"
import { IconEye, IconEyeOff } from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

type PasswordInputProps = React.ComponentProps<"input"> & {
  /** Controlled visibility (optional). If omitted, the component manages visibility internally. */
  show?: boolean
  /** Toggle handler used when `show` is provided. */
  onToggle?: () => void
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, show, onToggle, ...props }, ref) => {
    const [localShow, setLocalShow] = React.useState(false)
    const visible = typeof show === "boolean" ? show : localShow

    const handleToggle = () => {
      if (typeof onToggle === "function") {
        onToggle()
      } else {
        setLocalShow((prev) => !prev)
      }
    }

    return (
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
          ref={ref}
          {...props}
        />
        <button
          type="button"
          className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 flex items-center justify-center"
          onClick={handleToggle}
          disabled={props.disabled}
        >
          {visible ? (
            <IconEyeOff className="h-4 w-4" />
          ) : (
            <IconEye className="h-4 w-4" />
          )}
          <span className="sr-only">
            {visible ? "Hide password" : "Show password"}
          </span>
        </button>
      </div>
    )
  }
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }