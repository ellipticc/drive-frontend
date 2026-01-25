"use client";

import { TourProvider } from "@/components/tour";
import { useOnboarding } from "@/components/onboarding/use-onboarding";

// Inner component that uses the tour context
function OnboardingTourContent({ children }: { children: React.ReactNode }) {
    const { handleTourComplete, TourDialog } = useOnboarding();

    return (
        <>
            {children}
            <TourDialog />
        </>
    );
}

// Provider wrapper
export function OnboardingTourProvider({ children }: { children: React.ReactNode }) {
    return (
        <TourProvider>
            <OnboardingTourContent>
                {children}
            </OnboardingTourContent>
        </TourProvider>
    );
}
