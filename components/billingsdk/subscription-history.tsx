"use client";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, CreditCard } from "lucide-react";

export interface SubscriptionItem {
  id: string;
  plan: string;
  status: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
  amount: string;
  interval: string;
  created: string;
  cancelAtPeriodEnd?: boolean;
}

interface SubscriptionHistoryProps {
  className?: string;
  title?: string;
  description?: string;
  subscriptions: SubscriptionItem[];
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function SubscriptionHistory({
  className,
  title = "Subscription History",
  description = "Your subscription history and status.",
  subscriptions,
}: SubscriptionHistoryProps) {
  if (!subscriptions) return null;

  const statusBadge = (status: SubscriptionItem["status"]) => {
    switch (status) {
      case "active":
        return (
          <Badge className="border-emerald-700/40 bg-emerald-600 text-emerald-50">
            Active
          </Badge>
        );
      case "canceled":
        return <Badge variant="secondary">Canceled</Badge>;
      case "past_due":
        return <Badge variant="destructive">Past Due</Badge>;
      case "trialing":
        return <Badge variant="outline">Trial</Badge>;
      case "incomplete":
        return <Badge variant="outline">Incomplete</Badge>;
    }
  };

  return (
    <Card className={cn("w-full", className)}>
      {(title || description) && (
        <CardHeader className="space-y-1">
          {title && (
            <CardTitle className="flex items-center gap-2 truncate text-base text-lg leading-tight font-medium sm:gap-3 sm:text-xl">
              <CreditCard className="text-primary h-4 w-4" />
              {title}
            </CardTitle>
          )}
          {description && (
            <CardDescription className="text-muted-foreground text-sm">
              {description}
            </CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent>
        <Table>
          <TableCaption className="sr-only">
            List of past subscriptions with plan, status, amount, and billing period
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Date</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Billing Period</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground h-24 text-center"
                >
                  No subscriptions yet
                </TableCell>
              </TableRow>
            )}
            {subscriptions.map((sub) => (
              <TableRow key={sub.id} className="group">
                <TableCell className="text-muted-foreground">
                  <div className="inline-flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {sub.created}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{sub.plan}</div>
                  {sub.cancelAtPeriodEnd && (
                    <div className="text-muted-foreground text-xs mt-1">
                      Cancels at period end
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {sub.amount}
                </TableCell>
                <TableCell className="text-right capitalize">
                  {sub.interval}
                </TableCell>
                <TableCell className="text-right">
                  {statusBadge(sub.status)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
