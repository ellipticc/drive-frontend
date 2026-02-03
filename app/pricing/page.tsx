'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  IconLoader2 as Loader2,
  IconCheck as Check,
  IconExternalLink as ExternalLink,
  IconDownload as Download,
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFormatter } from '@/hooks/use-formatter';
import { apiClient, Subscription, BillingUsage, SubscriptionHistory } from '@/lib/api';
import { cn, formatFileSize } from '@/lib/utils';
import { PricingTable } from '@/components/ui/pricing-table';

import React from 'react';

import {
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
    storage: '2 GB',
    quotaBytes: 2 * 1024 * 1024 * 1024,
    features: {
      'Storage Quota': '2 GB',
      'Spaces': '2',
      'Devices Limit': '2',
      'Device Labeling': false,
      'Trash Retention': '30 days',
      'Zero Knowledge Architecture': true,
      'Post-Quantum Cryptography': true,
      'End-to-End Encryption': true,
      'Two-Factor Auth (TOTP)': true,
      'Secured File Previews': true,
      'File Vault': false,
      'Verified Source': false,
      'Paper Pages': '3 Pages',
      'Paper Collaboration': false,
      'Paper Version History': false,
      'Suspicious Activity Alerts': false,
      'Vigil: Advanced Analysis': false,
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
      'Encrypted File Requests': false,
      'File Versioning': 'No',
      'Advanced Tagging': false,
      'Theme Customization': false,
      'Support': 'Community',
      'Webhooks': false,
      'Monthly Event Limit': '-',
      'Custom Signing Secret': false,
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
      monthly: 5.99,
      yearly: 57.50,
      yearlyEquivalent: 4.79,
    },
    description: 'Perfect for getting started',
    storage: '200 GB',
    quotaBytes: 200 * 1024 * 1024 * 1024,
    features: {
      'Storage Quota': '200 GB',
      'Spaces': '5',
      'Devices Limit': '5',
      'Device Labeling': true,
      'Trash Retention': '60 days',
      'Zero Knowledge Architecture': true,
      'Post-Quantum Cryptography': true,
      'End-to-End Encryption': true,
      'Two-Factor Auth (TOTP)': true,
      'Secured File Previews': true,
      'File Vault': false,
      'Verified Source': true,
      'Paper Pages': 'Unlimited',
      'Paper Collaboration': 'Advanced',
      'Paper Version History': '30 days',
      'Suspicious Activity Alerts': false,
      'Vigil: Advanced Analysis': false,
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
      'Encrypted File Requests': true,
      'File Versioning': '30 days',
      'Advanced Tagging': true,
      'Theme Customization': true,
      'Support': 'Email',
      'Webhooks': false,
      'Monthly Event Limit': '-',
      'Custom Signing Secret': false,
    },
    cta: 'Upgrade to Plus',
    stripePriceIds: {
      monthly: 'price_1SnnAbKvH1nJPb5HFaeR3r1T',
      yearly: 'price_1SnnB3KvH1nJPb5HOzg1ZoeD',
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    rank: 2,
    price: {
      monthly: 13.99,
      yearly: 134.30,
      yearlyEquivalent: 11.19,
    },
    description: 'Ideal for power users',
    storage: '500 GB',
    quotaBytes: 500 * 1024 * 1024 * 1024,
    popular: true,
    features: {
      'Storage Quota': '500 GB',
      'Spaces': '10',
      'Devices Limit': '10',
      'Device Labeling': true,
      'Trash Retention': '90 days',
      'Zero Knowledge Architecture': true,
      'Post-Quantum Cryptography': true,
      'End-to-End Encryption': true,
      'Two-Factor Auth (TOTP)': true,
      'Secured File Previews': true,
      'File Vault': true,
      'Verified Source': true,
      'Paper Pages': 'Unlimited',
      'Paper Collaboration': 'Advanced',
      'Paper Version History': '180 days',
      'Suspicious Activity Alerts': false,
      'Vigil: Advanced Analysis': true,
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
      'Encrypted File Requests': true,
      'File Versioning': '60 days',
      'Advanced Tagging': true,
      'Theme Customization': true,
      'Security Events': '60 days',
      'Support': 'Priority Email',
      'Webhooks': true,
      'Monthly Event Limit': '500',
      'Custom Signing Secret': false,
    },
    cta: 'Upgrade to Pro',
    stripePriceIds: {
      monthly: 'price_1SnnBNKvH1nJPb5HTHDeNWdS',
      yearly: 'price_1SnnCEKvH1nJPb5HzMXUp10Z',
    },
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    rank: 3,
    price: {
      monthly: 23.99,
      yearly: 230.30,
      yearlyEquivalent: 19.19,
    },
    description: 'For teams and enterprises',
    storage: '2 TB',
    quotaBytes: 2048 * 1024 * 1024 * 1024,
    features: {
      'Storage Quota': '2 TB',
      'Spaces': 'Unlimited',
      'Devices Limit': 'Unlimited',
      'Device Labeling': true,
      'Trash Retention': 'No limit',
      'Zero Knowledge Architecture': true,
      'Post-Quantum Cryptography': true,
      'End-to-End Encryption': true,
      'Two-Factor Auth (TOTP)': true,
      'Secured File Previews': true,
      'File Vault': true,
      'Verified Source': true,
      'Paper Pages': 'Unlimited',
      'Paper Collaboration': 'Advanced',
      'Paper Version History': 'No limit',
      'Suspicious Activity Alerts': true,
      'Vigil: Advanced Analysis': true,
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
      'Encrypted File Requests': true,
      'File Versioning': 'No limit',
      'Advanced Tagging': true,
      'Theme Customization': true,
      'Security Events': 'Unlimited',
      'Support': '24/7 Priority',
      'Webhooks': true,
      'Monthly Event Limit': '10,000',
      'Custom Signing Secret': true,
    },
    cta: 'Upgrade to Unlimited',
    stripePriceIds: {
      monthly: 'price_1SnnCeKvH1nJPb5HbOrEUqm2',
      yearly: 'price_1SnnCzKvH1nJPb5Howw5DH1W',
    },
  },
];

const featureCategories = [
  {
    name: 'Storage & Capacity',
    features: ['Storage Quota', 'Spaces', 'Devices Limit', 'Trash Retention']
  },
  {
    name: 'Security & Privacy',
    features: ['Zero Knowledge Architecture', 'Post-Quantum Cryptography', 'End-to-End Encryption', 'Two-Factor Auth (TOTP)', 'Secured File Previews', 'Verified Source', 'File Vault']
  },
  {
    name: 'Ellipticc Paper (NEW)',
    features: ['Paper Pages', 'Paper Collaboration', 'Paper Version History']
  },
  {
    name: 'Security Insights',
    features: ['Security Events', 'Export security events', 'Vigil: Advanced Analysis', 'Suspicious Activity Alerts']
  },
  {
    name: 'Sharing & Collaboration',
    features: ['Shared links', 'Comments on shares', 'Encrypted File Requests', 'Advanced link settings', 'Disable downloads', 'Custom expiration dates', 'Password-protected links', 'Comment attachments', 'File Versioning']
  },
  {
    name: 'Platform & Experience',
    features: ['Device Labeling', 'Advanced Tagging', 'Theme Customization', 'Support']
  },
  {
    name: 'Advanced Integrations (API & Webhooks)',
    features: ['Webhooks', 'Monthly Event Limit', 'Custom Signing Secret']
  }
];

const featureTooltips: Record<string, string> = {
  'Storage Quota': 'The total amount of encrypted storage space allocated to your account.',
  'Spaces': 'Dedicated environments to organize projects and collaborate with specific sets of users.',
  'Devices Limit': 'The maximum number of devices you can use to access your account simultaneously.',
  'Device Labeling': 'Assign custom names to your devices for easier identification in the dashboard.',
  'Trash Retention': 'How long deleted files are kept in the trash before being permanently removed.',
  'Zero Knowledge Architecture': 'Architecture where the service provider has no knowledge of the keys used to encrypt user data.',
  'Post-Quantum Cryptography': 'State-of-the-art encryption designed to remain secure even against future quantum computer attacks.',
  'End-to-End Encryption': 'Data is encrypted on the sender\'s device and only decrypted on the recipient\'s device.',
  'Two-Factor Auth (TOTP)': 'Secure your account with time-based one-time passwords from apps like Authy or Google Authenticator.',
  'Secured File Previews': 'Preview photos, videos, and documents safely within our encrypted sandbox without ever compromising the source file.',
  'File Vault': 'An additional high-security layer for sensitive files, requiring extra authentication.',
  'Verified Source': 'Cryptographic proof that a file was uploaded by a verified and authentic identity.',
  'Paper Pages': 'The number of rich text documents you can create and manage in Ellipticc Paper.',
  'Paper Collaboration': 'Collaborate with team members on rich text documents with different levels of access and live feedback.',
  'Paper Version History': 'Track changes and revert to older versions of your Ellipticc Paper documents.',
  'Suspicious Activity Alerts': 'Real-time notifications for unusual login attempts, mass deletions, or potential ransomware behavior.',
  'Vigil: Advanced Analysis': 'Deep analytical view of security events including GeoIP, ISP, Device fingerprinting, and potential attack vectors.',
  'Export security events': 'Export your security logs and audit trails into JSON or CSV formats for external processing.',
  'Shared links': 'Generate secure URLs to share files or folders with anyone, even without an account.',
  'Advanced link settings': 'A suite of professional tools to control how your shared content is accessed.',
  'Disable downloads': 'Restrict shared links to view-only mode, preventing recipients from saving the file.',
  'Custom expiration dates': 'Set a specific timeframe after which a shared link will automatically become invalid.',
  'Password-protected links': 'Require a unique password for anyone attempting to access your shared link.',
  'Encrypted File Requests': 'Create a secure link for others to upload files directly to your encrypted storage.',
  'Comments on shares': 'Enable encrypted conversation directly on the shared file page for streamlined feedback.',
  'Comment attachments': 'Allow users to attach supporting files directly within the comment threads of a share.',
  'Real-time Collaboration': 'Collaborate with others in real-time with presence indicators and live updates.',
  'File Versioning': 'Track changes and restore previous versions of your files at any time.',
  'Advanced Tagging': 'Organize files with custom tags, color-coding, and perform advanced tag-based searches.',
  'Theme Customization': 'Personalize your interface with custom color themes and layout preferences.',
  'Webhooks': 'Receive real-time notifications for events in your account.',
  'Monthly Event Limit': 'The maximum number of webhook events you can receive per month.',
  'Custom Signing Secret': 'Set your own secret for verifying webhook signatures (Unlimited only).',
  'Security Events': 'A comprehensive log of all security-related activities across your account.',
  'Support': 'Priority access to our technical support team for assistance.'
};

const BillingPage = () => {
  const [frequency, setFrequency] = useState<'monthly' | 'yearly'>('yearly');
  const { formatDate } = useFormatter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [hasUsedTrial, setHasUsedTrial] = useState<boolean>(false);
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

  // Mobile Comparison State
  const [leftPlanIdx, setLeftPlanIdx] = useState(0); // Default: Free
  const [rightPlanIdx, setRightPlanIdx] = useState(2); // Default: Pro
  const [isMobileView, setIsMobileView] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
          successUrl: `${window.location.origin}/pricing?success=true`,
          cancelUrl: `${window.location.origin}/pricing?canceled=true`,
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
    } catch {
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
          setHasUsedTrial(subRes.data.hasUsedTrial);
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
      // 1. Submit reason to backend
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
    } catch {
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
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Integrated Header */}
      <header data-sticky="true" className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center justify-between border-b bg-background w-full">
        <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="-ml-1" />
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Toggle Sidebar <span className="text-muted-foreground ml-1">Ctrl+B</span></p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          <div className="flex flex-col">
            <h1 className="text-lg font-medium leading-none font-sans text-foreground">Billing</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <ThemeToggle />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Toggle Theme <span className="text-muted-foreground ml-1">Ctrl+D</span></p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="flex flex-1 flex-col gap-8 p-4 lg:gap-12 lg:p-6 w-full">
          {/* Usage Section */}
          <Section>
            <SectionHeader>
              <SectionTitle>Plan & Usage</SectionTitle>
              <SectionDescription>Manage your subscription and storage.</SectionDescription>
            </SectionHeader>

            <FormCard>
              <FormCardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <FormCardTitle className="text-xl">Current Plan: {currentPlan}</FormCardTitle>
                    <FormCardDescription className="text-base text-muted-foreground/80">
                      {currentPlan.toLowerCase() === 'free'
                        ? 'You are currently on the free plan.'
                        : subscription?.cancelAtPeriodEnd
                          ? (subscription.currentPeriodEnd
                            ? `Your ${subscription.status === 'trialing' ? 'trial' : 'plan'} will expire on ${formatDate(subscription.currentPeriodEnd * 1000)}.`
                            : `Your ${subscription.status === 'trialing' ? 'trial' : 'plan'} is scheduled for termination.`)
                          : (subscription?.currentPeriodEnd
                            ? `Your next renewal is on ${formatDate(subscription.currentPeriodEnd * 1000)}.`
                            : 'Subscription status active.')}
                    </FormCardDescription>
                  </div>
                  <div className="flex items-center">
                    {currentPlan.toLowerCase() !== 'free' ? (
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-0.5 whitespace-nowrap">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground border-muted-foreground/20 px-3 py-0.5 whitespace-nowrap">
                        Free Tier
                      </Badge>
                    )}
                  </div>
                </div>
              </FormCardHeader>
              <FormCardContent className="py-8 px-4 sm:px-8">
                <div className="space-y-4">
                  <BillingProgress
                    label="Storage Usage"
                    current={formatFileSize(usage?.usedBytes || 0)}
                    total={formatFileSize(usage?.quotaBytes || 2147483648)}
                    progress={usage?.percentUsed}
                  />
                </div>
              </FormCardContent>
              <FormCardFooter>
                <div className="flex flex-col sm:flex-row w-full items-start sm:items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground font-medium max-w-lg">
                    Access your billing information, invoices and payment methods via Stripe.
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleManageBilling}
                    className="w-full sm:w-auto gap-2 h-9 px-4 text-sm font-semibold shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
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
                <Tabs defaultValue={frequency} onValueChange={(v) => setFrequency(v as 'monthly' | 'yearly')} className="mb-1">
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

            {/* Mobile Comparison Selector - Removed standalone version to integrate into table header */}
            {isMobileView && (
              <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
                <p className="text-sm text-muted-foreground text-center">Select two plans below to compare their features side-by-side.</p>
              </div>
            )}

            <FormCard className="shadow-sm border-primary/5">
              <div className="w-full">
                <PricingTable className={cn("w-full transition-all duration-300", isMobileView ? "table-fixed min-w-[320px]" : "table-fixed min-w-[1000px]")}>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b">
                      <TableHead className={cn(
                        "py-12 px-6 text-sm font-medium text-muted-foreground border-r text-left align-middle bg-background transition-all duration-300 relative",
                        isMobileView ? "w-[40%] text-xs px-3 whitespace-normal break-words" : "w-[20%]"
                      )}>
                        Features comparison
                      </TableHead>
                      {(isMobileView ? [staticPlans[leftPlanIdx], staticPlans[rightPlanIdx]] : staticPlans).map((plan, index) => {
                        const isCurrent = plan.id === currentPlanObj.id;
                        const price = frequency === 'monthly' ? plan.price.monthly : plan.price.yearlyEquivalent;
                        const isUpgrade = plan.rank > currentPlanObj.rank;
                        const isDowngrade = plan.rank < currentPlanObj.rank;

                        return (
                          <TableHead key={`${plan.id}-${index}`} className={cn(
                            "text-center py-8 align-top transition-all duration-300 bg-background relative",
                            isMobileView ? "w-[30%] px-1" : "w-[20%] px-4",
                            plan.id === 'pro' && "border-x border-primary/10 after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-primary/10 after:content-[''] before:absolute before:inset-y-0 before:right-0 before:w-px before:bg-primary/10 before:content-['']"
                          )}>
                            <div className="flex flex-col gap-4 items-center w-full">
                              <div className="flex flex-col gap-1.5 items-center w-full">
                                <div className="flex items-center justify-center w-full">
                                  {isMobileView ? (
                                    <div className="w-full">
                                      <Select
                                        value={index === 0 ? leftPlanIdx.toString() : rightPlanIdx.toString()}
                                        onValueChange={(v) => {
                                          const idx = parseInt(v);
                                          if (index === 0) {
                                            if (idx === rightPlanIdx) setRightPlanIdx(leftPlanIdx);
                                            setLeftPlanIdx(idx);
                                          } else {
                                            if (idx === leftPlanIdx) setLeftPlanIdx(rightPlanIdx);
                                            setRightPlanIdx(idx);
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-8 w-full text-[11px] font-semibold bg-transparent border-primary/20 hover:bg-accent/50 transition-colors px-1 [&>span]:truncate">
                                          <SelectValue placeholder={plan.name} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {staticPlans.map((p, i) => (
                                            <SelectItem key={p.id} value={i.toString()} className="text-xs">
                                              {p.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  ) : (
                                    <span className="text-xl font-medium font-sans leading-none transition-all">{plan.name}</span>
                                  )}
                                </div>
                                {!isMobileView && (
                                  <p className="text-[11px] text-muted-foreground leading-relaxed text-center w-full max-w-[130px] font-mono opacity-80 min-h-[2.5rem] flex items-center justify-center">
                                    {plan.description}
                                  </p>
                                )}
                                <div className="flex flex-col items-center mt-3 min-h-[3.5rem] justify-center">
                                  <div className="flex items-baseline gap-1.5">
                                    <span className={cn("font-mono font-medium", isMobileView ? "text-lg" : "text-xl")}>
                                      $<NumberFlow
                                        value={price}
                                        format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                                      />
                                    </span>
                                    {plan.id !== 'free' && (
                                      <span className="text-[10px] text-muted-foreground opacity-60 font-mono">
                                        /mo
                                      </span>
                                    )}
                                  </div>
                                  {frequency === 'yearly' && plan.price.yearly > 0 ? (
                                    <span className={cn(
                                      "text-[9px] text-muted-foreground font-mono opacity-50 mt-1",
                                      isMobileView ? "whitespace-normal text-center leading-tight px-1" : "whitespace-nowrap"
                                    )}>
                                      ${plan.price.yearly} billed annually
                                    </span>
                                  ) : (
                                    <div className="h-4" />
                                  )}
                                </div>
                              </div>

                              <Button
                                className={cn(
                                  "h-8 w-full transition-all text-[10px] font-bold tracking-wider",
                                  isMobileView ? "w-full px-1" : "max-w-[140px] h-9 text-xs",
                                  plan.id === 'pro' && !isCurrent ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/10" : ""
                                )}
                                variant={plan.id === 'pro' && !isCurrent ? 'default' : 'outline'}
                                disabled={isCurrent}
                                onClick={() => handleAction(plan)}
                                size="sm"
                              >
                                {isCurrent
                                  ? 'Current'
                                  : (!hasUsedTrial && isUpgrade && plan.id !== 'free')
                                    ? '7-Day Free Trial'
                                    : isUpgrade
                                      ? 'Upgrade'
                                      : isDowngrade
                                        ? 'Downgrade'
                                        : 'Choose'}
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
                        <TableRow className="bg-muted/10 hover:bg-muted/10 border-b-0">
                          <TableCell colSpan={isMobileView ? 3 : 5} className="py-3 px-6 text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50 border-b text-left">
                            {category.name}
                          </TableCell>
                        </TableRow>
                        {featureCategories.flatMap(c => c.name === category.name ? c.features : []).map((feature) => (
                          <TableRow key={feature} className="hover:bg-muted/5 transition-colors group">
                            <TableCell className={cn(
                              "py-4 px-3 sm:px-6 text-foreground/90 border-r text-left transition-all align-middle",
                              isMobileView ? "text-[10px] leading-tight break-words whitespace-normal px-2" : "text-sm",
                              "group-hover:bg-muted/5"
                            )}>
                              <div className="flex flex-wrap items-center gap-1">
                                <span className={cn(
                                  "text-foreground/90",
                                  feature === 'Advanced Integrations' && "whitespace-pre-line"
                                )}>
                                  {feature === 'Advanced Integrations' ? (isMobileView ? 'Adv. Integrations' : 'Advanced Integrations\n(API & Webhooks)') : feature}
                                </span>
                                {featureTooltips[feature] && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button className="text-muted-foreground hover:text-foreground opacity-40 hover:opacity-100 transition-opacity focus:outline-none [-webkit-tap-highlight-color:transparent]">
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
                            {(isMobileView ? [staticPlans[leftPlanIdx], staticPlans[rightPlanIdx]] : staticPlans).map((plan) => (
                              <TableCell key={`${plan.id}-${feature}`} className={cn(
                                "text-center py-4 px-2 border-b transition-all",
                                plan.id === 'pro' && "bg-muted/10 border-x border-primary/5"
                              )}>
                                {typeof plan.features[feature] === 'string' ? (
                                  <span className={cn("font-mono font-medium", isMobileView ? "text-xs" : "text-sm")}>{plan.features[feature]}</span>
                                ) : plan.features[feature] ? (
                                  <div className="flex justify-center">
                                    {feature === 'Verified Source' ? (
                                      <IconRosetteDiscountCheckFilled className={cn("text-background fill-sky-500", isMobileView ? "size-4" : "size-5")} />
                                    ) : (
                                      <Check className={cn("text-emerald-500", isMobileView ? "h-3.5 w-3.5" : "h-4.5 w-4.5")} strokeWidth={3} />
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex justify-center">
                                    <X className={cn("text-muted-foreground/10", isMobileView ? "h-3.5 w-3.5" : "h-4.5 w-4.5")} strokeWidth={3} />
                                  </div>
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </PricingTable>
              </div>
            </FormCard>
          </Section>

          {/* Billing History Section */}
          {history && (history.history?.length > 0 || history.invoices?.length > 0) && (
            <Section>
              <SectionHeader>
                <SectionTitle>History</SectionTitle>
                <SectionDescription>Your recent subscription activity and invoices.</SectionDescription>
              </SectionHeader>

              <div className="space-y-8">
                {/* Subscription History Table */}
                {history.history && history.history.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold px-1">Subscription Record</h4>
                    <FormCard className="p-0 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="w-[200px] px-4 py-3 text-[11px] uppercase tracking-wider font-bold align-middle">Plan</TableHead>
                            <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider font-bold align-middle">Status</TableHead>
                            <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider font-bold align-middle">Amount</TableHead>
                            <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider font-bold align-middle">Billing Cycle</TableHead>
                            <TableHead className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-bold align-middle">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {history.history.map((sub: SubscriptionHistory['history'][0]) => (
                            <TableRow key={sub.id} className="hover:bg-muted/20 transition-colors">
                              <TableCell className="px-4 py-3 align-middle">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-sm">{sub.planName}</span>
                                  <span className="text-[10px] text-muted-foreground uppercase font-mono opacity-60 tracking-tight">{sub.interval}ly</span>
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle">
                                <span className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight",
                                  sub.status === 'active'
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                    : sub.status === 'canceled'
                                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                      : sub.status === 'past_due'
                                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                        : 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400'
                                )}>
                                  {sub.status === 'active' ? 'Active' : sub.status === 'canceled' ? 'Cancelled' : sub.status === 'past_due' ? 'Past Due' : sub.status}
                                  {sub.cancelAtPeriodEnd && ' (Expiring)'}
                                </span>
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-sm font-mono font-medium">${sub.amount.toFixed(2)}</span>
                                  <span className="text-[9px] text-muted-foreground uppercase opacity-50">{sub.currency}</span>
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-3 text-sm text-foreground/70 capitalize align-middle">
                                {sub.interval}ly
                              </TableCell>
                              <TableCell className="px-4 py-3 text-right text-xs text-muted-foreground font-mono align-middle">
                                {new Date(sub.created * 1000).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </FormCard>
                  </div>
                )}

                {/* Invoices Table */}
                {history.invoices && history.invoices.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold px-1">Recent Invoices</h4>
                    <FormCard className="p-0 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="w-[30%] px-4 py-3 text-[11px] uppercase tracking-wider font-bold align-middle">Invoice #</TableHead>
                            <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider font-bold align-middle">Status</TableHead>
                            <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider font-bold align-middle">Amount</TableHead>
                            <TableHead className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-bold align-middle">Date</TableHead>
                            <TableHead className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-bold align-middle">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {history.invoices.map((invoice) => (
                            <TableRow key={invoice.id} className="hover:bg-muted/20 transition-colors">
                              <TableCell className="px-4 py-3 font-mono text-[11px] text-muted-foreground align-middle">
                                {invoice.id}
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle">
                                <span className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight",
                                  invoice.status === 'paid'
                                    ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400'
                                )}>
                                  {invoice.status}
                                </span>
                              </TableCell>
                              <TableCell className="px-4 py-3 text-sm font-mono font-medium align-middle">
                                ${invoice.amount ? (invoice.amount / 100).toFixed(2) : '0.00'}
                              </TableCell>
                              <TableCell className="px-4 py-3 text-right text-xs text-muted-foreground font-mono align-middle">
                                {new Date(invoice.created * 1000).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="px-4 py-3 text-right align-middle">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                      onClick={() => window.open(invoice.invoicePdf, '_blank')}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Download PDF Invoice
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </FormCard>
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>
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
              This will cancel your current {currentPlan} subscription. You will retain your benefits until the end of your current billing period, after which your account will revert to the Free tier with a 2GB storage limit.
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
              We&apos;re sorry to see you go. Help us improve by telling us why you&apos;re cancelling.
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
