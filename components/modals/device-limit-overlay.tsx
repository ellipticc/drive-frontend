"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useUser } from "@/components/user-context";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SettingsModal } from "@/components/modals/settings-modal";
import { useSettingsOpen } from "@/hooks/use-settings-open";

export function DeviceLimitOverlay() {
    const { deviceQuota } = useUser();
    const [settingsOpen] = useSettingsOpen();

    return (
        <div className="min-h-screen bg-background flex flex-col relative">
            {/* Theme Toggle - Top Right */}
            <div className="absolute top-6 right-6">
                <ThemeToggle />
            </div>

            {/* Main Content */}
            <div className={`flex-1 flex flex-col items-center justify-center max-w-md mx-auto p-6 text-center transition-opacity ${
                settingsOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}>
                <IconAlertTriangle className="w-12 h-12 mb-6 text-foreground" stroke={1.5} />

                <h1 className="text-2xl font-semibold mb-2">Device Limit Reached</h1>

                <p className="text-muted-foreground mb-8">
                    Your <span className="font-medium text-foreground">{deviceQuota?.planName || 'Free'}</span> plan is {deviceQuota?.planName === 'Unlimited' ? 'effectively unlimited' : <>limited to <span className="font-medium text-foreground">{deviceQuota?.maxDevices || 2}</span> devices</>}.
                    Please revoke an unused device to continue using this session.
                </p>

                <div className="flex flex-col gap-3 w-full">
                    <Button
                        onClick={() => {
                            window.location.hash = '#settings/Security?scroll=device-manager';
                        }}
                        size="lg"
                        className="w-full"
                    >
                        Manage Devices
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => {
                            window.location.href = '/pricing';
                        }}
                        size="lg"
                        className="w-full"
                    >
                        Upgrade Plan
                    </Button>
                </div>
            </div>

            <SettingsModal />
        </div>
    );
}
