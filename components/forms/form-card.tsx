import * as React from "react"
import { cn } from "@/lib/utils"

interface FormCardProps extends React.ComponentPropsWithoutRef<"div"> { }

function FormCard({ className, ...props }: FormCardProps) {
    return (
        <div
            className={cn(
                "relative flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm",
                className
            )}
            {...props}
        />
    )
}

interface FormCardHeaderProps extends React.ComponentPropsWithoutRef<"div"> { }

function FormCardHeader({ className, ...props }: FormCardHeaderProps) {
    return (
        <div
            className={cn(
                "flex flex-col space-y-1.5 p-6 border-b",
                className
            )}
            {...props}
        />
    )
}

interface FormCardTitleProps extends React.ComponentPropsWithoutRef<"h3"> { }

function FormCardTitle({ className, ...props }: FormCardTitleProps) {
    return (
        <h3
            className={cn("font-semibold leading-none tracking-tight", className)}
            {...props}
        />
    )
}

interface FormCardDescriptionProps extends React.ComponentPropsWithoutRef<"p"> { }

function FormCardDescription({ className, ...props }: FormCardDescriptionProps) {
    return (
        <p
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    )
}

interface FormCardContentProps extends React.ComponentPropsWithoutRef<"div"> { }

function FormCardContent({ className, ...props }: FormCardContentProps) {
    return (
        <div className={cn("p-6", className)} {...props} />
    )
}

interface FormCardFooterProps extends React.ComponentPropsWithoutRef<"div"> { }

function FormCardFooter({ className, ...props }: FormCardFooterProps) {
    return (
        <div
            className={cn("flex items-center p-6 bg-muted/50 border-t rounded-b-xl", className)}
            {...props}
        />
    )
}

interface FormCardSeparatorProps extends React.ComponentPropsWithoutRef<"div"> { }

function FormCardSeparator({ className, ...props }: FormCardSeparatorProps) {
    return (
        <div
            className={cn("-mx-6 border-b", className)}
            {...props}
        />
    )
}

export {
    FormCard,
    FormCardHeader,
    FormCardFooter,
    FormCardTitle,
    FormCardDescription,
    FormCardContent,
    FormCardSeparator,
}
