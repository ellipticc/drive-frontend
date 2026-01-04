"use client";

import { useEffect, useCallback } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useUser } from "@/components/user-context";
import { apiClient } from "@/lib/api";

export function useOnboarding() {
    const { user, refetch } = useUser();

    const startTour = useCallback(() => {
        const driverObj = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            steps: [
                {
                    popover: {
                        title: `Welcome to Ellipticc Drive, ${user?.name || 'there'}!`,
                        description: "Let's take a quick 1-minute tour to show you how your new secure, end-to-end encrypted home for files works.",
                        side: "bottom",
                        align: "center",
                    },
                },
                {
                    element: "#tour-new-button",
                    popover: {
                        title: "Upload & Create",
                        description: "This is where it all starts. Upload files or folders, or create new ones. Every single byte is encrypted on your device before it ever hits our servers.",
                        side: "left",
                        align: "start",
                    },
                },
                {
                    element: "#tour-create-space",
                    popover: {
                        title: "Your Private Spaces",
                        description: "Spaces are more than just folders. They are dedicated encrypted environments for projects or teams. Create one to stay organized.",
                        side: "right",
                        align: "start",
                    },
                },
                {
                    element: "#tour-file-actions",
                    popover: {
                        title: "Powerful File Actions",
                        description: "Once you have files here, use this menu to share, rename, or preview them. Even we can't see what's inside!",
                        side: "left",
                        align: "start",
                    },
                },
                {
                    element: "#tour-trash",
                    popover: {
                        title: "Safety Net (Trash)",
                        description: "Accidentally deleted something? No worries. Trashed items are kept here and can be restored, fully encrypted, at any time.",
                        side: "right",
                        align: "start",
                    },
                },
                {
                    element: "#tour-settings",
                    popover: {
                        title: "Security & Privacy Settings",
                        description: "Manage your recovery keys, 2FA, and encryption preferences here. Your security is in your hands.",
                        side: "right",
                        align: "start",
                    },
                },
                {
                    popover: {
                        title: "You're All Set!",
                        description: "You're ready to start your journey with true digital privacy. If you ever need help, our support team is just a click away.",
                        side: "bottom",
                        align: "center",
                    },
                },
            ],
            onDestroyed: async () => {
                // Only mark as completed if they actually reached the end or intentionally closed it
                // We'll mark it regardless once destroyed to not annoy them next time
                try {
                    await apiClient.completeOnboarding();
                    refetch();
                } catch (error) {
                    console.error("Failed to complete onboarding:", error);
                }
            },
        });

        driverObj.drive();
    }, [user, refetch]);

    useEffect(() => {
        // Only trigger if user data is loaded and onboarding is NOT completed
        if (user && user.onboarding_completed === false) {
            // Small timeout to ensure everything is rendered
            const timer = setTimeout(() => {
                startTour();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [user, startTour]);

    return { startTour };
}
