"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconCaretLeftRightFilled, IconSettings } from "@tabler/icons-react";
import { useUser } from "@/components/user-context";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SettingsModal } from "@/components/modals/settings-modal";

export function DeviceLimitOverlay() {
    const { deviceLimitReached, deviceQuota } = useUser();
    const router = useRouter();

    if (!deviceLimitReached) return null;

    return (
        <div className="fixed inset-0 z-40 bg-background flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-2">
                    <IconCaretLeftRightFilled className="w-6 h-6" />
                    <span className="font-geist-mono select-none text-lg font-medium">ellipticc</span>
                </div>
                <ThemeToggle />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto p-6 text-center">
                <IconAlertTriangle className="w-12 h-12 mb-6 text-foreground" stroke={1.5} />

                <h1 className="text-2xl font-semibold mb-2">Device Limit Reached</h1>

                <p className="text-muted-foreground mb-8">
                    Your <span className="font-medium text-foreground">{deviceQuota?.planName || 'Free'}</span> plan is {deviceQuota?.planName === 'Unlimited' ? 'effectively unlimited' : <>limited to <span className="font-medium text-foreground">{deviceQuota?.maxDevices || 2}</span> devices</>}.
                    Please revoke an unused device to continue using this session.
                </p>

                <div className="flex flex-col gap-3 w-full max-w-sm">
                    <Button
                        onClick={() => {
                            window.location.hash = '#settings/Security?scroll=device-manager';
                        }}
                        size="lg"
                        className="w-full font-medium"
                    >
                        Revoke Existing Device
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => {
                            window.location.href = '/pricing';
                        }}
                        size="lg"
                        className="w-full font-medium"
                    >
                        Upgrade Plan
                    </Button>
                </div>
            </div>

            {/* Bottom-left Settings Trigger */}
            <div className="absolute bottom-6 left-6">
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-muted"
                    onClick={() => {
                        window.location.hash = '#settings/Security?scroll=device-manager';
                    }}
                >
                    <IconSettings className="w-5 h-5 text-muted-foreground" />
                </Button>
            </div>
            <SettingsModal />
        </div>
    );
}
