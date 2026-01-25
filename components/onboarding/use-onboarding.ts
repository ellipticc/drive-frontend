"use client";

import { useEffect, useCallback, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useUser } from "@/components/user-context";
import { apiClient } from "@/lib/api";
import { WELCOME_PAPER_TITLE, WELCOME_PAPER_MARKDOWN } from "@/lib/welcome-content";
import { uuidv7 } from "uuidv7-js";

export function useOnboarding() {
    const { user, refetch } = useUser();
    const welcomePaperCreated = useRef(false);

    // Create welcome paper with markdown content
    const createWelcomePaper = useCallback(async () => {
        // Prevent duplicate creation
        if (welcomePaperCreated.current) return;
        welcomePaperCreated.current = true;

        try {
            console.log('[Onboarding] Creating welcome paper...');
            
            // Check if welcome paper already exists
            const existingFiles = await apiClient.getFiles({ limit: 100 });
            const hasWelcomePaper = existingFiles.data?.files?.some(
                (f: any) => f.filename === WELCOME_PAPER_TITLE && f.mimetype === 'application/x-paper'
            );
            
            if (hasWelcomePaper) {
                console.log('[Onboarding] Welcome paper already exists, skipping creation');
                return;
            }

            // Create simple block with markdown content
            // The editor will parse it when the paper is opened
            const initialContent = [{
                id: uuidv7(),
                type: 'p',
                children: [{ text: WELCOME_PAPER_MARKDOWN }]
            }];
            
            // Dynamically import paperService to avoid circular dependencies
            const { paperService } = await import('@/lib/paper-service');
            
            // Create the welcome paper
            const paperId = await paperService.createPaper(WELCOME_PAPER_TITLE, initialContent, null);
            
            console.log('[Onboarding] Welcome paper created successfully:', paperId);
            
            // Dispatch event to refresh files list instantly (no page refresh needed)
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('file-created', { 
                    detail: { fileId: paperId, type: 'paper' } 
                }));
            }
        } catch (error) {
            console.error('[Onboarding] Failed to create welcome paper:', error);
            // Don't throw - onboarding tour should still work even if paper creation fails
        }
    }, []);

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
                    // User data will be automatically refetched by useUser hook
                    // No need to manually call refetch() here to avoid duplicate API calls
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
            // Create welcome paper first (non-blocking)
            createWelcomePaper().catch(err => {
                console.error('[Onboarding] Welcome paper creation failed:', err);
            });

            // Start tour after a small delay to ensure everything is rendered
            const timer = setTimeout(() => {
                startTour();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [user, startTour, createWelcomePaper]);

    return { startTour };
}
