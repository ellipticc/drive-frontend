import * as React from "react"
import { cn } from "@/lib/utils"

interface SectionGroupProps extends React.ComponentPropsWithoutRef<"div"> {
    variant?: "default" | "wide" | "full";
}

function SectionGroup({ className, variant = "default", ...props }: SectionGroupProps) {
    const maxWidth = {
        default: "max-w-4xl",
        wide: "max-w-6xl",
        full: "max-w-7xl"
    }[variant];

    return (
        <div className={cn(
            "mx-auto px-6 py-10 space-y-12",
            maxWidth,
            className
        )} {...props} />
    )
}

type SectionProps = React.ComponentPropsWithoutRef<"section">

function Section({ className, ...props }: SectionProps) {
    return (
        <section className={cn("flex flex-col gap-4", className)} {...props} />
    )
}

type SectionHeaderProps = React.ComponentPropsWithoutRef<"div">

function SectionHeader({ className, ...props }: SectionHeaderProps) {
    return (
        <div className={cn("flex flex-col gap-1", className)} {...props} />
    )
}

type SectionTitleProps = React.ComponentPropsWithoutRef<"h2">

function SectionTitle({ className, ...props }: SectionTitleProps) {
    return (
        <h2
            className={cn(
                "text-lg font-medium tracking-tight text-foreground font-sans",
                className
            )}
            {...props}
        />
    )
}

type SectionDescriptionProps = React.ComponentPropsWithoutRef<"p">

function SectionDescription({ className, ...props }: SectionDescriptionProps) {
    return (
        <p
            className={cn("text-sm text-muted-foreground font-mono", className)}
            {...props}
        />
    )
}

export {
    SectionGroup,
    Section,
    SectionHeader,
    SectionTitle,
    SectionDescription,
}
