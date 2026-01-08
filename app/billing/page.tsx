'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  IconLoader2 as Loader2,
  IconCheck as Check,
  IconExternalLink as ExternalLink,
  IconHistory as History,
  IconX as X,
  IconInfoCircle as InfoCircle,
  IconRosetteDiscountCheckFilled
} from "@tabler/icons-react";
import NumberFlow from '@number-flow/react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiClient, Subscription, BillingUsage, SubscriptionHistory } from '@/lib/api';
import { useUser } from '@/components/user-context';
import { cn, formatFileSize } from '@/lib/utils';
import React from 'react';

import {
  SectionGroup,
  Section,
  SectionHeader,
  SectionTitle,
  SectionDescription
} from '@/components/content/section';
import {
  FormCard,
  FormCardHeader,
  FormCardTitle,
  FormCardDescription,
  FormCardContent,
  FormCardFooter
} from '@/components/forms/form-card';
import { BillingProgress } from '@/components/content/billing-progress';
import { PaymentMethodModal } from '@/components/modals/payment-method-modal';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

interface TransformedPlan {
  id: string;
  name: string;
  rank: number;
  price: {
    monthly: number;
    yearly: number;
    yearlyEquivalent: number;
  };
  description: string;
  storage: string;
  quotaBytes: number;
  features: Record<string, boolean | string>;
  cta: string;
  popular?: boolean;
  stripePriceIds: {
    monthly: string;
    yearly: string;
  };
}

const staticPlans: TransformedPlan[] = [
  {
    id: 'free',
    name: 'Free',
    rank: 0,
    price: {
      monthly: 0,
      yearly: 0,
      yearlyEquivalent: 0,
    },
    description: 'Essential for personal use',
    storage: '5 GB',
    quotaBytes: 5 * 1024 * 1024 * 1024,
    features: {
      'Storage Quota': '5 GB',
      'Spaces': '2',
      'Devices Limit': '2',
      'Trash Retention': '30 days',
      'Zero Knowledge Architecture': true,
      'Post-Quantum Cryptography': true,
      'End-to-End Encryption': true,
      'File Vault': false,
      'Verified Source': false,
      'Suspicious Activity Alerts': false,
      'Sentry: Advanced Analysis': false,
      'Export security events': false,
      'Shared links': true,
      'Advanced link settings': false,
      'Disable downloads': false,
      'Custom expiration dates': false,
      'Password-protected links': false,
      'Comments on shares': true,
      'Comment attachments': false,
      'Share page customization': false,
      'Real-time Collaboration': false,
      'File Versioning': 'No',
      'Theme Customization': false,
      'Advanced Integrations': false,
      'Security Events': '7 days',
      'Support': 'Community',
    },
    cta: 'Current Plan',
    stripePriceIds: {
      monthly: '',
      yearly: '',
    },
  },
  {
    id: 'plus',
    name: 'Plus',
    rank: 1,
    price: {
      monthly: 8.99,
      yearly: 83.89,
      yearlyEquivalent: 6.99,
    },
    description: 'Perfect for getting started',
    storage: '500 GB',
    quotaBytes: 500 * 1024 * 1024 * 1024,
    features: {
      'Storage Quota': '500 GB',
      'Spaces': '5',
      'Devices Limit': '5',
      'Trash Retention': '60 days',
      'Zero Knowledge Architecture': true,
      'Post-Quantum Cryptography': true,
      'End-to-End Encryption': true,
      'File Vault': false,
      'Verified Source': true,
      'Suspicious Activity Alerts': false,
      'Sentry: Advanced Analysis': false,
      'Export security events': false,
      'Shared links': true,
      'Advanced link settings': true,
      'Disable downloads': false,
      'Custom expiration dates': false,
      'Password-protected links': false,
      'Comments on shares': true,
      'Comment attachments': false,
      'Share page customization': false,
      'Real-time Collaboration': true,
      'File Versioning': '30 days',
      'Theme Customization': true,
      'Advanced Integrations': false,
      'Security Events': '30 days',
      'Support': 'Email',
    },
    cta: 'Upgrade to Plus',
    stripePriceIds: {
      monthly: 'price_1SMxROKvH1nJPb5H75KlOnJu',
      yearly: 'price_1SMxSZKvH1nJPb59KA9xwPP',
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    rank: 2,
    price: {
      monthly: 13.99,
      yearly: 131.89,
      yearlyEquivalent: 10.99,
    },
    description: 'Ideal for power users',
    storage: '1 TB',
    quotaBytes: 1024 * 1024 * 1024 * 1024,
    popular: true,
    features: {
      'Storage Quota': '1 TB',
      'Spaces': '10',
      'Devices Limit': '10',
      'Trash Retention': '90 days',
      'Zero Knowledge Architecture': true,
      'Post-Quantum Cryptography': true,
      'End-to-End Encryption': true,
      'File Vault': true,
      'Verified Source': true,
      'Suspicious Activity Alerts': false,
      'Sentry: Advanced Analysis': true,
      'Export security events': true,
      'Shared links': true,
      'Advanced link settings': true,
      'Disable downloads': true,
      'Custom expiration dates': true,
      'Password-protected links': true,
      'Comments on shares': true,
      'Comment attachments': true,
      'Share page customization': true,
      'Real-time Collaboration': true,
      'File Versioning': '60 days',
      'Theme Customization': true,
      'Advanced Integrations': true,
      'Security Events': '60 days',
      'Support': 'Priority Email',
    },
    cta: 'Upgrade to Pro',
    stripePriceIds: {
      monthly: 'price_1SMxUfKvH1nJPb5HwlIETqMq',
      yearly: 'price_1SMxVVKvH1nJPb5HYL17MYFr',
    },
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    rank: 3,
    price: {
      monthly: 19.99,
      yearly: 203.89,
      yearlyEquivalent: 16.99,
    },
    description: 'For teams and enterprises',
    storage: '2 TB',
    quotaBytes: 2048 * 1024 * 1024 * 1024,
    features: {
      'Storage Quota': '2 TB',
      'Spaces': 'Unlimited',
      'Devices Limit': 'Unlimited',
      'Trash Retention': 'No limit',
      'Zero Knowledge Architecture': true,
      'Post-Quantum Cryptography': true,
      'End-to-End Encryption': true,
      'File Vault': true,
      'Verified Source': true,
      'Suspicious Activity Alerts': true,
      'Sentry: Advanced Analysis': true,
      'Export security events': true,
      'Shared links': true,
      'Advanced link settings': true,
      'Disable downloads': true,
      'Custom expiration dates': true,
      'Password-protected links': true,
      'Comments on shares': true,
      'Comment attachments': true,
      'Share page customization': true,
      'Real-time Collaboration': true,
      'File Versioning': '60 days',
      'Theme Customization': true,
      'Advanced Integrations': true,
      'Security Events': 'Unlimited',
      'Support': '24/7 Priority',
    },
    cta: 'Upgrade to Unlimited',
    stripePriceIds: {
      monthly: 'price_1SMxW8KvH1nJPb5HimvRSCLS',
      yearly: 'price_1SMxXEKvH1nJPb5HFzDxPu6R',
    },
  },
];

const featureCategories = [
  {
    name: 'Storage & Essentials',
    features: ['Storage Quota', 'Spaces', 'Devices Limit', 'Trash Retention']
  },
  {
    name: 'Privacy & Security',
    features: ['Zero Knowledge Architecture', 'Post-Quantum Cryptography', 'End-to-End Encryption', 'File Vault', 'Verified Source', 'Suspicious Activity Alerts', 'Sentry: Advanced Analysis', 'Export security events']
  },
  {
    name: 'Collaborative Sharing',
    features: ['Shared links', 'Advanced link settings', 'Disable downloads', 'Custom expiration dates', 'Password-protected links', 'Comments on shares', 'Comment attachments', 'Share page customization', 'Real-time Collaboration', 'File Versioning']
  },
  {
    name: 'Management & Support',
    features: ['Theme Customization', 'Advanced Integrations', 'Security Events', 'Support']
  }
];

const featureTooltips: Record<string, string> = {
  'Storage Quota': 'The total amount of encrypted storage space allocated to your account.',
  'Spaces': 'Dedicated environments to organize projects and collaborate with specific sets of users.',
  'Devices Limit': 'The maximum number of devices you can use to access your account simultaneously.',
  'Trash Retention': 'How long deleted files are kept in the trash before being permanently removed.',
  'Zero Knowledge Architecture': 'Architecture where the service provider has no knowledge of the keys used to encrypt user data.',
  'Post-Quantum Cryptography': 'State-of-the-art encryption designed to remain secure even against future quantum computer attacks.',
  'End-to-End Encryption': 'Data is encrypted on the sender\'s device and only decrypted on the recipient\'s device.',
  'File Vault': 'An additional high-security layer for sensitive files, requiring extra authentication.',
  'Verified Source': 'Cryptographic proof that a file was uploaded by a verified and authentic identity.',
  'Suspicious Activity Alerts': 'Real-time notifications for unusual login attempts, mass deletions, or potential ransomware behavior.',
  'Sentry: Advanced Analysis': 'Deep analytical view of security events including GeoIP, ISP, Device fingerprinting, and potential attack vectors.',
  'Export security events': 'Export your security logs and audit trails into JSON or CSV formats for external processing.',
  'Shared links': 'Generate secure URLs to share files or folders with anyone, even without an account.',
  'Advanced link settings': 'A suite of professional tools to control how your shared content is accessed.',
  'Disable downloads': 'Restrict shared links to view-only mode, preventing recipients from saving the file.',
  'Custom expiration dates': 'Set a specific timeframe after which a shared link will automatically become invalid.',
  'Password-protected links': 'Require a unique password for anyone attempting to access your shared link.',
  'Comments on shares': 'Enable encrypted conversation directly on the shared file page for streamlined feedback.',
  'Comment attachments': 'Allow users to attach supporting files directly within the comment threads of a share.',
  'Share page customization': 'Remove platform branding and apply your own custom themes, backgrounds, and accents (Planned).',
  'Real-time Collaboration': 'Collaborate with others in real-time with presence indicators and live updates (Planned).',
  'File Versioning': 'Track changes and restore previous versions of your files at any time (Planned).',
  'Theme Customization': 'Personalize your interface with custom color themes and layout preferences (In Development).',
  'Advanced Integrations': 'Build custom workflows and automate your storage with our developer API and real-time webhooks (Planned).',
  'Security Events': 'A comprehensive log of all security-related activities across your account.',
  'Support': 'Priority access to our technical support team for assistance.'
};

const BillingPage = () => {
  const router = useRouter();
  const { user } = useUser();
  const [frequency, setFrequency] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [history, setHistory] = useState<SubscriptionHistory | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isCryptoLoading, setIsCryptoLoading] = useState(false);

  // Cancellation Flow State
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelDetails, setCancelDetails] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  const currentPriceId = subscription?.plan?.id;
  const currentPlanObj = staticPlans.find(plan =>
    (currentPriceId && (plan.stripePriceIds.monthly === currentPriceId || plan.stripePriceIds.yearly === currentPriceId)) ||
    (!currentPriceId && plan.id === 'free')
  ) || staticPlans[0];
  const currentPlan = currentPlanObj.name;

  const handleAction = async (plan: TransformedPlan) => {
    const isCurrent = plan.id === currentPlanObj.id;
    if (isCurrent) return;

    // Check hierarchy to determine if it's a downgrade
    const isDowngrade = plan.rank < currentPlanObj.rank;

    if (isDowngrade) {
      // Storage usage enforcement
      if (usage && usage.usedBytes > plan.quotaBytes) {
        toast.error(`Downgrade blocked: Your usage (${formatFileSize(usage.usedBytes)}) exceeds the ${plan.storage} quota. Please free up space first!`);
        return;
      }

      if (plan.id === 'free') {
        setShowCancelConfirm(true);
        return;
      }
    }

    // Otherwise, it's an upgrade or paid-tier downgrade
    setSelectedPlanId(plan.id);
    setShowPaymentModal(true);
  };

  const handlePaymentMethodSelect = async (method: 'stripe' | 'crypto' | 'paypal') => {
    if (!selectedPlanId) return;

    setIsProcessingPayment(true);
    if (method === 'crypto') {
      setIsCryptoLoading(true);
      setShowPaymentModal(false);
    }

    try {
      const plan = staticPlans.find(p => p.id === selectedPlanId);
      if (!plan) throw new Error('Invalid plan');

      if (method === 'stripe') {
        const priceId = plan.stripePriceIds[frequency];
        const response = await apiClient.createCheckoutSession({
          priceId,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}/billing?canceled=true`,
        });

        if (response.success && response.data?.url) {
          window.location.href = response.data.url;
        } else {
          toast.error(response.error || 'Failed to process request');
        }
      } else if (method === 'crypto') {
        const price = plan.price[frequency];
        const response = await apiClient.createCryptoCheckoutSession({
          planId: plan.id,
          price,
          currency: 'USD',
          period: frequency === 'yearly' ? 'year' : 'month'
        });

        if (response.success && response.data?.url) {
          window.location.href = response.data.url;
        } else {
          toast.error(response.error || 'Failed to create crypto checkout');
          setIsCryptoLoading(false);
        }
      } else {
        toast.info('PayPal checkout coming soon!');
      }
    } catch (error) {
      console.error('Action error:', error);
      toast.error('Failed to process request');
      setIsCryptoLoading(false);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const response = await apiClient.createPortalSession({
        returnUrl: window.location.href,
      });
      if (response.success && response.data?.url) {
        window.location.href = response.data.url;
      } else {
        toast.error('Failed to open billing portal');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subRes, historyRes] = await Promise.all([
          apiClient.getSubscriptionStatus(),
          apiClient.getSubscriptionHistory()
        ]);

        if (subRes.success && subRes.data) {
          setSubscription(subRes.data.subscription);
          setUsage(subRes.data.usage);
        }
        if (historyRes.success && historyRes.data) {
          setHistory(historyRes.data);
        }
      } catch (error) {
        console.error('Failed to fetch billing data:', error);
        toast.error('Failed to load billing information');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleConfirmCancel = () => {
    setShowCancelConfirm(false);
    setShowCancelReason(true);
  };

  const handleSubmitCancellation = async () => {
    if (!cancelReason) {
      toast.error("Please select a reason for cancellation");
      return;
    }

    setIsSubmittingCancel(true);
    try {
      // 1. Submit reason to backend (Discord)
      const reasonRes = await apiClient.cancelSubscriptionWithReason({
        reason: cancelReason,
        details: cancelDetails
      });

      if (!reasonRes.success) {
        console.warn("Feedback submission failed, but proceeding with cancellation.");
      }

      // 2. Perform actual cancellation
      const cancelRes = await apiClient.cancelSubscription();
      if (cancelRes.success) {
        toast.success('Subscription cancelled. Your plan will revert to Free at the end of the period.');
        setShowCancelReason(false);
        // Refresh to update UI
        window.location.reload();
      } else {
        toast.error(cancelRes.error || 'Failed to cancel subscription');
      }
    } catch (e) {
      toast.error('An error occurred during cancellation');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Integrated Header */}
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="flex flex-col">
          <h1 className="text-lg font-medium leading-none font-sans text-foreground">Billing</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <SectionGroup variant="full">
          {/* Usage Section */}
          <Section>
            <SectionHeader>
              <SectionTitle>Plan & Usage</SectionTitle>
              <SectionDescription>Manage your subscription and storage.</SectionDescription>
            </SectionHeader>

            <FormCard>
              <FormCardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <FormCardTitle className="text-xl">Current Plan: {currentPlan}</FormCardTitle>
                    <FormCardDescription className="text-base text-muted-foreground/80">
                      {currentPlan.toLowerCase() === 'free'
                        ? 'You are currently on the free plan.'
                        : `Your next renewal is on ${new Date(subscription!.currentPeriodEnd * 1000).toLocaleDateString()}.`}
                    </FormCardDescription>
                  </div>
                  {currentPlan.toLowerCase() !== 'free' ? (
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-0.5">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground border-muted-foreground/20 px-3 py-0.5">
                      Free Tier
                    </Badge>
                  )}
                </div>
              </FormCardHeader>
              <FormCardContent className="py-8 px-8">
                <div className="space-y-4">
                  <BillingProgress
                    label="Storage Usage"
                    current={formatFileSize(usage?.usedBytes || 0)}
                    total={formatFileSize(usage?.quotaBytes || 1073741824)}
                  />
                </div>
              </FormCardContent>
              <FormCardFooter>
                <div className="flex w-full items-center justify-between">
                  <p className="text-sm text-muted-foreground font-medium">
                    Access your billing information, invoices and payment methods via Stripe.
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleManageBilling}
                    className="gap-2 h-9 px-4 text-sm font-semibold shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Customer Portal
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </FormCardFooter>
            </FormCard>
          </Section>

          {/* Pricing Comparison Table Section */}
          <Section>
            <SectionHeader>
              <div className="flex items-end justify-between">
                <div>
                  <SectionTitle>Plans</SectionTitle>
                  <SectionDescription>Choose the best plan for you.</SectionDescription>
                </div>
                <Tabs defaultValue={frequency} onValueChange={(v) => setFrequency(v as any)} className="mb-1">
                  <TabsList className="h-9 p-1">
                    <TabsTrigger value="monthly" className="h-7 px-4 text-xs font-medium">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly" className="h-7 px-4 text-xs font-medium">
                      Yearly
                      <span className="ml-1.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-500 font-bold">
                        -20%
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </SectionHeader>

            <FormCard className="overflow-hidden shadow-sm">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead className="w-[20%] py-12 px-6 text-sm font-medium text-muted-foreground border-r text-left">
                      Features comparison
                    </TableHead>
                    {staticPlans.map(plan => {
                      const isCurrent = plan.id === currentPlanObj.id;
                      const price = frequency === 'monthly' ? plan.price.monthly : plan.price.yearlyEquivalent;
                      const isUpgrade = plan.rank > currentPlanObj.rank;
                      const isDowngrade = plan.rank < currentPlanObj.rank;

                      return (
                        <TableHead key={plan.id} className={cn(
                          "w-[20%] text-center py-12 px-2 align-top",
                          plan.id === 'pro' && "bg-muted/50 border-x border-primary/10 shadow-[inset_0_0_0_1px_rgba(var(--primary),0.05)]"
                        )}>
                          <div className="flex flex-col gap-6 items-center w-full">
                            <div className="flex flex-col gap-1.5 items-center">
                              <div className="flex items-center gap-2 justify-center">
                                <span className="text-xl font-medium font-sans leading-none">{plan.name}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed text-center w-full max-w-[130px] font-mono opacity-80 min-h-[2.5rem] flex items-center justify-center">
                                {plan.description}
                              </p>
                              <div className="flex flex-col items-center mt-3 min-h-[3.5rem] justify-center">
                                <div className="flex items-baseline gap-1.5">
                                  <span className="font-mono text-xl font-medium">
                                    $<NumberFlow
                                      value={price}
                                      format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                                    />
                                  </span>
                                  {plan.id !== 'free' && (
                                    <span className="text-xs text-muted-foreground opacity-60 font-mono">
                                      /mo
                                    </span>
                                  )}
                                </div>
                                {frequency === 'yearly' && plan.price.yearly > 0 ? (
                                  <span className="text-[10px] text-muted-foreground font-mono opacity-50 mt-1">
                                    ${plan.price.yearly} billed annually
                                  </span>
                                ) : (
                                  <div className="h-4" /> /* Empty spacer for alignment */
                                )}
                              </div>
                            </div>

                            <Button
                              className={cn(
                                "h-9 w-full max-w-[140px] text-xs font-bold tracking-wider transition-all",
                                plan.id === 'pro' && !isCurrent ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""
                              )}
                              variant={plan.id === 'pro' && !isCurrent ? 'default' : 'outline'}
                              disabled={isCurrent}
                              onClick={() => handleAction(plan)}
                              size="sm"
                            >
                              {isCurrent ? 'Current' : isUpgrade ? 'Upgrade' : isDowngrade ? 'Downgrade' : 'Choose'}
                            </Button>
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {featureCategories.map((category) => (
                    <React.Fragment key={category.name}>
                      <TableRow className="bg-muted/20 hover:bg-muted/20 border-b-0">
                        <TableCell colSpan={5} className="py-2.5 px-6 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 border-b text-left">
                          {category.name}
                        </TableCell>
                      </TableRow>
                      {category.features.map((feature) => (
                        <TableRow key={feature} className="hover:bg-muted/10 transition-colors">
                          <TableCell className="py-5 px-6 text-sm font-medium text-foreground/90 border-r text-left">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                (feature === 'Disable downloads' || feature === 'Custom expiration dates' || feature === 'Password-protected links' || feature === 'Comments on shares' || feature === 'Comment attachments' || feature === 'Share page customization') && "pl-4 text-muted-foreground/80 font-normal",
                                feature === 'Advanced Integrations' && "whitespace-pre-line"
                              )}>
                                {feature === 'Advanced Integrations' ? 'Advanced Integrations\n(API & Webhooks)' : feature}
                              </span>
                              {featureTooltips[feature] && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button className="text-muted-foreground hover:text-foreground outline-none">
                                      <InfoCircle className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-[200px] text-center">
                                    {featureTooltips[feature]}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                          {staticPlans.map((plan) => (
                            <TableCell key={`${plan.id}-${feature}`} className={cn(
                              "text-center py-5 px-2 border-b",
                              plan.id === 'pro' && "bg-muted/30 border-x border-primary/10"
                            )}>
                              {typeof plan.features[feature] === 'string' ? (
                                <span className="text-sm font-mono font-medium">{plan.features[feature]}</span>
                              ) : plan.features[feature] ? (
                                <div className="flex justify-center">
                                  {feature === 'Verified Source' ? (
                                    <IconRosetteDiscountCheckFilled className="text-background size-5 fill-sky-500" />
                                  ) : (
                                    <Check className="h-4.5 w-4.5 text-emerald-500" strokeWidth={3} />
                                  )}
                                </div>
                              ) : (
                                <div className="flex justify-center">
                                  <X className="h-4.5 w-4.5 text-muted-foreground/15" strokeWidth={3} />
                                </div>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </FormCard>
          </Section>

          {/* Billing History Section */}
          {history && history.invoices.length > 0 && (
            <Section>
              <SectionHeader>
                <SectionTitle>History</SectionTitle>
                <SectionDescription>Your recent invoices.</SectionDescription>
              </SectionHeader>

              <FormCard>
                <div className="divide-y">
                  {history.invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-5 px-8 text-sm hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-5">
                        <div className="rounded-full bg-muted p-2.5">
                          <History className="h-4.5 w-4.5 text-muted-foreground/70" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-sm text-foreground/90">{new Date(invoice.created * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          <span className="text-[10px] text-muted-foreground font-mono opacity-60 tracking-wider">#{invoice.number.split('-').pop()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <span className="font-mono font-medium tabular-nums text-foreground/80 text-base">
                          ${(invoice.amount / 100).toFixed(2)} <span className="text-[10px] uppercase ml-1 opacity-40">{invoice.currency}</span>
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-9 w-9 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <a href={invoice.invoicePdf} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </FormCard>
            </Section>
          )}
        </SectionGroup>
      </div>

      <PaymentMethodModal
        isOpen={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        onSelectMethod={handlePaymentMethodSelect}
        isLoading={isProcessingPayment}
        planFrequency={frequency}
      />

      {/* Cancellation Flow Modals */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel your current {currentPlan} subscription. You will retain your benefits until the end of your current billing period, after which your account will revert to the Free tier with a 5GB storage limit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my plan</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, cancel subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showCancelReason} onOpenChange={setShowCancelReason}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reason for cancellation</DialogTitle>
            <DialogDescription>
              We're sorry to see you go. Help us improve by telling us why you're cancelling.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Why are you leaving? <span className="text-destructive">*</span></Label>
              <Select onValueChange={setCancelReason} value={cancelReason}>
                <SelectTrigger id="reason" className="w-full">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="too_expensive">Too expensive</SelectItem>
                  <SelectItem value="not_enough_storage">Not enough storage</SelectItem>
                  <SelectItem value="switching_services">Switching to another service</SelectItem>
                  <SelectItem value="not_using_features">Not using the features</SelectItem>
                  <SelectItem value="performance_issues">Performance issues</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="details">Additional details (Optional)</Label>
              <Textarea
                id="details"
                placeholder="Tell us more about your experience..."
                className="min-h-[100px] resize-none"
                maxLength={1000}
                value={cancelDetails}
                onChange={(e) => setCancelDetails(e.target.value)}
              />
              <div className="text-[10px] text-muted-foreground text-right tabular-nums">
                {cancelDetails.length} / 1000
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelReason(false)}>Back</Button>
            <Button
              className="gap-2"
              onClick={handleSubmitCancellation}
              disabled={!cancelReason || isSubmittingCancel}
            >
              {isSubmittingCancel && <Loader2 className="h-4 w-4 animate-spin" />}
              Complete Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isCryptoLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-8 max-w-sm w-full px-6 text-center">
            <div className="relative">
              <div className="absolute inset-0 blur-3xl bg-primary/10 rounded-full animate-pulse" />
              <div className="relative h-20 w-20 flex items-center justify-center rounded-full border border-primary/20 bg-card shadow-xl">
                <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-medium tracking-tight font-sans">Preparing Secure Gateway</h2>
              <p className="text-sm text-muted-foreground font-mono leading-relaxed opacity-80">
                Generating your unique crypto payment gateway, please wait a moment.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-10 px-8 text-xs font-bold tracking-widest rounded-full shadow-sm hover:shadow-md transition-all"
              onClick={() => setIsCryptoLoading(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingPage;
