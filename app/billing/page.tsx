'use client';

import NumberFlow from '@number-flow/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowRight, BadgeCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface TransformedPlan {
  id: string;
  name: string;
  price: {
    monthly: number | string;
    yearly: number | string;
  };
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
  stripePriceIds: {
    monthly: string;
    yearly: string;
  };
}

// Static pricing plans - will not change
const staticPlans: TransformedPlan[] = [
  {
    id: 'plus',
    name: 'Plus',
    price: {
      monthly: 8.99,
      yearly: 83.89,
    },
    description: 'Perfect for getting started',
    features: [
      '500 GB Storage',
      'End-to-End Encryption',
      'File Preview',
      'File Sharing',
      'Email Support',
    ],
    cta: 'Subscribe Now',
    stripePriceIds: {
      monthly: 'price_1SMxROKvH1nJPb5H75KlOnJu',
      yearly: 'price_1SMxSZKvH1nJPb5H9KA9xwPP',
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: {
      monthly: 13.99,
      yearly: 131.89,
    },
    description: 'Ideal for small teams.',
    features: [
      '1 TB Storage',
      'End-to-End Encryption',
      'File Preview',
      'File Sharing',
      'Priority Email Support',
      'Advanced Analytics',
    ],
    cta: 'Subscribe Now',
    popular: true,
    stripePriceIds: {
      monthly: 'price_1SMxUfKvH1nJPb5HwlIETqMq',
      yearly: 'price_1SMxVVKvH1nJPb5HYL17MYFr',
    },
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    price: {
      monthly: 19.99,
      yearly: 203.89,
    },
    description: 'For power users and enterprises.',
    features: [
      '2 TB Storage',
      'End-to-End Encryption',
      'File Preview',
      'File Sharing',
      '24/7 Priority Support',
      'Advanced Analytics',
      'Custom Integrations',
    ],
    cta: 'Subscribe Now',
    stripePriceIds: {
      monthly: 'price_1SMxW8KvH1nJPb5HimvRSCLS',
      yearly: 'price_1SMxXEKvH1nJPb5HFzDxPu6R',
    },
  },
];

const PricingPage = () => {
  const router = useRouter();
  const [frequency, setFrequency] = useState<string>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Handle success/cancel redirects from Stripe
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription created successfully! 🎉 Check your email for confirmation.');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (searchParams.get('canceled') === 'true') {
      toast.error('Payment canceled. Your plan remains unchanged.');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSubscribe = async (planId: string) => {
    try {
      setCheckoutLoading(planId);
      
      // Find the selected plan
      const plan = staticPlans.find((p: TransformedPlan) => p.id === planId);

      if (!plan) {
        toast.error('Invalid plan selected');
        console.error('Plan not found:', planId);
        return;
      }

      // Get the correct Stripe price ID based on frequency
      const stripePriceId = plan.stripePriceIds[frequency as keyof typeof plan.stripePriceIds];

      if (!stripePriceId) {
        toast.error('Invalid plan selected');
        console.error('Stripe price ID not found for:', { planId, frequency });
        return;
      }

      // Log the checkout request for debugging
      console.log('Creating checkout session for plan:', {
        planId: plan.id,
        planName: plan.name,
        frequency,
        stripePriceId,
      });

      // Call backend to create Stripe checkout session
      const response = await apiClient.createCheckoutSession({
        priceId: stripePriceId,
        successUrl: `${window.location.origin}/billing?success=true`,
        cancelUrl: `${window.location.origin}/billing?canceled=true`,
      });

      // Handle successful response
      if (response.success && response.data?.url) {
        console.log('Checkout session created, redirecting to Stripe');
        // Redirect to Stripe checkout page
        window.location.href = response.data.url;
      } else {
        const errorMsg = response.error || 'Failed to create checkout session';
        console.error('Checkout session creation failed:', {
          success: response.success,
          error: response.error,
          data: response.data,
        });
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        toast.error(`Error: ${error.message}`);
      } else {
        toast.error('Failed to process checkout. Please try again.');
      }
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">Loading pricing plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/')}
          className="flex items-center gap-2 hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <ThemeToggle />
      </div>

      {/* Pricing Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="not-prose flex flex-col gap-16 px-8 py-24 text-center w-full">
          <div className="flex flex-col items-center justify-center gap-8">
            <h1 className="mb-0 text-balance font-medium text-5xl tracking-tighter!">
              Simple, transparent pricing
            </h1>
            <p className="mx-auto mt-0 mb-0 max-w-2xl text-balance text-lg text-muted-foreground">
              Upgrade your plan to unlock more features and storage.
            </p>
            <Tabs defaultValue={frequency} onValueChange={setFrequency}>
              <TabsList>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="yearly">
                  Yearly
                  <Badge variant="secondary">20% off</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="mt-8 grid w-full max-w-4xl gap-4 lg:grid-cols-3">
              {staticPlans.map((plan: TransformedPlan) => (
                <Card
                  className={cn(
                    'relative w-full text-left',
                    plan.popular && 'ring-2 ring-primary'
                  )}
                  key={plan.id}
                >
                  {plan.popular && (
                    <Badge className="-translate-x-1/2 -translate-y-1/2 absolute top-0 left-1/2 rounded-full">
                      Popular
                    </Badge>
                  )}
                  <CardHeader>
                    <CardTitle className="font-medium text-xl">
                      {plan.name}
                    </CardTitle>
                    <CardDescription>
                      <p>{plan.description}</p>
                      {typeof plan.price[frequency as keyof typeof plan.price] ===
                      'number' ? (
                        <NumberFlow
                          className="font-medium text-foreground"
                          format={{
                            style: 'currency',
                            currency: 'USD',
                            maximumFractionDigits: 0,
                          }}
                          suffix={`/${frequency === 'yearly' ? 'year' : 'month'}, billed ${frequency}.`}
                          value={
                            plan.price[
                              frequency as keyof typeof plan.price
                            ] as number
                          }
                        />
                      ) : (
                        <span className="font-medium text-foreground">
                          {plan.price[frequency as keyof typeof plan.price]}.
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    {plan.features.map((feature: string, index: number) => (
                      <div
                        className="flex items-center gap-2 text-muted-foreground text-sm"
                        key={index}
                      >
                        <BadgeCheck className="h-4 w-4" />
                        {feature}
                      </div>
                    ))}
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={plan.popular ? 'default' : 'secondary'}
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={checkoutLoading === plan.id}
                    >
                      {checkoutLoading === plan.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          {plan.cta}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-muted/30 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
            <Link
              href="/privacy-policy"
              className="hover:text-foreground transition-colors underline underline-offset-4"
            >
              Privacy Policy
            </Link>
            <span className="hidden sm:inline">•</span>
            <Link
              href="/terms-of-service"
              className="hover:text-foreground transition-colors underline underline-offset-4"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
