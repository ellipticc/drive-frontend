"use client";

import React, { createContext, useContext, ReactNode, useMemo } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";

interface BillingContextType {
    stripePromise: Promise<Stripe | null>;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export function BillingProvider({ children }: { children: ReactNode }) {
    const stripePromise = useMemo(() => {
        const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!key) {
            console.warn("BillingProvider: Stripe publishable key is missing");
            return Promise.resolve(null);
        }
        return loadStripe(key);
    }, []);

    return (
        <BillingContext.Provider value={{ stripePromise }}>
            {children}
        </BillingContext.Provider>
    );
}

export function useBilling() {
    const context = useContext(BillingContext);
    if (context === undefined) {
        throw new Error("useBilling must be used within BillingProvider");
    }
    return context;
}
