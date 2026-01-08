import React from 'react'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
    IconLoader2,
    IconGift,
    IconCopy,
    IconCheck as IconCheckmark,
    IconChevronLeft,
    IconChevronRight,
} from "@tabler/icons-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getDiceBearAvatar } from "@/lib/avatar"
import { getInitials } from "@/components/layout/navigation/nav-user"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

const formatStorageSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMins = Math.floor(diffMs / (1000 * 60))

    if (diffDays > 0) return `${diffDays}d ago`
    if (diffHours > 0) return `${diffHours}h ago`
    if (diffMins > 0) return `${diffMins}m ago`
    return 'just now'
}

// Helper for email display
const getDisplayNameFromEmail = (email: string) => {
    if (!email) return 'Unknown User'
    return email.split('@')[0]
}

interface ReferralsTabProps {
    isLoadingReferrals: boolean;
    referralCode: string;
    referralLink: string;
    handleCopyReferralCode: () => void;
    handleCopyReferralLink: () => void;
    copiedCode: boolean;
    copiedLink: boolean;
    referralsPage: number;
    referralsTotal: number;
    loadReferralData: (page: number) => void;
    recentReferrals: any[];
    referralStats: any;
}

export function ReferralsTab({
    isLoadingReferrals,
    referralCode,
    referralLink,
    handleCopyReferralCode,
    handleCopyReferralLink,
    copiedCode,
    copiedLink,
    referralsPage,
    referralsTotal,
    loadReferralData,
    recentReferrals,
    referralStats
}: ReferralsTabProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold">Referral Program</h2>

            {/* Referral Info Banner */}
            <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-start gap-3">
                    <IconGift className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-medium text-green-900 dark:text-green-100">Earn Free Storage</h3>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                            Invite friends and get 500MB of storage for each friend who signs up, verifies their email, and uploads a file. Maximum 10GB bonus (20 referrals).
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-4 space-y-4">
                {/* Referral Code Section */}
                {isLoadingReferrals ? (
                    <div className="flex justify-center py-6">
                        <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        <div className="space-y-4">
                            <Label className="text-sm font-medium">Your Referral Code</Label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 p-3 bg-muted rounded font-mono text-sm border border-border">
                                    {referralCode}
                                </code>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCopyReferralCode}
                                    className="px-3"
                                >
                                    {copiedCode ? (
                                        <IconCheckmark className="h-4 w-4" />
                                    ) : (
                                        <IconCopy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Referral Link Section */}
                        <div className="space-y-4">
                            <Label className="text-sm font-medium">Your Referral Link</Label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={referralLink}
                                    readOnly
                                    className="flex-1 p-2 text-sm bg-muted rounded border border-border text-muted-foreground truncate"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCopyReferralLink}
                                    className="px-3"
                                >
                                    {copiedLink ? (
                                        <IconCheckmark className="h-4 w-4" />
                                    ) : (
                                        <IconCopy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Recent Referrals Table */}
                        {recentReferrals && recentReferrals.length > 0 && (
                            <div className="border-t pt-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold">Referral History ({formatStorageSize((referralStats?.totalEarningsMB || 0) * 1024 * 1024)} of 10GB free space earned)</h3>
                                    {referralsTotal > 5 && (
                                        <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/40 rounded-full border border-border/50 shadow-sm transition-all hover:bg-muted/60">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 rounded-full hover:bg-background shadow-xs transition-transform active:scale-95"
                                                onClick={() => loadReferralData(referralsPage - 1)}
                                                disabled={referralsPage === 1}
                                            >
                                                <IconChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <div className="flex items-center gap-1 min-w-[3rem] justify-center">
                                                <span className="text-[11px] font-bold text-foreground tabular-nums">{referralsPage}</span>
                                                <span className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-tight">/</span>
                                                <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{Math.ceil(referralsTotal / 5)}</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 rounded-full hover:bg-background shadow-xs transition-transform active:scale-95"
                                                onClick={() => loadReferralData(referralsPage + 1)}
                                                disabled={referralsPage >= Math.ceil(referralsTotal / 5)}
                                            >
                                                <IconChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm font-mono">
                                        <thead className="bg-muted/50 border-b">
                                            <tr>
                                                <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[100px] text-xs tracking-wider">Referral ID</th>
                                                <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[160px] text-xs tracking-wider">User</th>
                                                <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[160px] hidden sm:table-cell text-xs tracking-wider">Email</th>
                                                <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px] text-xs tracking-wider">Status</th>
                                                <th className="text-center px-4 py-3 font-medium text-muted-foreground min-w-[120px] hidden xs:table-cell text-xs tracking-wider">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {recentReferrals.map((referral) => (
                                                <tr key={referral.referral_id || referral.referred_user_id} className="hover:bg-muted/30 transition-colors">
                                                    <td className="px-4 py-3 min-w-[100px]">
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className="cursor-help underline decoration-dotted decoration-muted-foreground/30 font-mono text-[10px] text-muted-foreground/60">
                                                                        {referral.referral_id ? `${referral.referral_id.substring(0, 8)}...` : 'N/A'}
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top">
                                                                    <p className="font-mono text-xs">{referral.referral_id || 'No ID available'}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </td>
                                                    <td className="px-4 py-3 min-w-[160px]">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-8 w-8 flex-shrink-0">
                                                                <AvatarImage
                                                                    src={referral.avatar_url || getDiceBearAvatar(referral.referred_user_id, 32)}
                                                                    alt={`${referral.referred_name || getDisplayNameFromEmail(referral.referred_email)}'s avatar`}
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
                                                                    }}
                                                                />
                                                                <AvatarFallback className="text-xs">
                                                                    {getInitials(referral.referred_name || getDisplayNameFromEmail(referral.referred_email))}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <p className="font-medium text-sm truncate">{referral.referred_name || getDisplayNameFromEmail(referral.referred_email)}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 min-w-[160px] hidden sm:table-cell">
                                                        <p className="text-xs text-muted-foreground truncate">{referral.referred_email}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-center min-w-[120px]">
                                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${referral.status === 'completed'
                                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                            : referral.status === 'pending'
                                                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                                : 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400'
                                                            }`}>
                                                            {referral.status === 'completed' ? '✓ Completed' : referral.status === 'pending' ? '○ Pending' : 'Cancelled'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center min-w-[120px] hidden xs:table-cell">
                                                        <p className="text-xs text-muted-foreground">
                                                            {referral.status === 'completed' && referral.completed_at
                                                                ? formatTimeAgo(referral.completed_at)
                                                                : formatTimeAgo(referral.created_at)}
                                                        </p>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Empty Referrals State */}
                        {recentReferrals.length === 0 && !isLoadingReferrals && (
                            <div className="border-t pt-6">
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    No referrals yet. Share your referral link to get started!
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
