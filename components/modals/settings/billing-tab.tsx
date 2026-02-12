import { useFormatter } from "@/hooks/use-formatter";
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
import { CancelSubscriptionDialog } from "@/components/billingsdk/cancel-subscription-dialog"
import {
    IconLoader2,
    IconInfoCircle,
    IconRefresh,
    IconDownload,
    IconChevronLeft,
    IconChevronRight,
} from "@tabler/icons-react"
import { UpcomingCharges } from "@/components/billingsdk/upcoming-charges"
import { DetailedUsageTable } from "@/components/billingsdk/detailed-usage-table"
import { SubscriptionHistory as SubscriptionHistoryTable } from "@/components/billingsdk/subscription-history"
import { InvoiceHistory } from "@/components/billingsdk/invoice-history"
import { Subscription, BillingUsage, SubscriptionHistory, PricingPlan, apiClient } from "@/lib/api"
import { useEffect, useState } from "react"

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
    pricingPlans?: PricingPlan[];
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
    invoicesTotalPages,
    pricingPlans
}: BillingTabProps) {
    const { formatDate } = useFormatter();

    // Usage state
    const [usageData, setUsageData] = useState<any>(null);
    const [isLoadingUsage, setIsLoadingUsage] = useState(true);

    const fetchUsage = async () => {
        setIsLoadingUsage(true);
        try {
            const res = await apiClient.getUserUsage();
            if (res.success && res.data?.usage) setUsageData(res.data.usage);
        } catch (err) {
            console.error('Failed to fetch usage data:', err);
        } finally {
            setIsLoadingUsage(false);
        }
    };

    useEffect(() => {
        fetchUsage();
    }, []);

    // Prepare resources for detailed usage table
    const resources = [] as any[];
    if (usageData) {
        resources.push({
            name: 'Storage',
            used: usageData.storage.used,
            limit: usageData.storage.limit,
            percentage: usageData.storage.limit > 0 ? (usageData.storage.used / usageData.storage.limit) * 100 : 0,
            unit: usageData.storage.unit || 'GB'
        });

        resources.push({
            name: 'Webhook Events (30d)',
            used: usageData.webhookEvents.used,
            limit: usageData.webhookEvents.limit,
        });

        resources.push({
            name: 'Devices',
            used: usageData.devices.used,
            limit: usageData.devices.limit,
        });
    }

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
                                                    ? `${subscription.status === 'trialing' ? 'Trial ends' : 'Expiring'} ${formatDate(subscription.currentPeriodEnd * 1000)}`
                                                    : 'Scheduled for termination'
                                                }
                                            </span>
                                        </div>
                                    )}
                                    {!subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">Next billing:</span>
                                            <span className="text-sm font-medium font-mono">
                                                {formatDate(subscription.currentPeriodEnd * 1000)}
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
                                        <span className="text-sm font-medium">2GB included</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Upcoming Charges */}
                        {subscription && subscription.status === 'active' && !subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
                            (() => {
                                // Prefer subscriptionHistory entry for active subscription amount
                                const activeSubscription = subscriptionHistory?.history?.find(h => h.status === 'active');

                                let amountStr = 'TBD';

                                const formatPrice = (price: number | undefined, currency?: string) => {
                                    if (price === undefined || price === null) return 'TBD';
                                    let dollars = price;
                                    // If price looks like cents (integer large number), divide by 100
                                    if (Number.isInteger(price) && price > 1000) dollars = price / 100;
                                    return `${(currency || 'USD').toUpperCase()} $${dollars.toFixed(2)}`;
                                };

                                if (activeSubscription) {
                                    // activeSubscription.amount is expressed in dollars from backend
                                    amountStr = formatPrice(activeSubscription.amount, activeSubscription.currency);
                                } else if (pricingPlans && subscription?.plan) {
                                    // Try to find matching pricing plan passed from parent
                                    const planById = pricingPlans.find(p => p.id === (subscription.plan as any).id);
                                    const planByName = pricingPlans.find(p => p.name === subscription.plan?.name);
                                    const plan = planById || planByName;
                                    if (plan) {
                                        amountStr = formatPrice(plan.price, plan.currency);
                                    }
                                }

                                const description = activeSubscription?.planName || subscription.plan?.name || 'Subscription';

                                return (
                                    <UpcomingCharges
                                        className="w-full"
                                        nextBillingDate={formatDate(subscription.currentPeriodEnd * 1000)}
                                        totalAmount={amountStr}
                                        charges={[
                                            {
                                                id: activeSubscription?.id || 'subscription',
                                                description,
                                                amount: amountStr,
                                                date: formatDate(subscription.currentPeriodEnd * 1000),
                                                type: 'recurring' as const,
                                            },
                                        ]}
                                    />
                                );
                            })()
                        )}

                        {/* Detailed Usage Table (replaces old storage block) */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-medium text-muted-foreground">Usage Overview</h3>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fetchUsage()}
                                    disabled={isLoadingUsage}
                                >
                                    {isLoadingUsage ? (
                                        <>
                                            <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                                            Refreshing...
                                        </>
                                    ) : (
                                        <>
                                            <IconRefresh className="h-4 w-4 mr-2" />
                                            Refresh
                                        </>
                                    )}
                                </Button>
                            </div>

                            {isLoadingUsage ? (
                                <div className="flex justify-center py-6">
                                    <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <DetailedUsageTable
                                    title="Usage Details"
                                    description="Storage, spaces, webhook events and devices"
                                    resources={resources}
                                />
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            {subscription && !subscription.cancelAtPeriodEnd ? (
                                (() => {
                                    // Get actual price from subscription history or pricing plans
                                    const activeSubscription = subscriptionHistory?.history?.find(h => h.status === 'active');
                                    let monthlyPrice = '0';
                                    let yearlyPrice = '0';

                                    if (activeSubscription?.amount) {
                                        monthlyPrice = activeSubscription.amount.toFixed(2);
                                    } else if (pricingPlans && subscription?.plan) {
                                        const matchingPlan = pricingPlans.find(p =>
                                            p.id === (subscription.plan as any).id || p.name === subscription.plan?.name
                                        );
                                        if (matchingPlan?.price) {
                                            const price = Number.isInteger(matchingPlan.price) && matchingPlan.price > 1000
                                                ? matchingPlan.price / 100
                                                : matchingPlan.price;
                                            monthlyPrice = price.toFixed(2);
                                            yearlyPrice = price.toFixed(2);
                                        }
                                    }

                                    return (
                                        <CancelSubscriptionDialog
                                            title="We're sorry to see you go..."
                                            description={`Before you cancel, we hope you'll consider keeping your ${subscription.plan?.name || 'subscription'} active.`}
                                            plan={{
                                                id: subscription.id || 'subscription',
                                                title: subscription.plan?.name || 'Your Plan',
                                                description: 'Current subscription',
                                                monthlyPrice,
                                                yearlyPrice,
                                                buttonText: 'Cancel',
                                                features: [],
                                            }}
                                            triggerButtonText="Cancel Subscription"
                                            triggerVariant="destructive"
                                            leftPanelImageUrl="https://framerusercontent.com/images/GWE8vop9hubsuh3uWWn0vyuxEg.webp"
                                            warningTitle="You will lose access to premium features"
                                            warningText="If you cancel your subscription, you will lose access to premium features and increased storage limits."
                                            keepButtonText={`Keep My ${subscription.plan?.name || 'Subscription'}`}
                                            continueButtonText="Continue with Cancellation"
                                            finalTitle="Final Step - Confirm Cancellation"
                                            finalSubtitle="This action will cancel your subscription at the end of your billing period"
                                            finalWarningText="• You will retain access until the end of your billing period\n• No future charges will be made\n• You can reactivate at any time before it expires"
                                            goBackButtonText="Wait, Go Back"
                                            confirmButtonText="Yes, Cancel My Subscription"
                                            onCancel={handleCancelSubscription}
                                            onKeepSubscription={async () => {
                                                setShowCancelDialog(false);
                                            }}
                                            onDialogClose={() => {
                                                setShowCancelDialog(false);
                                            }}
                                            className="flex-1"
                                        />
                                    );
                                })()
                            ) : subscription?.cancelAtPeriodEnd ? (
                                <div className="flex-1 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center font-medium">
                                        Your {subscription.status === 'trialing' ? 'trial' : 'subscription'} will expire on {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd * 1000) : 'the end of the period'}
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
                                onClick={() => window.location.href = '/pricing'}
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
                                    <li>• You cannot cancel your subscription if you&apos;re using more than 2GB of storage</li>
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
                                {/* Subscription History (using shared component) */}
                                {subscriptionHistory?.history && subscriptionHistory.history.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-medium text-muted-foreground">Subscriptions</h4>
                                            {subsTotalPages > 1 && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {subsPage} / {subsTotalPages}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <SubscriptionHistoryTable
                                            subscriptions={subscriptionHistory.history.map((sub) => ({
                                                id: sub.id,
                                                plan: sub.planName,
                                                status: sub.status as any,
                                                amount: `$${sub.amount.toFixed(2)}`,
                                                interval: sub.interval,
                                                created: formatDate(sub.created * 1000),
                                                cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
                                            }))}
                                            currentPage={subsPage}
                                            totalPages={subsTotalPages}
                                            onPageChange={(page) => loadSubscriptionHistory(page, invoicesPage)}
                                        />
                                    </div>
                                )}

                                {/* Invoices (using shared component) */}
                                {subscriptionHistory?.invoices && subscriptionHistory.invoices.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-medium text-muted-foreground">Invoices</h4>
                                            {invoicesTotalPages > 1 && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {invoicesPage} / {invoicesTotalPages}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <InvoiceHistory
                                            invoices={subscriptionHistory.invoices.map((inv) => ({
                                                id: inv.id,
                                                date: formatDate(inv.created * 1000),
                                                amount: `${inv.currency?.toUpperCase() || 'USD'} $${inv.amount.toFixed(2)}`,
                                                status: inv.status as any,
                                                invoiceUrl: inv.invoicePdf,
                                                description: inv.number || inv.subscriptionId || 'Invoice',
                                            }))}
                                            currentPage={invoicesPage}
                                            totalPages={invoicesTotalPages}
                                            onPageChange={(page) => loadSubscriptionHistory(subsPage, page)}
                                            onDownload={(id) => {
                                                const inv = subscriptionHistory.invoices.find(i => i.id === id)
                                                if (inv?.invoicePdf) window.open(inv.invoicePdf, '_blank')
                                            }}
                                        />
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
