import React from 'react'
import {
    IconLanguage,
    IconCalendar,
    IconWorld,
    IconClock12,
    IconClock24,
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

interface LanguageTimeTabProps {
    language: string;
    setLanguage: (val: Language) => void;
    dateTimePreference: string;
    setDateTimePreference: (val: string) => void;
    dateFormat: string;
    setDateFormat: (val: string) => void;
    autoTimezone: boolean;
    setAutoTimezone: (val: boolean) => void;
    timezone: string;
    setTimezone: (val: string) => void;
}

export function LanguageTimeTab({
    language,
    setLanguage,
    dateTimePreference,
    setDateTimePreference,
    dateFormat,
    setDateFormat,
    autoTimezone,
    setAutoTimezone,
    timezone,
    setTimezone
}: LanguageTimeTabProps) {
    const { t } = useLanguage()

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold">{t('settings.languageTime') || 'Language & Time'}</h2>

            {/* Language Section */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('settings.language.label')}</h3>
                <div className="space-y-2">
                    <Label htmlFor="language-select" className="text-sm font-medium">
                        {t('settings.language.label')}
                    </Label>
                    <div className="flex items-center gap-2">
                        <IconLanguage className="h-4 w-4 text-muted-foreground" />
                        <Select value={language} onValueChange={(val) => setLanguage(val as Language)}>
                            <SelectTrigger id="language-select" className="w-full max-w-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="fr">Français</SelectItem>
                                <SelectItem value="es">Español</SelectItem>
                                <SelectItem value="de">Deutsch</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {t('settings.language.desc')}
                    </p>
                </div>
            </div>

            {/* Date & Time Section */}
            <div className="border-t pt-6 space-y-4">
                <h3 className="text-lg font-semibold">{t('settings.dateTime')}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Time Format */}
                    <div className="space-y-2">
                        <Label htmlFor="datetime-select" className="text-sm font-medium">
                            {t('settings.timeFormat.label')}
                        </Label>
                        <div className="flex items-center gap-2">
                            {dateTimePreference === '12h' ? (
                                <IconClock12 className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <IconClock24 className="h-4 w-4 text-muted-foreground" />
                            )}
                            <Select value={dateTimePreference} onValueChange={setDateTimePreference}>
                                <SelectTrigger id="datetime-select" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="12h">{t('settings.timeFormat.12h')}</SelectItem>
                                    <SelectItem value="24h">{t('settings.timeFormat.24h')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Date Format */}
                    <div className="space-y-2">
                        <Label htmlFor="date-format-select" className="text-sm font-medium">
                            {t('settings.dateFormat.label')}
                        </Label>
                        <div className="flex items-center gap-2">
                            <IconCalendar className="h-4 w-4 text-muted-foreground" />
                            <Select value={dateFormat} onValueChange={setDateFormat}>
                                <SelectTrigger id="date-format-select" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (01/25/2024)</SelectItem>
                                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (25/01/2024)</SelectItem>
                                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2024-01-25)</SelectItem>
                                    <SelectItem value="MMM D, YYYY">MMM D, YYYY (Jan 25, 2024)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Timezone Section */}
                <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-dashed transition-all">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-background rounded-full border shadow-sm">
                                <IconWorld className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="space-y-0.5">
                                <Label className="text-sm font-semibold">
                                    {t('settings.autoTimezone.label')}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    {t('settings.autoTimezone.desc')}
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="auto-timezone"
                            checked={autoTimezone}
                            onCheckedChange={setAutoTimezone}
                        />
                    </div>

                    {!autoTimezone && (
                        <div className="space-y-2 px-1">
                            <Label htmlFor="timezone-select" className="text-sm font-medium">
                                {t('settings.timezone.label')}
                            </Label>
                            <Select value={timezone} onValueChange={setTimezone}>
                                <SelectTrigger id="timezone-select" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="UTC">UTC (GMT+0)</SelectItem>
                                    <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                                    <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                                    <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                                    <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                                    <SelectItem value="Europe/London">London (GMT+0/BST)</SelectItem>
                                    <SelectItem value="Europe/Paris">Paris (CET/CEST)</SelectItem>
                                    <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                                    <SelectItem value="Australia/Sydney">Sydney (AEST/AEDT)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
