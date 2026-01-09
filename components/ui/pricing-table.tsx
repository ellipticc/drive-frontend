import * as React from "react"
import { cn } from "@/lib/utils"

const PricingTable = React.forwardRef<
    HTMLTableElement,
    React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
    <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
    />
))
PricingTable.displayName = "PricingTable"

export { PricingTable }
