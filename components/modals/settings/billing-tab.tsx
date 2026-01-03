import React from 'react'
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    IconLoader2,
    IconInfoCircle,
    IconRefresh,
    IconWallet,
    IconDownload,
    IconChevronLeft,
    IconChevronRight,
} from "@tabler/icons-react"
import { Subscription, BillingUsage, SubscriptionHistory } from "@/lib/api"

// Helper to format bytes
const formatStorageSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

interface BillingTabProps {
    isLoadingBilling: boolean;
    subscription: Subscription | null;
    billingUsage: BillingUsage | null;
    showCancelDialog: boolean;
    setShowCancelDialog: (val: boolean) => void;
    isCancellingSubscription: boolean;
    handleCancelSubscription: () => Promise<void>;
    handleManageSubscription: () => Promise<void>;
    isRedirectingToPortal: boolean;
    loadSubscriptionHistory: (subsPage?: number, invoicesPage?: number) => Promise<void>;
    isLoadingHistory: boolean;
    subscriptionHistory: SubscriptionHistory | null;
    subsPage: number;
    invoicesPage: number;
    subsTotalPages: number;
    invoicesTotalPages: number;
}

export function BillingTab({
    isLoadingBilling,
    subscription,
    billingUsage,
    showCancelDialog,
    setShowCancelDialog,
    isCancellingSubscription,
    handleCancelSubscription,
    handleManageSubscription,
    isRedirectingToPortal,
    loadSubscriptionHistory,
    isLoadingHistory,
    subscriptionHistory,
    subsPage,
    invoicesPage,
    subsTotalPages,
    invoicesTotalPages
}: BillingTabProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold">Billing & Subscription</h2>

            {/* Current Plan Section */}
            {isLoadingBilling ? (
                <div className="flex justify-center py-6">
                    <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <>
                    <div className="space-y-4">
                        <div className="p-4 border rounded-lg">
                            <h3 className="font-medium mb-3">Current Plan</h3>
                            {subscription ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Plan:</span>
                                        <span className="font-medium">{subscription.plan?.name || 'Unknown Plan'}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Status:</span>
                                        <span className={`text-sm font-medium px-2 py-1 rounded-full ${subscription.status === 'active'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                            : subscription.status === 'trialing'
                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                                : subscription.status === 'past_due'
                                                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                            }`}>
                                            {subscription.status === 'active' ? 'Active' :
                                                subscription.status === 'trialing' ? 'Trial' :
                                                    subscription.status === 'past_due' ? 'Past Due' :
                                                        subscription.status || 'Unknown'}
                                        </span>
                                    </div>
                                    {subscription.cancelAtPeriodEnd && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">Cancellation:</span>
                                            <span className="text-sm text-red-600 font-medium">
                                                {subscription.currentPeriodEnd
                                                    ? `Cancels ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                                                    : 'Scheduled for cancellation'
                                                }
                                            </span>
                                        </div>
                                    )}
                                    {!subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">Next billing:</span>
                                            <span className="text-sm font-medium">
                                                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}
                                    {subscription.plan?.interval && subscription.plan.interval !== 0 && subscription.plan.interval !== '0' && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">Billing cycle:</span>
                                            <span className="text-sm font-medium capitalize">
                                                {subscription.plan.interval}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Plan:</span>
                                        <span className="font-medium">Free Plan</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Status:</span>
                                        <span className={`text-sm font-medium px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`}>
                                            Active
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Storage:</span>
                                        <span className="text-sm font-medium">5GB included</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Storage Usage */}
                        {billingUsage && (
                            <div className="p-4 border rounded-lg">
                                <h3 className="font-medium mb-2">Storage Usage</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Used:</span>
                                        <span className="font-medium">{formatStorageSize(billingUsage.usedBytes)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Limit:</span>
                                        <span className="font-medium">{formatStorageSize(billingUsage.quotaBytes)}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${billingUsage.percentUsed > 90
                                                ? 'bg-red-500'
                                                : billingUsage.percentUsed > 75
                                                    ? 'bg-yellow-500'
                                                    : 'bg-green-500'
                                                }`}
                                            style={{ width: `${Math.min(billingUsage.percentUsed, 100)}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-muted-foreground text-center">
                                        {billingUsage.percentUsed.toFixed(1)}% used
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            {subscription && !subscription.cancelAtPeriodEnd ? (
                                <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="destructive"
                                            disabled={isCancellingSubscription}
                                            className="flex-1"
                                        >
                                            Cancel Subscription
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to cancel your subscription?
                                                <br /><br />
                                                • You will retain access to your current plan until the end of your billing period
                                                <br />
                                                • No future charges will be made
                                                <br />
                                                • You can reactivate your subscription at any time before it expires
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleCancelSubscription}
                                                disabled={isCancellingSubscription}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                {isCancellingSubscription ? (
                                                    <>
                                                        <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                                                        Cancelling...
                                                    </>
                                                ) : (
                                                    'Cancel Subscription'
                                                )}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            ) : subscription?.cancelAtPeriodEnd ? (
                                <div className="flex-1 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center">
                                        Subscription will be cancelled on {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString() : 'the end of billing period'}
                                    </p>
                                </div>
                            ) : null}

                            <Button
                                variant="outline"
                                onClick={handleManageSubscription}
                                disabled={isRedirectingToPortal}
                                className="flex-1"
                            >
                                {isRedirectingToPortal ? (
                                    <>
                                        <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                                        Redirecting...
                                    </>
                                ) : (
                                    'Customer Portal'
                                )}
                            </Button>
                            <Button
                                onClick={() => window.location.href = '/billing'}
                                className="flex-1"
                            >
                                {subscription ? 'Change Plan' : 'Upgrade Plan'}
                            </Button>
                        </div>

                        {/* Important Information */}
                        {subscription && !subscription.cancelAtPeriodEnd && (
                            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                                    <IconInfoCircle className="w-4 h-4" />
                                    Important Information
                                </h4>
                                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                                    <li>• You cannot cancel your subscription if you&apos;re using more than 5GB of storage</li>
                                    <li>• When cancelled, you&apos;ll keep access until the end of your billing period</li>
                                    <li>• No future charges will be made after cancellation</li>
                                    <li>• You can reactivate your subscription at any time before it expires</li>
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Subscription History */}
                    <div className="border-t pt-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Billing History</h3>
                            {subscriptionHistory && (subscriptionHistory.history?.length > 0 || subscriptionHistory.invoices?.length > 0) && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadSubscriptionHistory()}
                                    disabled={isLoadingHistory}
                                >
                                    {isLoadingHistory ? (
                                        <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <IconRefresh className="h-4 w-4 mr-2" />
                                    )}
                                    Refresh
                                </Button>
                            )}
                        </div>

                        {isLoadingHistory ? (
                            <div className="flex justify-center py-6">
                                <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : subscriptionHistory ? (
                            <>
                                {/* Subscription History Table */}
                                {subscriptionHistory.history && subscriptionHistory.history.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-medium text-muted-foreground">Subscriptions</h4>
                                            {subsTotalPages > 1 && (
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 w-7 p-0"
                                                        onClick={() => loadSubscriptionHistory(subsPage - 1, invoicesPage)}
                                                        disabled={subsPage === 1}
                                                    >
                                                        <IconChevronLeft className="h-4 w-4" />
                                                    </Button>
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {subsPage} / {subsTotalPages}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 w-7 p-0"
                                                        onClick={() => loadSubscriptionHistory(subsPage + 1, invoicesPage)}
                                                        disabled={subsPage >= subsTotalPages}
                                                    >
                                                        <IconChevronRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="border rounded-lg overflow-hidden bg-card max-h-80">
                                            <div className="overflow-x-auto overflow-y-auto h-full">
                                                <table className="w-full text-sm font-mono">
                                                    <thead className="bg-muted/50 border-b">
                                                        <tr>
                                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Plan</th>
                                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Status</th>
                                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Amount</th>
                                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Billing Period</th>
                                                            <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Date</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {subscriptionHistory.history.map((sub: SubscriptionHistory['history'][0]) => (
                                                            <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                                                                <td className="px-4 py-3 min-w-[160px]">
                                                                    <div>
                                                                        <p className="font-medium">{sub.planName}</p>
                                                                        <p className="text-xs text-muted-foreground capitalize">{sub.interval}ly</p>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-left min-w-[120px]">
                                                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${sub.status === 'active'
                                                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                                        : sub.status === 'canceled'
                                                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                                            : sub.status === 'past_due'
                                                                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                                                                : 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400'
                                                                        }`}>
                                                                        {sub.status === 'active' ? 'Active' :
                                                                            sub.status === 'canceled' ? 'Cancelled' :
                                                                                sub.status === 'past_due' ? 'Past Due' :
                                                                                    sub.status}
                                                                        {sub.cancelAtPeriodEnd && ' (Cancelling)'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-left min-w-[120px]">
                                                                    <p className="font-medium">${sub.amount.toFixed(2)}</p>
                                                                    <p className="text-xs text-muted-foreground">{sub.currency.toUpperCase()}</p>
                                                                </td>
                                                                <td className="px-4 py-3 text-left min-w-[120px]">
                                                                    <p className="text-xs capitalize">{sub.interval}ly</p>
                                                                </td>
                                                                <td className="px-4 py-3 text-right min-w-[120px]">
                                                                    <p className="text-xs">{new Date(sub.created * 1000).toLocaleDateString()}</p>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Invoices Table */}
                                {subscriptionHistory.invoices && subscriptionHistory.invoices.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-medium text-muted-foreground">Invoices</h4>
                                            {invoicesTotalPages > 1 && (
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 w-7 p-0"
                                                        onClick={() => loadSubscriptionHistory(subsPage, invoicesPage - 1)}
                                                        disabled={invoicesPage === 1}
                                                    >
                                                        <IconChevronLeft className="h-4 w-4" />
                                                    </Button>
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {invoicesPage} / {invoicesTotalPages}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 w-7 p-0"
                                                        onClick={() => loadSubscriptionHistory(subsPage, invoicesPage + 1)}
                                                        disabled={invoicesPage >= invoicesTotalPages}
                                                    >
                                                        <IconChevronRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="border rounded-lg overflow-hidden bg-card max-h-80">
                                            <div className="overflow-x-auto overflow-y-auto h-full">
                                                <table className="w-full text-sm font-mono">
                                                    <thead className="bg-muted/50 border-b">
                                                        <tr>
                                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Invoice #</th>
                                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Status</th>
                                                            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Amount</th>
                                                            <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Date</th>
                                                            <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {subscriptionHistory.invoices.map((invoice: SubscriptionHistory['invoices'][0]) => (
                                                            <tr key={invoice.id} className="hover:bg-muted/30 transition-colors">
                                                                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{invoice.id}</td>
                                                                <td className="px-4 py-3 text-left">
                                                                    <span className={`text-xs font-bold uppercase py-1 px-2 rounded ${invoice.status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' :
                                                                        'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400'
                                                                        }`}>
                                                                        {invoice.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-left text-sm">${invoice.amount.toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                                                                    {new Date(invoice.created * 1000).toLocaleDateString()}
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => window.open(invoice.invoicePdf, '_blank')}>
                                                                        <IconDownload className="h-4 w-4 text-muted-foreground" />
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Empty State */}
                                {(!subscriptionHistory.history || subscriptionHistory.history.length === 0) &&
                                    (!subscriptionHistory.invoices || subscriptionHistory.invoices.length === 0) && (
                                        <div className="text-center py-12">
                                            <h3 className="text-sm font-medium text-foreground mb-1">No billing history yet</h3>
                                            <p className="text-sm text-muted-foreground">Your invoices and subscription details will appear here</p>
                                        </div>
                                    )}
                            </>
                        ) : (
                            <div className="text-center py-12">
                                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                                    <IconLoader2 className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <h3 className="text-sm font-medium text-foreground mb-1">Unable to load billing history</h3>
                                <p className="text-sm text-muted-foreground mb-4">Please try again or contact support if the issue persists</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadSubscriptionHistory()}
                                >
                                    Try Again
                                </Button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
