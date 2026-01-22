"use client";

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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { IconInfinity } from "@tabler/icons-react";

export interface UsageResource {
  name: string;
  used: number;
  limit: number;
  percentage?: number;
  unit?: string;
}

export interface DetailedUsageTableProps {
  className?: string;
  title?: string;
  description?: string;
  resources: UsageResource[];
}

export function DetailedUsageTable({
  className,
  title = "Detailed Usage",
  description,
  resources,
}: DetailedUsageTableProps) {
  const formatNumber = (num: number, decimals = 0) => {
    if (decimals > 0) {
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(num);
    }
    return new Intl.NumberFormat().format(num);
  };

  const formatResourceValue = (resource: UsageResource, isLimit = false) => {
    // Storage special handling (show GB used with 2 decimals; show TB for large limits)
    if ((resource.unit || '').toUpperCase() === 'GB') {
      if (isLimit && resource.limit >= 1024) {
        const tb = resource.limit / 1024;
        return `${Number.isInteger(tb) ? tb : tb.toFixed(2)} TB`;
      }

      const val = isLimit ? resource.limit : resource.used;
      return `${formatNumber(val, 2)} ${resource.unit}`;
    }

    // Unlimited handling
    if ((isLimit ? resource.limit : resource.limit) >= 999999) {
      return (
        <div className="inline-flex items-center gap-2 text-muted-foreground">
          <IconInfinity className="h-4 w-4" />
          <span className="text-xs">Unlimited</span>
        </div>
      );
    }

    // Default formatting (integers)
    const val = isLimit ? resource.limit : resource.used;
    return formatNumber(val);
  };

  const getPercentageBar = (percentage: number) => {
    let bgColor = "bg-emerald-500";
    if (percentage >= 90) bgColor = "bg-destructive";
    else if (percentage >= 75) bgColor = "bg-orange-500";

    return (
      <div className="flex min-w-[120px] items-center gap-2">
        <div className="bg-secondary h-2 flex-1 rounded-full">
          <div
            className={cn("h-2 rounded-full transition-all", bgColor)}
            style={{ width: `${Math.max(0, Math.min(percentage, 100))}%` }}
          />
        </div>
        <span className="w-10 text-right text-xs font-medium tabular-nums">
          {Math.round(percentage)}%
        </span>
      </div>
    );
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableCaption className="sr-only">
              Detailed usage of resources
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Resource</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead className="text-right">Limit</TableHead>
                <TableHead className="min-w-[160px] text-right">
                  Usage
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-muted-foreground h-24 text-center"
                  >
                    No resources found
                  </TableCell>
                </TableRow>
              ) : (
                resources.map((resource, index) => {
                  // For unlimited limits, treat percentage as 0 to avoid tiny fractions showing up
                  const isUnlimited = (resource.limit ?? 0) >= 999999;
                  const percentage =
                    resource.percentage ??
                    (isUnlimited ? 0 : (resource.limit > 0 ? (resource.used / resource.limit) * 100 : 0));

                  return (
                    <TableRow key={resource.name || index}>
                      <TableCell className="font-medium">
                        {resource.name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatResourceValue(resource, false)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {formatResourceValue(resource, true)}
                      </TableCell>
                      <TableCell className="text-right">
                        {getPercentageBar(percentage)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
