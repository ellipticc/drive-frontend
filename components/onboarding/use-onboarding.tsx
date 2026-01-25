"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useUser } from "@/components/user-context";
import { apiClient } from "@/lib/api";
import { WELCOME_PAPER_TITLE, WELCOME_PAPER_MARKDOWN } from "@/lib/welcome-content";
import { usePlateEditor } from "platejs/react";
import { deserializeMd } from "@platejs/markdown";
import { EditorKit } from "../editor-kit";
import { useTour, TourAlertDialog, type TourStep } from "@/components/tour";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";

export function useOnboarding() {
    const { user, refetch } = useUser();
    const welcomePaperCreated = useRef(false);
    const { setSteps, startTour: startTourContext, isTourCompleted, setIsTourCompleted } = useTour();
    const [openTourDialog, setOpenTourDialog] = useState(false);

    // Initialize headless editor for deserialization
    const editor = usePlateEditor({ plugins: EditorKit });

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

            // Dynamically import paperService to avoid circular dependencies
            const { paperService } = await import('@/lib/paper-service');

            // Deserialize markdown content
            const content = deserializeMd(editor, WELCOME_PAPER_MARKDOWN);

            // Create the welcome paper with the deserialized content (blocks)
            const paperId = await paperService.createPaper(WELCOME_PAPER_TITLE, content, null);

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
    }, [editor]);

    // Define tour steps
    const tourSteps: TourStep[] = [
        {
            content: (
                <div>
                    <h3 className="text-lg font-semibold mb-2">Welcome to Ellipticc Drive, {user?.name || 'there'}!</h3>
                    <p className="text-sm text-muted-foreground">
                        Let's take a quick 1-minute tour to show you how your new secure, end-to-end encrypted home for files works.
                    </p>
                </div>
            ),
            selectorId: TOUR_STEP_IDS.NEW_BUTTON,
            position: "left",
        },
        {
            content: (
                <div>
                    <h3 className="text-lg font-semibold mb-2">Upload & Create</h3>
                    <p className="text-sm text-muted-foreground">
                        This is where it all starts. Upload files or folders, or create new ones. Every single byte is encrypted on your device before it ever hits our servers.
                    </p>
                </div>
            ),
            selectorId: TOUR_STEP_IDS.NEW_BUTTON,
            position: "left",
        },
        {
            content: (
                <div>
                    <h3 className="text-lg font-semibold mb-2">Your Private Spaces</h3>
                    <p className="text-sm text-muted-foreground">
                        Spaces are more than just folders. They are dedicated encrypted environments for projects or teams. Create one to stay organized.
                    </p>
                </div>
            ),
            selectorId: TOUR_STEP_IDS.CREATE_SPACE,
            position: "right",
        },
        {
            content: (
                <div>
                    <h3 className="text-lg font-semibold mb-2">Powerful File Actions</h3>
                    <p className="text-sm text-muted-foreground">
                        Once you have files here, use this menu to share, rename, or preview them. Even we can't see what's inside!
                    </p>
                </div>
            ),
            selectorId: TOUR_STEP_IDS.FILE_ACTIONS,
            position: "left",
        },
        {
            content: (
                <div>
                    <h3 className="text-lg font-semibold mb-2">Safety Net (Trash)</h3>
                    <p className="text-sm text-muted-foreground">
                        Accidentally deleted something? No worries. Trashed items are kept here and can be restored, fully encrypted, at any time.
                    </p>
                </div>
            ),
            selectorId: TOUR_STEP_IDS.TRASH,
            position: "right",
        },
        {
            content: (
                <div>
                    <h3 className="text-lg font-semibold mb-2">Security & Privacy Settings</h3>
                    <p className="text-sm text-muted-foreground">
                        Manage your recovery keys, 2FA, and encryption preferences here. Your security is in your hands.
                    </p>
                </div>
            ),
            selectorId: TOUR_STEP_IDS.SETTINGS,
            position: "right",
        },
        {
            content: (
                <div>
                    <h3 className="text-lg font-semibold mb-2">You're All Set!</h3>
                    <p className="text-sm text-muted-foreground">
                        You're ready to start your journey with true digital privacy. If you ever need help, our support team is just a click away.
                    </p>
                </div>
            ),
            selectorId: TOUR_STEP_IDS.SETTINGS,
            position: "bottom",
        },
    ];

    // Handle tour completion - mark onboarding as complete
    const handleTourComplete = useCallback(async () => {
        try {
            console.log('[Onboarding] Completing onboarding...');
            await apiClient.completeOnboarding();
            setIsTourCompleted(true);
            // User data will be automatically refetched by useUser hook
        } catch (error) {
            console.error("Failed to complete onboarding:", error);
        }
    }, [setIsTourCompleted]);

    // Handle skip/cancel - also mark as complete to prevent re-showing
    const handleSkipTour = useCallback(async () => {
        try {
            console.log('[Onboarding] Skipping tour, marking onboarding as complete...');
            await apiClient.completeOnboarding();
            setIsTourCompleted(true);
            setOpenTourDialog(false);
        } catch (error) {
            console.error("Failed to complete onboarding:", error);
        }
    }, [setIsTourCompleted]);

    // Start tour function
    const startTour = useCallback(() => {
        setSteps(tourSteps);
        setOpenTourDialog(true);
    }, [setSteps, tourSteps]);

    // Separate effect for paper creation - runs only once when onboarding starts
    useEffect(() => {
        // Only trigger if user data is loaded and onboarding is NOT completed
        if (user && user.onboarding_completed === false && !welcomePaperCreated.current) {
            // Create welcome paper first (non-blocking)
            createWelcomePaper().catch(err => {
                console.error('[Onboarding] Welcome paper creation failed:', err);
            });

            // Set tour steps and show dialog after a small delay
            const timer = setTimeout(() => {
                setSteps(tourSteps);
                setOpenTourDialog(true);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [user?.id, user?.onboarding_completed, createWelcomePaper, setSteps, tourSteps]);

    return {
        startTour,
        handleTourComplete,
        TourDialog: () => (
            <TourAlertDialog
                isOpen={openTourDialog}
                setIsOpen={(isOpen) => {
                    setOpenTourDialog(isOpen);
                    // If dialog is closed without starting tour, mark onboarding as complete
                    if (!isOpen) {
                        handleSkipTour();
                    }
                }}
            />
        )
    };
}
