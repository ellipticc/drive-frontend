import {
    IconSparkles,
    IconHistory,
    IconBrain,
    IconChecks,
    IconRosetteDiscountCheckFilled,
    IconArrowsShuffle,
} from "@tabler/icons-react"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useLanguage } from "@/lib/i18n/language-context"
import type { Language } from "@/lib/i18n/dictionaries"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { IconCheck as IconCheckmark, IconInfoCircle } from "@tabler/icons-react"

interface PreferencesTabProps {
    // Appearance
    appearanceTheme: string;
    setAppearanceTheme: (theme: string) => void;
    themeSync: boolean;
    setThemeSync: (sync: boolean) => void;
    theme: string | undefined;
    setTheme: (theme: string) => void;

    // Feature Preferences
    showSuggestions: boolean;
    setShowSuggestions: (val: boolean) => void;
    autoPaperVersioning: boolean;
    setAutoPaperVersioning: (val: boolean) => void;
    autoEventInsights: boolean;
    setAutoEventInsights: (val: boolean) => void;
    showCheckmark: boolean;
    setShowCheckmark: (val: boolean) => void;
}

export function PreferencesTab({
    appearanceTheme,
    setAppearanceTheme,
    themeSync,
    setThemeSync,
    theme,
    setTheme,
    showSuggestions,
    setShowSuggestions,
    autoPaperVersioning,
    setAutoPaperVersioning,
    autoEventInsights,
    setAutoEventInsights,
    showCheckmark,
    setShowCheckmark,
}: PreferencesTabProps) {
    const { t } = useLanguage()

    const themes = [
        { id: 'default', name: 'Default', colors: ['#ffffff', '#000000', '#f3f4f6'] },
        { id: 'mocha-mousse', name: 'Mocha Mousse', colors: ['#f3f0e9', '#a67c52', '#d9c8a9'] },
        { id: 'quantum-rose', name: 'Quantum Rose', colors: ['#fcecf1', '#e91e63', '#f8bbd0'] },
        { id: 'cosmic-night', name: 'Cosmic Night', colors: ['#922137', '#17223b', '#2e3a59'] },
        { id: 'claude', name: 'Claude', colors: ['#981805', '#267966', '#f8f1e7'] },
        { id: 'mono', name: 'Mono', colors: ['#000000', '#ffffff', '#709090'] },
        { id: 'caffeine', name: 'Caffeine', colors: ['#6f5d54', '#ffffff', '#f2f0ef'] },
        { id: 'neo-brutalism', name: 'Neo Brutalism', colors: ['#ff0000', '#ffffff', '#f4f4f4'] },
        { id: 'perpetuity', name: 'Perpetuity', colors: ['#4a8b9e', '#f2f6f7', '#edf2f3'] },
        { id: 'soft-pop', name: 'Soft Pop', colors: ['#6e44ff', '#fefbf6', '#f3f4f6'] },
        { id: 'custom', name: 'Custom Theme', colors: ['#888888', '#555555', '#333333'], comingSoon: true },
    ]

    return (
        <div className="space-y-8 pb-8">
            <h2 className="text-xl font-semibold">{t('settings.preferences') || 'Preferences'}</h2>

            {/* Appearance Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h3 className="text-lg font-semibold">{t('settings.appearance')}</h3>
                        <p className="text-sm text-muted-foreground">Customize how Ellipticc looks on your device</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-dashed transition-all">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-background rounded-full border shadow-sm">
                                <IconChecks className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="space-y-0.5">
                                <Label className="text-sm font-semibold">Sync with system</Label>
                                <p className="text-xs text-muted-foreground">Automatically switch between light and dark modes</p>
                            </div>
                        </div>
                        <Switch
                            id="theme-sync"
                            checked={themeSync}
                            onCheckedChange={setThemeSync}
                        />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                        {themes.map((themeItem) => {
                            const themeButton = (
                                <button
                                    key={themeItem.id}
                                    onClick={() => !themeItem.comingSoon && setAppearanceTheme(themeItem.id)}
                                    disabled={themeItem.comingSoon}
                                    className={cn(
                                        "relative flex flex-col gap-2 p-1 group transition-all duration-300 outline-none w-full",
                                        appearanceTheme === themeItem.id ? "scale-[1.02]" : "hover:scale-[1.01]",
                                        themeItem.comingSoon && "opacity-60 grayscale cursor-not-allowed"
                                    )}
                                >
                                    <div className={cn(
                                        "relative w-full aspect-video rounded-xl overflow-hidden border-2 transition-all duration-300 shadow-sm",
                                        appearanceTheme === themeItem.id
                                            ? "border-primary ring-4 ring-primary/10"
                                            : "border-muted group-hover:border-primary/40"
                                    )}>
                                        {/* Theme Preview Skeleton */}
                                        <div className="absolute inset-0 flex flex-col">
                                            <div className="h-full w-1/3 bg-foreground/10 border-r border-foreground/5"
                                                style={{ backgroundColor: themeItem.id === 'default' ? '#f3f4f6' : themeItem.colors[2] }}
                                            />
                                            <div className="absolute top-2 right-2 w-12 h-2 rounded-full bg-foreground/20" />
                                            <div className="absolute top-6 right-2 w-16 h-2 rounded-full bg-foreground/10" />
                                            <div className="absolute top-10 right-2 w-14 h-2 rounded-full bg-foreground/10" />
                                        </div>

                                        {/* Selection Indicator */}
                                        {appearanceTheme === themeItem.id && (
                                            <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full p-0.5 shadow-lg">
                                                <IconCheckmark className="w-3 h-3 stroke-[3]" />
                                            </div>
                                        )}
                                    </div>
                                    <span className={cn(
                                        "text-xs font-medium text-center transition-colors",
                                        appearanceTheme === themeItem.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                    )}>
                                        {themeItem.name}
                                    </span>
                                </button>
                            );

                            if (themeItem.comingSoon) {
                                return (
                                    <Tooltip key={themeItem.id}>
                                        <TooltipTrigger asChild>
                                            <div className="w-full">{themeButton}</div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p>Coming soon</p>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            }

                            return themeButton;
                        })}
                    </div>

                    {!themeSync && (
                        <div className="flex items-center gap-2 pt-2">
                            <Select value={theme || "dark"} onValueChange={setTheme}>
                                <SelectTrigger id="theme-select" className="w-full max-w-[140px] rounded-xl h-9 bg-muted/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="light">{t('settings.theme.light')}</SelectItem>
                                    <SelectItem value="dark">{t('settings.theme.dark')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <span className="text-xs text-muted-foreground italic">Manual mode active</span>
                        </div>
                    )}
                </div>

                {/* Avatar Customization - Coming Soon */}
                <div className="mt-6 p-4 bg-muted/20 rounded-lg border border-dashed">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-background rounded-full border shadow-sm">
                                <IconArrowsShuffle className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="space-y-0.5">
                                <Label className="text-sm font-semibold">Default Avatar Style</Label>
                                <p className="text-xs text-muted-foreground">Customize your avatar appearance</p>
                            </div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground font-medium">
                            Coming Soon
                        </span>
                    </div>
                </div>
            </div>

            {/* Smart Features Section */}
            <div className="border-t pt-8 space-y-6">
                <h3 className="text-lg font-semibold">Smart Features</h3>

                <div className="space-y-4">
                    {/* Suggestions */}
                    <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-dashed transition-all hover:bg-muted/30">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-background rounded-full border shadow-sm">
                                <IconSparkles className="w-4 h-4 text-amber-500" />
                            </div>
                            <div className="space-y-0.5">
                                <Label className="text-sm font-semibold">{t('settings.suggestions.label') || 'Suggested for you'}</Label>
                                <p className="text-xs text-muted-foreground">{t('settings.suggestions.desc') || 'Show recommended files and activities based on your usage'}</p>
                            </div>
                        </div>
                        <Switch
                            id="show-suggestions"
                            checked={showSuggestions}
                            onCheckedChange={setShowSuggestions}
                        />
                    </div>

                    {/* Paper Versioning */}
                    <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-dashed transition-all hover:bg-muted/30">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-background rounded-full border shadow-sm">
                                <IconHistory className="w-4 h-4 text-blue-500" />
                            </div>
                            <div className="space-y-0.5">
                                <Label className="text-sm font-semibold">Automatic paper versioning</Label>
                                <p className="text-xs text-muted-foreground">Save snapshots of your Papers as you edit to prevent data loss</p>
                            </div>
                        </div>
                        <Switch
                            id="auto-paper-versioning"
                            checked={autoPaperVersioning}
                            onCheckedChange={setAutoPaperVersioning}
                        />
                    </div>

                    {/* Event Insights */}
                    <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-dashed transition-all hover:bg-muted/30">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-background rounded-full border shadow-sm">
                                <IconBrain className="w-4 h-4 text-purple-500" />
                            </div>
                            <div className="space-y-0.5">
                                <Label className="text-sm font-semibold">Automatic events insights</Label>
                                <p className="text-xs text-muted-foreground">Generate security insights from access logs using on-device processing</p>
                            </div>
                        </div>
                        <Switch
                            id="auto-event-insights"
                            checked={autoEventInsights}
                            onCheckedChange={setAutoEventInsights}
                        />
                    </div>
                </div>
            </div>

            {/* Privacy Section */}
            <div className="border-t pt-8 space-y-6">
                <h3 className="text-lg font-semibold">Privacy & Identity</h3>

                <div className="space-y-4">
                    {/* Show Checkmark */}
                    <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-dashed transition-all hover:bg-muted/30">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-background rounded-full border shadow-sm">
                                <IconRosetteDiscountCheckFilled className="w-4 h-4 text-sky-500" />
                            </div>
                            <div className="space-y-0.5">
                                <Label className="text-sm font-semibold">Show verified checkmark</Label>
                                <p className="text-xs text-muted-foreground">Display the verified checkmark next to your name throughout the app</p>
                            </div>
                        </div>
                        <Switch
                            id="show-checkmark"
                            checked={showCheckmark}
                            onCheckedChange={setShowCheckmark}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
