import * as React from "react"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

interface BillingProgressProps extends React.ComponentPropsWithoutRef<"div"> {
    label: string
    current: string | number
    total: string | number
    unit?: string
}

function BillingProgress({
    label,
    current,
    total,
    unit = "",
    className,
    ...props
}: BillingProgressProps) {
    const currentNum = typeof current === "string" ? parseFloat(current) : current
    const totalNum = typeof total === "string" ? parseFloat(total) : total
    const percentage = totalNum > 0 ? (currentNum / totalNum) * 100 : 0

    return (
        <div className={cn("flex flex-col gap-2", className)} {...props}>
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                    {current} {unit} / {total} {unit}
                </p>
            </div>
            <Progress value={percentage} className="h-2" />
        </div>
    )
}

export { BillingProgress }
