"use client";

import type { MouseEventHandler, ReactNode } from "react";
import { X as CloseX } from "@untitledui/icons";
import { Dot } from "@/components/foundations/dot-icon";
import { cx } from "@/utils/cx";
import Image from "next/image";
import type { BadgeColors, BadgeTypeToColorMap, BadgeTypes, FlagTypes, IconComponentType, Sizes } from "./badge-types";
import { badgeTypes } from "./badge-types";

export const filledColors: Record<BadgeColors, { root: string; addon: string; addonButton: string }> = {
    gray: {
        root: "bg-muted text-muted-foreground ring-border",
        addon: "text-muted-foreground",
        addonButton: "hover:bg-muted text-muted-foreground hover:text-foreground",
    },
    brand: {
        root: "bg-primary text-primary-foreground ring-ring",
        addon: "text-primary-foreground/70",
        addonButton: "hover:bg-primary/80 text-primary-foreground/70 hover:text-primary-foreground",
    },
    error: {
        root: "bg-destructive text-destructive-foreground ring-destructive/20",
        addon: "text-destructive-foreground/70",
        addonButton: "hover:bg-destructive/80 text-destructive-foreground/70 hover:text-destructive-foreground",
    },
    warning: {
        root: "bg-yellow-500/10 text-yellow-600 ring-yellow-500/20 dark:bg-yellow-400/10 dark:text-yellow-400",
        addon: "text-yellow-600/70 dark:text-yellow-400/70",
        addonButton: "hover:bg-yellow-500/20 text-yellow-600/70 hover:text-yellow-600 dark:hover:bg-yellow-400/20 dark:text-yellow-400/70 dark:hover:text-yellow-400",
    },
    success: {
        root: "bg-green-500/10 text-green-600 ring-green-500/20 dark:bg-green-400/10 dark:text-green-400",
        addon: "text-green-600/70 dark:text-green-400/70",
        addonButton: "hover:bg-green-500/20 text-green-600/70 hover:text-green-600 dark:hover:bg-green-400/20 dark:text-green-400/70 dark:hover:text-green-400",
    },
    "gray-blue": {
        root: "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-400",
        addon: "text-slate-600/70 dark:text-slate-400/70",
        addonButton: "hover:bg-slate-500/20 text-slate-600/70 hover:text-slate-600 dark:hover:bg-slate-400/20 dark:text-slate-400/70 dark:hover:text-slate-400",
    },
    "blue-light": {
        root: "bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:bg-blue-400/10 dark:text-blue-400",
        addon: "text-blue-600/70 dark:text-blue-400/70",
        addonButton: "hover:bg-blue-500/20 text-blue-600/70 hover:text-blue-600 dark:hover:bg-blue-400/20 dark:text-blue-400/70 dark:hover:text-blue-400",
    },
    blue: {
        root: "bg-blue-600/10 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-500",
        addon: "text-blue-700/70 dark:text-blue-500/70",
        addonButton: "hover:bg-blue-600/20 text-blue-700/70 hover:text-blue-700 dark:hover:bg-blue-500/20 dark:text-blue-500/70 dark:hover:text-blue-500",
    },
    indigo: {
        root: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:bg-indigo-400/10 dark:text-indigo-400",
        addon: "text-indigo-600/70 dark:text-indigo-400/70",
        addonButton: "hover:bg-indigo-500/20 text-indigo-600/70 hover:text-indigo-600 dark:hover:bg-indigo-400/20 dark:text-indigo-400/70 dark:hover:text-indigo-400",
    },
    purple: {
        root: "bg-purple-500/10 text-purple-600 ring-purple-500/20 dark:bg-purple-400/10 dark:text-purple-400",
        addon: "text-purple-600/70 dark:text-purple-400/70",
        addonButton: "hover:bg-purple-500/20 text-purple-600/70 hover:text-purple-600 dark:hover:bg-purple-400/20 dark:text-purple-400/70 dark:hover:text-purple-400",
    },
    pink: {
        root: "bg-pink-500/10 text-pink-600 ring-pink-500/20 dark:bg-pink-400/10 dark:text-pink-400",
        addon: "text-pink-600/70 dark:text-pink-400/70",
        addonButton: "hover:bg-pink-500/20 text-pink-600/70 hover:text-pink-600 dark:hover:bg-pink-400/20 dark:text-pink-400/70 dark:hover:text-pink-400",
    },
    orange: {
        root: "bg-orange-500/10 text-orange-600 ring-orange-500/20 dark:bg-orange-400/10 dark:text-orange-400",
        addon: "text-orange-600/70 dark:text-orange-400/70",
        addonButton: "hover:bg-orange-500/20 text-orange-600/70 hover:text-orange-600 dark:hover:bg-orange-400/20 dark:text-orange-400/70 dark:hover:text-orange-400",
    },
};

const addonOnlyColors = Object.fromEntries(Object.entries(filledColors).map(([key, value]) => [key, { root: "", addon: value.addon }])) as Record<
    BadgeColors,
    { root: string; addon: string }
>;

const withPillTypes = {
    [badgeTypes.pillColor]: {
        common: "size-max flex items-center whitespace-nowrap rounded-full ring-1 ring-inset",
        styles: filledColors,
    },
    [badgeTypes.badgeColor]: {
        common: "size-max flex items-center whitespace-nowrap rounded-md ring-1 ring-inset",
        styles: filledColors,
    },
    [badgeTypes.badgeModern]: {
        common: "size-max flex items-center whitespace-nowrap rounded-md ring-1 ring-inset shadow-xs",
        styles: {
            gray: {
                root: "bg-card text-card-foreground ring-border",
                addon: "text-muted-foreground",
                addonButton: "hover:bg-muted text-muted-foreground hover:text-foreground",
            },
        },
    },
};

const withBadgeTypes = {
    [badgeTypes.pillColor]: {
        common: "size-max flex items-center whitespace-nowrap rounded-full ring-1 ring-inset",
        styles: filledColors,
    },
    [badgeTypes.badgeColor]: {
        common: "size-max flex items-center whitespace-nowrap rounded-md ring-1 ring-inset",
        styles: filledColors,
    },
    [badgeTypes.badgeModern]: {
        common: "size-max flex items-center whitespace-nowrap rounded-md ring-1 ring-inset bg-card text-card-foreground ring-border shadow-xs",
        styles: addonOnlyColors,
    },
};

export type BadgeColor<T extends BadgeTypes> = BadgeTypeToColorMap<typeof withPillTypes>[T];

interface BadgeProps<T extends BadgeTypes> {
    type?: T;
    size?: Sizes;
    color?: BadgeColor<T>;
    children: ReactNode;
    className?: string;
}

export const Badge = <T extends BadgeTypes>(props: BadgeProps<T>) => {
    const { type = "pill-color", size = "md", color = "gray", children } = props;
    const colors = withPillTypes[type];

    const pillSizes = {
        sm: "py-0.5 px-2 text-xs font-medium",
        md: "py-0.5 px-2.5 text-sm font-medium",
        lg: "py-1 px-3 text-sm font-medium",
    };
    const badgeSizes = {
        sm: "py-0.5 px-1.5 text-xs font-medium",
        md: "py-0.5 px-2 text-sm font-medium",
        lg: "py-1 px-2.5 text-sm font-medium rounded-lg",
    };

    const sizes = {
        [badgeTypes.pillColor]: pillSizes,
        [badgeTypes.badgeColor]: badgeSizes,
        [badgeTypes.badgeModern]: badgeSizes,
    };

    return <span className={cx(colors.common, sizes[type][size], colors.styles[color].root, props.className)}>{children}</span>;
};

interface BadgeWithDotProps<T extends BadgeTypes> {
    type?: T;
    size?: Sizes;
    color?: BadgeTypeToColorMap<typeof withBadgeTypes>[T];
    className?: string;
    children: ReactNode;
}

export const BadgeWithDot = <T extends BadgeTypes>(props: BadgeWithDotProps<T>) => {
    const { size = "md", color = "gray", type = "pill-color", className, children } = props;

    const colors = withBadgeTypes[type];

    const pillSizes = {
        sm: "gap-1 py-0.5 pl-1.5 pr-2 text-xs font-medium",
        md: "gap-1.5 py-0.5 pl-2 pr-2.5 text-sm font-medium",
        lg: "gap-1.5 py-1 pl-2.5 pr-3 text-sm font-medium",
    };

    const badgeSizes = {
        sm: "gap-1 py-0.5 px-1.5 text-xs font-medium",
        md: "gap-1.5 py-0.5 px-2 text-sm font-medium",
        lg: "gap-1.5 py-1 px-2.5 text-sm font-medium rounded-lg",
    };

    const sizes = {
        [badgeTypes.pillColor]: pillSizes,
        [badgeTypes.badgeColor]: badgeSizes,
        [badgeTypes.badgeModern]: badgeSizes,
    };

    return (
        <span className={cx(colors.common, sizes[type][size], colors.styles[color].root, className)}>
            <Dot className={colors.styles[color].addon} size="sm" />
            {children}
        </span>
    );
};

interface BadgeWithIconProps<T extends BadgeTypes> {
    type?: T;
    size?: Sizes;
    color?: BadgeTypeToColorMap<typeof withBadgeTypes>[T];
    iconLeading?: IconComponentType;
    iconTrailing?: IconComponentType;
    children: ReactNode;
    className?: string;
}

export const BadgeWithIcon = <T extends BadgeTypes>(props: BadgeWithIconProps<T>) => {
    const { size = "md", color = "gray", type = "pill-color", iconLeading: IconLeading, iconTrailing: IconTrailing, children, className } = props;

    const colors = withBadgeTypes[type];

    const icon = IconLeading ? "leading" : "trailing";

    const pillSizes = {
        sm: {
            trailing: "gap-0.5 py-0.5 pl-2 pr-1.5 text-xs font-medium",
            leading: "gap-0.5 py-0.5 pr-2 pl-1.5 text-xs font-medium",
        },
        md: {
            trailing: "gap-1 py-0.5 pl-2.5 pr-2 text-sm font-medium",
            leading: "gap-1 py-0.5 pr-2.5 pl-2 text-sm font-medium",
        },
        lg: {
            trailing: "gap-1 py-1 pl-3 pr-2.5 text-sm font-medium",
            leading: "gap-1 py-1 pr-3 pl-2.5 text-sm font-medium",
        },
    };
    const badgeSizes = {
        sm: {
            trailing: "gap-0.5 py-0.5 pl-2 pr-1.5 text-xs font-medium",
            leading: "gap-0.5 py-0.5 pr-2 pl-1.5 text-xs font-medium",
        },
        md: {
            trailing: "gap-1 py-0.5 pl-2 pr-1.5 text-sm font-medium",
            leading: "gap-1 py-0.5 pr-2 pl-1.5 text-sm font-medium",
        },
        lg: {
            trailing: "gap-1 py-1 pl-2.5 pr-2 text-sm font-medium rounded-lg",
            leading: "gap-1 py-1 pr-2.5 pl-2 text-sm font-medium rounded-lg",
        },
    };

    const sizes = {
        [badgeTypes.pillColor]: pillSizes,
        [badgeTypes.badgeColor]: badgeSizes,
        [badgeTypes.badgeModern]: badgeSizes,
    };

    return (
        <span className={cx(colors.common, sizes[type][size][icon], colors.styles[color].root, className)}>
            {IconLeading && <IconLeading className={cx(colors.styles[color].addon, "size-3 stroke-3")} />}
            {children}
            {IconTrailing && <IconTrailing className={cx(colors.styles[color].addon, "size-3 stroke-3")} />}
        </span>
    );
};

interface BadgeWithFlagProps<T extends BadgeTypes> {
    type?: T;
    size?: Sizes;
    flag?: FlagTypes;
    color?: BadgeTypeToColorMap<typeof withPillTypes>[T];
    children: ReactNode;
}

export const BadgeWithFlag = <T extends BadgeTypes>(props: BadgeWithFlagProps<T>) => {
    const { size = "md", color = "gray", flag = "AU", type = "pill-color", children } = props;

    const colors = withPillTypes[type];

    const pillSizes = {
        sm: "gap-1 py-0.5 pl-0.75 pr-2 text-xs font-medium",
        md: "gap-1.5 py-0.5 pl-1 pr-2.5 text-sm font-medium",
        lg: "gap-1.5 py-1 pl-1.5 pr-3 text-sm font-medium",
    };
    const badgeSizes = {
        sm: "gap-1 py-0.5 pl-1 pr-1.5 text-xs font-medium",
        md: "gap-1.5 py-0.5 pl-1.5 pr-2 text-sm font-medium",
        lg: "gap-1.5 py-1 pl-2 pr-2.5 text-sm font-medium rounded-lg",
    };

    const sizes = {
        [badgeTypes.pillColor]: pillSizes,
        [badgeTypes.badgeColor]: badgeSizes,
        [badgeTypes.badgeModern]: badgeSizes,
    };

    return (
        <span className={cx(colors.common, sizes[type][size], colors.styles[color].root)}>
            <Image src={`https://www.untitledui.com/images/flags/${flag}.svg`} width={16} height={16} className="size-4 max-w-none rounded-full" alt={`${flag} flag`} />
            {children}
        </span>
    );
};

interface BadgeWithImageProps<T extends BadgeTypes> {
    type?: T;
    size?: Sizes;
    imgSrc: string;
    color?: BadgeTypeToColorMap<typeof withPillTypes>[T];
    children: ReactNode;
}

export const BadgeWithImage = <T extends BadgeTypes>(props: BadgeWithImageProps<T>) => {
    const { size = "md", color = "gray", type = "pill-color", imgSrc, children } = props;

    const colors = withPillTypes[type];

    const pillSizes = {
        sm: "gap-1 py-0.5 pl-0.75 pr-2 text-xs font-medium",
        md: "gap-1.5 py-0.5 pl-1 pr-2.5 text-sm font-medium",
        lg: "gap-1.5 py-1 pl-1.5 pr-3 text-sm font-medium",
    };
    const badgeSizes = {
        sm: "gap-1 py-0.5 pl-1 pr-1.5 text-xs font-medium",
        md: "gap-1.5 py-0.5 pl-1.5 pr-2 text-sm font-medium",
        lg: "gap-1.5 py-1 pl-2 pr-2.5 text-sm font-medium rounded-lg",
    };

    const sizes = {
        [badgeTypes.pillColor]: pillSizes,
        [badgeTypes.badgeColor]: badgeSizes,
        [badgeTypes.badgeModern]: badgeSizes,
    };

    return (
        <span className={cx(colors.common, sizes[type][size], colors.styles[color].root)}>
            <Image src={imgSrc} width={16} height={16} className="size-4 max-w-none rounded-full" alt="Badge image" />
            {children}
        </span>
    );
};

interface BadgeWithButtonProps<T extends BadgeTypes> {
    type?: T;
    size?: Sizes;
    icon?: IconComponentType;
    color?: BadgeTypeToColorMap<typeof withPillTypes>[T];
    children: ReactNode;
    /**
     * The label for the button.
     */
    buttonLabel?: string;
    /**
     * The click event handler for the button.
     */
    onButtonClick?: MouseEventHandler<HTMLButtonElement>;
}

export const BadgeWithButton = <T extends BadgeTypes>(props: BadgeWithButtonProps<T>) => {
    const { size = "md", color = "gray", type = "pill-color", icon: Icon = CloseX, buttonLabel, children } = props;

    const colors = withPillTypes[type];

    const pillSizes = {
        sm: "gap-0.5 py-0.5 pl-2 pr-0.75 text-xs font-medium",
        md: "gap-0.5 py-0.5 pl-2.5 pr-1 text-sm font-medium",
        lg: "gap-0.5 py-1 pl-3 pr-1.5 text-sm font-medium",
    };
    const badgeSizes = {
        sm: "gap-0.5 py-0.5 pl-1.5 pr-0.75 text-xs font-medium",
        md: "gap-0.5 py-0.5 pl-2 pr-1 text-sm font-medium",
        lg: "gap-0.5 py-1 pl-2.5 pr-1.5 text-sm font-medium rounded-lg",
    };

    const sizes = {
        [badgeTypes.pillColor]: pillSizes,
        [badgeTypes.badgeColor]: badgeSizes,
        [badgeTypes.badgeModern]: badgeSizes,
    };

    return (
        <span className={cx(colors.common, sizes[type][size], colors.styles[color].root)}>
            {children}
            <button
                type="button"
                aria-label={buttonLabel}
                onClick={props.onButtonClick}
                className={cx(
                    "flex cursor-pointer items-center justify-center p-0.5 outline-focus-ring transition duration-100 ease-linear focus-visible:outline-2",
                    colors.styles[color].addonButton,
                    type === "pill-color" ? "rounded-full" : "rounded-[3px]",
                )}
            >
                <Icon className="size-3 stroke-[3px] transition-inherit-all" />
            </button>
        </span>
    );
};

interface BadgeIconProps<T extends BadgeTypes> {
    type?: T;
    size?: Sizes;
    icon: IconComponentType;
    color?: BadgeTypeToColorMap<typeof withPillTypes>[T];
    children?: ReactNode;
}

export const BadgeIcon = <T extends BadgeTypes>(props: BadgeIconProps<T>) => {
    const { size = "md", color = "gray", type = "pill-color", icon: Icon } = props;

    const colors = withPillTypes[type];

    const pillSizes = {
        sm: "p-1.25",
        md: "p-1.5",
        lg: "p-2",
    };

    const badgeSizes = {
        sm: "p-1.25",
        md: "p-1.5",
        lg: "p-2 rounded-lg",
    };

    const sizes = {
        [badgeTypes.pillColor]: pillSizes,
        [badgeTypes.badgeColor]: badgeSizes,
        [badgeTypes.badgeModern]: badgeSizes,
    };

    return (
        <span className={cx(colors.common, sizes[type][size], colors.styles[color].root)}>
            <Icon className={cx("size-3 stroke-[3px]", colors.styles[color].addon)} />
        </span>
    );
};
