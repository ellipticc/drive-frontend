import React from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { IconCreditCard, IconCurrencyBitcoin, IconBrandPaypal } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

interface PaymentMethodModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onSelectMethod: (method: 'stripe' | 'crypto' | 'paypal') => void
    isLoading?: boolean
    planFrequency?: string
}

export function PaymentMethodModal({
    isOpen,
    onOpenChange,
    onSelectMethod,
    isLoading,
}: PaymentMethodModalProps) {

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="text-center pb-2">Select Payment Method</DialogTitle>
                </DialogHeader>

                <div className="space-y-3 py-2">

                    <Button
                        variant="outline"
                        onClick={() => onSelectMethod('stripe')}
                        disabled={isLoading}
                        className="w-full justify-start h-14 px-4 border-muted hover:bg-accent hover:text-accent-foreground"
                    >
                        <IconCreditCard className="mr-3 h-5 w-5 text-muted-foreground" />
                        <div className="flex flex-col items-start gap-0.5">
                            <span className="font-medium text-base">Credit Card</span>
                            <span className="text-xs text-muted-foreground font-normal">Secure checkout with Stripe</span>
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => onSelectMethod('paypal')}
                        disabled={true}
                        className="w-full justify-start h-14 px-4 border-muted hover:bg-accent hover:text-accent-foreground opacity-60 cursor-not-allowed"
                    >
                        <IconBrandPaypal className="mr-3 h-5 w-5 text-muted-foreground" />
                        <div className="flex flex-col items-start gap-0.5">
                            <span className="font-medium text-base">PayPal</span>
                            <span className="text-xs text-muted-foreground font-normal">Coming soon</span>
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => onSelectMethod('crypto')}
                        disabled={isLoading}
                        className="w-full justify-start h-14 px-4 border-muted hover:bg-accent hover:text-accent-foreground"
                    >
                        <IconCurrencyBitcoin className="mr-3 h-5 w-5 text-muted-foreground" />
                        <div className="flex flex-col items-start gap-0.5">
                            <span className="font-medium text-base">Cryptocurrency</span>
                            <span className="text-xs text-muted-foreground font-normal">Bitcoin, ETH, USDT & more</span>
                        </div>
                    </Button>

                </div>
            </DialogContent>
        </Dialog>
    )
}
