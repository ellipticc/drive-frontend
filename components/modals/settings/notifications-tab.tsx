import React from 'react'
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { IconBell, IconMail, IconUserCog, IconGift, IconShield, IconLogin, IconCreditCard } from '@tabler/icons-react'

interface NotificationsTabProps {
    inAppNotifications: boolean;
    emailNotifications: boolean;
    loginNotifications: boolean;
    fileShareNotifications: boolean;
    billingNotifications: boolean;
    setInAppNotifications: (val: boolean) => void;
    setEmailNotifications: (val: boolean) => void;
    setLoginNotifications: (val: boolean) => void;
    setFileShareNotifications: (val: boolean) => void;
    setBillingNotifications: (val: boolean) => void;
    saveNotificationPreferences: (prefs: Record<string, boolean>) => Promise<void>;
    isLoadingNotificationPrefs: boolean;
}

export function NotificationsTab({
    inAppNotifications,
    emailNotifications,
    loginNotifications,
    fileShareNotifications,
    billingNotifications,
    setInAppNotifications,
    setEmailNotifications,
    setLoginNotifications,
    setFileShareNotifications,
    setBillingNotifications,
    saveNotificationPreferences,
    isLoadingNotificationPrefs,
}: NotificationsTabProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold">Notifications</h2>

            {/* Notification Preferences */}
            <div className="space-y-6">
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">General Preferences</h3>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <IconBell className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">In-App Notifications</p>
                                <p className="text-sm text-muted-foreground">Receive notifications within the application</p>
                            </div>
                        </div>
                        <Switch
                            checked={inAppNotifications}
                            onCheckedChange={(checked) => {
                                setInAppNotifications(checked)
                                saveNotificationPreferences({ inApp: checked })
                            }}
                            disabled={isLoadingNotificationPrefs}
                        />
                    </div>

                    <div className="flex items-center justify-between border-t pt-4">
                        <div className="flex items-center gap-3">
                            <IconMail className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Email Notifications</p>
                                <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                            </div>
                        </div>
                        <Switch
                            checked={emailNotifications}
                            onCheckedChange={(checked) => {
                                setEmailNotifications(checked)
                                saveNotificationPreferences({ email: checked })
                            }}
                            disabled={isLoadingNotificationPrefs}
                        />
                    </div>
                </div>

                <div className="border-t pt-6 space-y-4">
                    <h3 className="text-lg font-semibold">Notification Types</h3>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <IconShield className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Login Notifications</p>
                                <p className="text-sm text-muted-foreground">Get notified when someone logs into your account</p>
                            </div>
                        </div>
                        <Switch
                            checked={loginNotifications}
                            onCheckedChange={(checked) => {
                                setLoginNotifications(checked)
                                saveNotificationPreferences({ login: checked })
                            }}
                            disabled={isLoadingNotificationPrefs}
                        />
                    </div>

                    <div className="flex items-center justify-between border-t pt-4">
                        <div className="flex items-center gap-3">
                            <IconUserCog className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">File Sharing Notifications</p>
                                <p className="text-sm text-muted-foreground">Get notified when files are shared with you</p>
                            </div>
                        </div>
                        <Switch
                            checked={fileShareNotifications}
                            onCheckedChange={(checked) => {
                                setFileShareNotifications(checked)
                                saveNotificationPreferences({ fileShare: checked })
                            }}
                            disabled={isLoadingNotificationPrefs}
                        />
                    </div>

                    <div className="flex items-center justify-between border-t pt-4">
                        <div className="flex items-center gap-3">
                            <IconGift className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Billing Notifications</p>
                                <p className="text-sm text-muted-foreground">Get notified about billing and payment updates</p>
                            </div>
                        </div>
                        <Switch
                            checked={billingNotifications}
                            onCheckedChange={(checked) => {
                                setBillingNotifications(checked)
                                saveNotificationPreferences({ billing: checked })
                            }}
                            disabled={isLoadingNotificationPrefs}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
