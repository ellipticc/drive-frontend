import {
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


    // Feature Preferences
    autoPaperVersioning: boolean;
    setAutoPaperVersioning: (val: boolean) => void;
    autoEventInsights: boolean;
    setAutoEventInsights: (val: boolean) => void;
    showCheckmark: boolean;
    setShowCheckmark: (val: boolean) => void;
}

export function PreferencesTab({
    autoPaperVersioning,
    setAutoPaperVersioning,
    autoEventInsights,
    setAutoEventInsights,
    showCheckmark,
    setShowCheckmark,
}: PreferencesTabProps) {
    const { t } = useLanguage()

    return (
        <div className="space-y-8 pb-8">
            <h2 className="text-xl font-semibold">{t('settings.preferences') || 'Preferences'}</h2>

            {/* Smart Features Section */}
            <div className="pt-2 space-y-6">
                <h3 className="text-lg font-semibold">Smart Features</h3>

                <div className="space-y-4">
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
