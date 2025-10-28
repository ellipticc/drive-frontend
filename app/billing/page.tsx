"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar"
import { SiteHeader } from "@/components/layout/header/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Crown, Zap } from "lucide-react"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"

interface PricingPlan {
  id: string
  name: string
  description: string
  price: number
  currency: string
  interval: string
  stripePriceId: string
  storageQuota: number // in bytes
  features: string[]
  popular?: boolean
}

interface Subscription {
  id: string
  status: string
  currentPeriodStart: number
  currentPeriodEnd: number
  cancelAtPeriodEnd: boolean
  plan: {
    id: string
    name: string
    storageQuota: number
  }
}

export default function BillingPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  useEffect(() => {
    document.title = "Billing - Ellipticc Drive"
    
    fetchBillingData()
  }, [])

  const fetchBillingData = async () => {
    try {
      setLoading(true)

      // Fetch pricing plans
      const plansResponse = await apiClient.getPricingPlans()
      if (plansResponse.success && plansResponse.data) {
        setPlans(plansResponse.data.plans)
      }

      // Fetch current subscription
      const subscriptionResponse = await apiClient.getSubscriptionStatus()
      if (subscriptionResponse.success && subscriptionResponse.data) {
        setSubscription(subscriptionResponse.data.subscription)
      }
    } catch (error) {
      console.error('Failed to fetch billing data:', error)
      toast.error('Failed to load billing information')
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async (priceId: string) => {
    try {
      setCheckoutLoading(priceId)

      const response = await apiClient.createCheckoutSession({
        priceId,
        successUrl: `${window.location.origin}/billing?success=true`,
        cancelUrl: `${window.location.origin}/billing?canceled=true`
      })

      if (response.success && response.data && response.data.url) {
        // Redirect to Stripe Checkout
        window.location.href = response.data.url
      } else {
        throw new Error(response.error || 'Failed to create checkout session')
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error)
      toast.error('Failed to start checkout process')
    } finally {
      setCheckoutLoading(null)
    }
  }

  const handleManageSubscription = async () => {
    try {
      const response = await apiClient.createPortalSession({
        returnUrl: `${window.location.origin}/billing`
      })

      if (response.success && response.data && response.data.url) {
        // Redirect to Stripe Customer Portal
        window.location.href = response.data.url
      } else {
        throw new Error(response.error || 'Failed to create portal session')
      }
    } catch (error) {
      console.error('Failed to create portal session:', error)
      toast.error('Failed to open billing portal')
    }
  }

  const formatPrice = (price: number, currency: string, interval: string) => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    })

    if (interval === 'year') {
      return `${formatter.format(price / 100)}/year`
    } else {
      return `${formatter.format(price / 100)}/month`
    }
  }

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader pageTitle="Billing" />
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading billing information...</p>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader pageTitle="Billing" />

        <div className="flex flex-1 flex-col gap-6 p-6">
          {/* Current Subscription Status */}
          {subscription && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="h-5 w-5 text-yellow-500" />
                      Current Plan
                    </CardTitle>
                    <CardDescription>
                      {subscription.plan.name} plan with {Math.round(subscription.plan.storageQuota / (1024 * 1024 * 1024))} GB storage
                    </CardDescription>
                  </div>
                  <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                    {subscription.status === 'active' ? 'Active' : subscription.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{subscription.plan.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {subscription.cancelAtPeriodEnd ? 'Cancels at period end' : `Renews on ${new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button onClick={handleManageSubscription} variant="outline">
                    Manage Subscription
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Free Plan */}
          <Card className={subscription ? 'opacity-60' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                Free Plan
              </CardTitle>
              <CardDescription>
                Perfect for getting started with secure file storage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-4">$0/month</div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>5 GB storage</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>End-to-end encryption</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>File sharing</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Basic support</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <div className="w-full text-center">
                {subscription ? (
                  <Badge variant="outline">Current Plan</Badge>
                ) : (
                  <Badge variant="secondary">Active</Badge>
                )}
              </div>
            </CardFooter>
          </Card>

          {/* Paid Plans */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} className="relative">
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-4">
                    {formatPrice(plan.price, plan.currency, plan.interval)}
                  </div>
                  <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{Math.round(plan.storageQuota / (1024 * 1024 * 1024))} GB storage</span>
                    </li>
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => handleSubscribe(plan.stripePriceId)}
                    disabled={checkoutLoading === plan.stripePriceId}
                  >
                    {checkoutLoading === plan.stripePriceId ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : subscription?.plan.id === plan.id ? (
                      'Current Plan'
                    ) : (
                      'Subscribe'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* FAQ or Additional Info */}
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
              <CardDescription>
                Questions about billing or need assistance?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Contact our support team for help with billing, plan changes, or any other questions.
              </p>
              <Button variant="outline" onClick={() => {
                // TODO: Implement support contact
                toast.info('Support contact coming soon')
              }}>
                Contact Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}