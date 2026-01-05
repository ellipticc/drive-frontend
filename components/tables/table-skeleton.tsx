import React from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCard } from "@/components/application/table/table";

interface TableSkeletonProps {
    title: React.ReactNode;
    headerIcons?: React.ReactNode;
    className?: string; // for custom header styling
}

export const TableSkeleton = ({ title, headerIcons, className }: TableSkeletonProps) => {
    return (
        <TableCard.Root size="sm">
            <TableCard.Header
                title={title}
                contentTrailing={headerIcons}
                className={`h-10 border-0 ${className || ''}`}
            />
            <div className="flex items-center justify-center py-8">
                <div className="text-center space-y-4">
                    <IconLoader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                    <div className="space-y-2 max-w-md mx-auto">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Skeleton className="h-4 w-4 rounded" />
                                <Skeleton className="h-4 flex-1" />
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-12" />
                                <Skeleton className="h-4 w-20" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </TableCard.Root>
    );
};
