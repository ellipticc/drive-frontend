"use client";

import { TourProvider } from "@/components/tour";
import { useOnboarding } from "@/components/onboarding/use-onboarding";

export function OnboardingTourProvider({ children }: { children: React.ReactNode }) {
    const { handleTourComplete, TourDialog } = useOnboarding();

    return (
        <TourProvider onComplete={handleTourComplete}>
            {children}
            <TourDialog />
        </TourProvider>
    );
}
