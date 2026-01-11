import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider
} from "@/components/ui/tooltip"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    IconMail,
    IconLock,
    IconLoader2,
    IconShieldLock,
    IconCopy,
    IconCheck as IconCheckmark,
    IconTrash,
    IconDownload,
    IconActivity,
    IconRefresh,
    IconInfoCircle,
    IconChevronLeft,
    IconChevronRight,
    IconChevronDown,
    IconChevronUp,
    IconLogout,
    IconUserCog,
    IconUserShield as ShieldUser,
    IconChartAreaLine
} from "@tabler/icons-react"
import { getUAInfo, getOSIcon, getBrowserIcon } from './device-icons'
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
// @ts-ignore
import JSONHighlighter from 'react-json-syntax-highlighter'
import dynamic from 'next/dynamic'
import { UAParser } from 'ua-parser-js'

const MapComponent = dynamic(() => import('./map-component'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted animate-pulse rounded-xl" />
})

interface SecurityTabProps {
    user: any;
    setShowEmailModal: (val: boolean) => void;
    setShowPasswordModal: (val: boolean) => void;

    // 2FA
    totpEnabled: boolean;
    isLoadingTOTP: boolean;
    setShowTOTPDisable: (val: boolean) => void;
    handleTOTPSetup: () => void;
    handleTOTPDisable: () => void;
    // 2FA Modals props
    showTOTPSetup: boolean;
    setShowTOTPSetup: (val: boolean) => void;
    totpQrCode: string;
    totpSecret: string;
    totpToken: string;
    setTotpToken: (val: string) => void;
    isVerifyingTOTP: boolean;
    handleTOTPVerify: () => void;
    // copiedCodes & handlers removed from props, managed internally
    showRecoveryCodesModal: boolean;
    setShowRecoveryCodesModal: (val: boolean) => void;
    recoveryCodes: string[];
    showTOTPDisable: boolean;
    disableToken: string;
    setDisableToken: (val: string) => void;
    disableRecoveryCode: string;
    setDisableRecoveryCode: (val: string) => void;
    isDisablingTOTP: boolean;

    // Session Duration
    sessionExpiry: string;
    setSessionExpiry: (val: string) => void;

    // Sessions
    userSessions: any[];
    isLoadingSessions: boolean;
    sessionsTotal: number;
    sessionsPage: number;
    sessionsTotalPages: number;
    loadUserSessions: (page: number) => void;
    handleRevokeSession: (id: string) => void;
    currentSessionId: string | null;
    showRevokeAllDialog: boolean;
    setShowRevokeAllDialog: (val: boolean) => void;
    handleRevokeAllSessions: () => void;

    // Devices
    userDevices: any[];
    isLoadingDevices: boolean;
    devicesTotal: number;
    devicesPage: number;
    devicesTotalPages: number;
    loadUserDevices: (page: number) => void;
    handleRevokeDevice: (id: string) => void;
    editingDeviceId: string | null;
    setEditingDeviceId: (val: string | null) => void;
    editNameValue: string;
    setEditNameValue: (val: string) => void;
    handleUpdateDeviceName: (id: string, name: string) => void;
    devicePlan: any;

    // Activity
    securityEvents: any[];
    isLoadingSecurityEvents: boolean;
    detailedEventsEnabled: boolean;
    activityMonitorEnabled: boolean;
    handleUpdateSecurityPreferences: (monitor: boolean, detailed: boolean) => void;
    showDisableMonitorDialog: boolean;
    setShowDisableMonitorDialog: (val: boolean) => void;
    handleWipeSecurityEvents: () => void;
    handleDownloadSecurityEvents: () => void;
    loadSecurityEvents: (page: number) => void;
    securityEventsTotal: number;
    securityEventsPage: number;
    securityEventsHasMore: boolean;
    setSecurityEvents: (val: any[]) => void;
    setSecurityEventsTotal: (val: number) => void;
    setSecurityEventsHasMore: (val: boolean) => void;

    // Account
    handleLogout: () => void;
    isLoggingOut: boolean;
    setShowDeleteModal: (val: boolean) => void;

    // Revoked Toggle
    showRevoked: boolean;
    setShowRevoked: (val: boolean) => void;
    // Privacy
    usageDiagnosticsEnabled: boolean;
    crashReportsEnabled: boolean;
    handleUpdatePrivacySettings: (analytics: boolean, crashReports: boolean) => void;
    userPlan: string; // Added userPlan
    isMobile: boolean; // Added isMobile
}

const JsonHighlighter = ({ data }: { data: any }) => {
    return (
        <div className="json-theme-custom rounded-xl overflow-hidden border border-muted-foreground/10 bg-muted/20">
            <JSONHighlighter
                obj={data}
                className="text-[11px] font-mono p-4"
            />
        </div>
    );
};

export function SecurityTab(props: SecurityTabProps) {
    const {
        user, setShowEmailModal, setShowPasswordModal,
        totpEnabled, isLoadingTOTP, setShowTOTPDisable, handleTOTPSetup, handleTOTPDisable,
        showTOTPSetup, setShowTOTPSetup, totpQrCode, totpSecret, totpToken, setTotpToken, isVerifyingTOTP, handleTOTPVerify,
        showRecoveryCodesModal, setShowRecoveryCodesModal, recoveryCodes,
        showTOTPDisable, disableToken, setDisableToken, disableRecoveryCode, setDisableRecoveryCode, isDisablingTOTP,
        sessionExpiry, setSessionExpiry,
        userSessions, isLoadingSessions, sessionsTotal, sessionsPage, sessionsTotalPages, loadUserSessions, handleRevokeSession, currentSessionId, showRevokeAllDialog, setShowRevokeAllDialog, handleRevokeAllSessions,
        userDevices, isLoadingDevices, devicesTotal, devicesPage, devicesTotalPages, loadUserDevices, handleRevokeDevice, editingDeviceId, setEditingDeviceId, editNameValue, setEditNameValue, handleUpdateDeviceName, devicePlan,
        securityEvents, isLoadingSecurityEvents, detailedEventsEnabled, activityMonitorEnabled, handleUpdateSecurityPreferences, showDisableMonitorDialog, setShowDisableMonitorDialog, handleWipeSecurityEvents, handleDownloadSecurityEvents, loadSecurityEvents, securityEventsTotal, securityEventsPage, securityEventsHasMore, setSecurityEvents, setSecurityEventsTotal, setSecurityEventsHasMore,
        handleLogout, isLoggingOut, setShowDeleteModal,
        showRevoked, setShowRevoked,
        usageDiagnosticsEnabled, crashReportsEnabled, handleUpdatePrivacySettings,
        userPlan, isMobile
    } = props;

    const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
    const [copiedCodes, setCopiedCodes] = useState(false);
    const [copiedSecret, setCopiedSecret] = useState(false);
    const [showWipeDialog, setShowWipeDialog] = useState(false);

    // Check plan access (Pro & Unlimited)
    const isPaid = (userPlan || 'Free').includes('Pro') || (userPlan || 'Free').includes('Unlimited');
    const hasExportAccess = isPaid;

    // Auto-scroll to device manager if requested
    React.useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hash.includes('scroll=device-manager')) {
            setTimeout(() => {
                const element = document.getElementById('device-manager-section');
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                }
            }, 500);
        }
    }, [isLoadingDevices]);

    const handleCopySecret = () => {
        if (!totpSecret) return;
        navigator.clipboard.writeText(totpSecret);
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
        toast.success('TOTP secret copied to clipboard');
    }

    const handleCopyRecoveryCodes = () => {
        navigator.clipboard.writeText(recoveryCodes.join(' '));
        setCopiedCodes(true);
        setTimeout(() => setCopiedCodes(false), 2000);
        toast.success('Recovery codes copied to clipboard');
    }

    const handleDownloadRecoveryCodes = () => {
        const codesText = recoveryCodes.join('\n')
        const blob = new Blob([codesText], { type: 'text/plain' })
        const unixTimestamp = Math.floor(Date.now() / 1000)
        const randomHex = Math.random().toString(16).slice(2, 8)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `recovery-codes-${randomHex}-${unixTimestamp}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const formatSessionDate = (dateString: string | null) => {
        if (!dateString) return '-'
        const date = new Date(dateString)
        const day = String(date.getDate()).padStart(2, '0')
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const year = date.getFullYear()
        let hours = date.getHours()
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const ampm = hours >= 12 ? 'PM' : 'AM'
        hours = hours % 12
        hours = hours ? hours : 12
        const strHours = String(hours).padStart(2, '0')
        return `${day}/${month}/${year} ${strHours}:${minutes} ${ampm}`
    }

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold">Security</h2>



            {/* Change Email Section */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <IconMail className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="font-medium">Email Address</p>
                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEmailModal(true)}
                >
                    Change
                </Button>
            </div>

            {/* Change Password Section */}
            <div className="flex items-center justify-between border-t pt-6">
                <div className="flex items-center gap-3">
                    <IconLock className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="font-medium">Password</p>
                        <p className="text-sm text-muted-foreground">••••••••</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPasswordModal(true)}
                >
                    Change
                </Button>
            </div>

            {/* TOTP Section */}
            <div className="flex items-center justify-between border-t pt-6">
                <div className="flex items-center gap-3">
                    <ShieldUser className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-muted-foreground">
                            {totpEnabled ? "Enabled" : "Add an extra layer of security"}
                        </p>
                    </div>
                </div>
                {totpEnabled ? (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowTOTPDisable(true)}
                        disabled={isLoadingTOTP}
                    >
                        {isLoadingTOTP ? (
                            <>
                                <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                                Loading...
                            </>
                        ) : (
                            "Disable"
                        )}
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTOTPSetup}
                        disabled={isLoadingTOTP}
                    >
                        {isLoadingTOTP ? (
                            <>
                                <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                                Setting up...
                            </>
                        ) : (
                            "Enable"
                        )}
                    </Button>
                )}
            </div>

            {/* Session Duration Configuration Section */}
            <div className="flex items-center justify-between border-t pt-6">
                <div className="flex items-center gap-3 flex-1">
                    <IconRefresh className="h-5 w-5 text-muted-foreground" />
                    <div className="flex flex-col gap-1">
                        <p className="font-medium">Session Duration</p>
                        <p className="text-sm text-muted-foreground">
                            How long you can stay logged in before automatic logout
                        </p>
                    </div>
                </div>
                <Select
                    value={sessionExpiry}
                    onValueChange={async (value) => {
                        setSessionExpiry(value);
                        const sessionDuration = parseInt(value);

                        // Save to localStorage for immediate frontend use
                        const sessionConfig = {
                            sessionExpiry: sessionDuration,
                            remindBeforeExpiry: 300
                        };
                        localStorage.setItem('session_config', JSON.stringify(sessionConfig));

                        // Send to backend API to persist in database
                        try {
                            const response = await apiClient.updateSessionDuration(sessionDuration);
                            if (response.success) {
                                toast.success('Session duration updated');
                            } else {
                                toast.error(response.error || 'Failed to save session duration');
                            }
                        } catch (error) {
                            console.error('Error saving session duration:', error);
                            toast.error('Failed to save session duration');
                        }
                    }}
                >
                    <SelectTrigger className="w-32">
                        <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="86400">24 hours</SelectItem>
                        <SelectItem value="604800">7 days</SelectItem>
                        <SelectItem value="1209600">14 days</SelectItem>
                        <SelectItem value="2592000">30 days</SelectItem>
                        <SelectItem value="5184000">60 days</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Show Revoked Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-dashed">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-background rounded-full border shadow-sm">
                        <IconRefresh className={`h-4 w-4 text-muted-foreground transition-transform duration-500 ${showRevoked ? 'rotate-180' : ''}`} />
                    </div>
                    <div>
                        <p className="text-sm font-medium">Show Revoked History</p>
                        <p className="text-xs text-muted-foreground">Include previously revoked sessions and devices in the lists</p>
                    </div>
                </div>
                <Switch
                    checked={showRevoked}
                    onCheckedChange={setShowRevoked}
                    aria-label="Toggle revoked history"
                />
            </div>

            {/* Session Manager Section */}
            <div className="border-t pt-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <IconShieldLock className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="font-medium">Session Manager</p>
                            <p className="text-sm text-muted-foreground">Manage your active login sessions across devices</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {sessionsTotal > 5 && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => loadUserSessions(sessionsPage - 1)}
                                    disabled={sessionsPage === 1}
                                >
                                    <IconChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    Page {sessionsPage} of {sessionsTotalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => loadUserSessions(sessionsPage + 1)}
                                    disabled={sessionsPage >= sessionsTotalPages}
                                >
                                    <IconChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        <Dialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isLoadingSessions || userSessions.filter(s => !s.isCurrent && !s.is_revoked).length === 0}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                >
                                    Revoke All
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Revoke all other sessions?</DialogTitle>
                                    <DialogDescription>
                                        This will log you out of all other devices and browsers. You will remain logged in to your current session.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="mt-4">
                                    <Button variant="outline" onClick={() => setShowRevokeAllDialog(false)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleRevokeAllSessions}
                                        className="bg-red-500 hover:bg-red-600 text-white"
                                    >
                                        Revoke All
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="border rounded-lg overflow-hidden bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Session ID</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Device / Browser</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">IP Address</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Date</th>
                                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {isLoadingSessions ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center">
                                            <IconLoader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                                        </td>
                                    </tr>
                                ) : userSessions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                            No active sessions found
                                        </td>
                                    </tr>
                                ) : (
                                    userSessions.map((session) => (
                                        <tr key={session.id} className={`hover:bg-muted/30 transition-colors ${session.is_revoked ? 'opacity-50' : ''}`}>
                                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="cursor-help underline decoration-dotted decoration-muted-foreground/30">
                                                                {session.id.substring(0, 8)}...
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top">
                                                            <p className="font-mono text-xs">{session.id}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm truncate max-w-[200px]" title={session.user_agent}>
                                                        {session.user_agent.includes('Windows') ? 'Windows' :
                                                            session.user_agent.includes('Mac') ? 'macOS' :
                                                                session.user_agent.includes('Linux') ? 'Linux' :
                                                                    session.user_agent.includes('Android') ? 'Android' :
                                                                        session.user_agent.includes('iPhone') ? 'iPhone' : 'Unknown Device'}
                                                        {session.user_agent.includes('Chrome') ? ' (Chrome)' :
                                                            session.user_agent.includes('Firefox') ? ' (Firefox)' :
                                                                session.user_agent.includes('Safari') ? ' (Safari)' :
                                                                    session.user_agent.includes('Edge') ? ' (Edge)' : ''}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                                                {session.ip_address}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                                                {formatSessionDate(session.created_at)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {(!!session.isCurrent || (currentSessionId && session.id === currentSessionId)) && (
                                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase py-1 px-2 bg-emerald-100/50 dark:bg-emerald-950/30 rounded">
                                                            Current
                                                        </span>
                                                    )}
                                                    {!!session.is_revoked && (
                                                        <span className="text-[10px] text-red-500 font-bold uppercase py-1 px-2 bg-red-100/50 dark:bg-red-950/30 rounded">
                                                            Revoked
                                                        </span>
                                                    )}
                                                    {(!session.isCurrent && (!currentSessionId || session.id !== currentSessionId) && !session.is_revoked) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleRevokeSession(session.id)}
                                                            className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                                        >
                                                            Revoke
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Device Manager Section */}
            <div id="device-manager-section" className="border-t pt-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <IconUserCog className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="font-medium">Device Manager</p>
                                {devicePlan && (
                                    <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                        {devicePlan.currentDevices}/{devicePlan.maxDevices} {devicePlan.name} Slots
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">Manage authorized devices and cryptographic identities</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {devicesTotal > 5 && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => loadUserDevices(devicesPage - 1)}
                                    disabled={devicesPage === 1}
                                >
                                    <IconChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    Page {devicesPage} of {devicesTotalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => loadUserDevices(devicesPage + 1)}
                                    disabled={devicesPage >= devicesTotalPages}
                                >
                                    <IconChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="border rounded-lg overflow-hidden bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Device ID</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Device Name</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Location / IP</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Last Active</th>
                                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {isLoadingDevices ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center">
                                            <IconLoader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                                        </td>
                                    </tr>
                                ) : userDevices.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                            No authorized devices found
                                        </td>
                                    </tr>
                                ) : (
                                    userDevices.map((device) => (
                                        <tr key={device.id} className={`hover:bg-muted/30 transition-colors ${device.is_revoked ? 'opacity-50' : ''}`}>
                                            <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="cursor-help underline decoration-dotted decoration-muted-foreground/30">
                                                                {device.id.substring(0, 8)}...
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top">
                                                            <p className="font-mono text-xs">{device.id}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </td>
                                            <td className="px-4 py-3">
                                                <TooltipProvider>
                                                    <Tooltip delayDuration={300}>
                                                        <TooltipTrigger asChild>
                                                            <div
                                                                className="flex flex-col cursor-pointer group"
                                                                onDoubleClick={() => {
                                                                    const isPro = devicePlan?.name === 'Pro' || devicePlan?.name === 'Unlimited';
                                                                    if (isPro) {
                                                                        setEditingDeviceId(device.id);
                                                                        setEditNameValue(device.device_name || 'Unknown Device');
                                                                    } else {
                                                                        toast.info("Pro Feature", {
                                                                            description: "Upgrading to a Pro plan allows you to customize your device names."
                                                                        });
                                                                    }
                                                                }}
                                                            >
                                                                {editingDeviceId === device.id ? (
                                                                    <Input
                                                                        value={editNameValue}
                                                                        onChange={(e) => setEditNameValue(e.target.value.slice(0, 30))}
                                                                        onBlur={() => {
                                                                            const dev = userDevices.find((d: any) => d.id === editingDeviceId);
                                                                            if (dev && editNameValue.trim() !== dev.device_name) {
                                                                                handleUpdateDeviceName(dev.id, editNameValue);
                                                                            } else {
                                                                                setEditingDeviceId(null);
                                                                            }
                                                                        }}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                const dev = userDevices.find((d: any) => d.id === editingDeviceId);
                                                                                if (dev && editNameValue.trim() !== dev.device_name) {
                                                                                    handleUpdateDeviceName(dev.id, editNameValue);
                                                                                } else {
                                                                                    setEditingDeviceId(null);
                                                                                }
                                                                            }
                                                                            if (e.key === 'Escape') setEditingDeviceId(null);
                                                                        }}
                                                                        className="h-7 text-xs py-0 px-2 w-full max-w-[150px]"
                                                                        autoFocus
                                                                    />
                                                                ) : (
                                                                    <span className="font-medium group-hover:text-primary transition-colors truncate max-w-[180px]" title={device.device_name}>
                                                                        {device.device_name && device.device_name.length > 25
                                                                            ? `${device.device_name.substring(0, 25)}...`
                                                                            : (device.device_name || 'Unknown Device')}
                                                                    </span>
                                                                )}
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger className="flex items-center cursor-help">
                                                                                {getOSIcon(device.os)}
                                                                            </TooltipTrigger>
                                                                            <TooltipContent side="top"><p className="text-xs">{device.os || 'Unknown OS'}</p></TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger className="flex items-center cursor-help">
                                                                                {getBrowserIcon(device.browser)}
                                                                            </TooltipTrigger>
                                                                            <TooltipContent side="top"><p className="text-xs">{device.browser || 'Unknown Browser'}</p></TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                </div>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="max-w-[200px] text-center">
                                                            {(devicePlan?.name === 'Pro' || devicePlan?.name === 'Unlimited') ? (
                                                                <p className="text-xs">Double-click to rename device</p>
                                                            ) : (
                                                                <div className="space-y-1">
                                                                    <p className="text-xs font-bold">Pro Feature</p>
                                                                    <p className="text-[10px]">Upgrade to a Pro plan to customize your device names.</p>
                                                                </div>
                                                            )}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="text-xs">{device.location || 'Unknown'}</span>
                                                    <span className="text-[10px] font-mono text-muted-foreground">
                                                        {detailedEventsEnabled ? device.ip_address : '••••••••••••'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                                                {formatSessionDate(device.last_active)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {!!device.is_current && (
                                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase py-1 px-2 bg-emerald-100/50 dark:bg-emerald-950/30 rounded">
                                                            Current
                                                        </span>
                                                    )}
                                                    {!!device.is_revoked && (
                                                        <span className="text-[10px] text-red-500 font-bold uppercase py-1 px-2 bg-red-100/50 dark:bg-red-950/30 rounded">
                                                            Revoked
                                                        </span>
                                                    )}
                                                    {(!device.is_current && !device.is_revoked) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleRevokeDevice(device.id)}
                                                            className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                                        >
                                                            Revoke
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Activity Monitor Section */}
            <div className="border-t pt-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <IconActivity className="h-5 w-5 text-muted-foreground" />
                            <h3 className="text-lg font-semibold">Activity Monitor</h3>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm text-muted-foreground">Review security-related activity on your account</p>
                            <TooltipProvider>
                                <Tooltip delayDuration={0}>
                                    <TooltipTrigger asChild>
                                        <IconInfoCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        <p className="text-xs">
                                            {(() => {
                                                const planName = devicePlan?.name || 'Free';
                                                if (planName.includes('Unlimited')) return "Events are never automatically deleted";
                                                if (planName.includes('Pro')) return "Events are automatically deleted after 60 days";
                                                if (planName.includes('Plus')) return "Events are automatically deleted after 30 days";
                                                return "Events are automatically deleted after 7 days";
                                            })()}
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => loadSecurityEvents(1)}
                                        disabled={isLoadingSecurityEvents}
                                        className="h-8 w-8 p-0"
                                    >
                                        <IconRefresh className={`h-4 w-4 ${isLoadingSecurityEvents ? 'animate-spin' : ''}`} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Refresh Events</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowWipeDialog(true)}
                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                    >
                                        <IconTrash className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Clear History</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="inline-block">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleDownloadSecurityEvents}
                                            disabled={!hasExportAccess}
                                            className={`h-8 w-8 p-0 ${!hasExportAccess ? 'opacity-50' : ''}`}
                                        >
                                            <IconDownload className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {hasExportAccess ? "Export CSV" : "Export available on Pro & Unlimited plans"}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>

                <div className="flex flex-col gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <Switch
                            id="activity-monitor-toggle"
                            checked={activityMonitorEnabled}
                            onCheckedChange={(checked) => {
                                if (!checked) {
                                    setShowDisableMonitorDialog(true)
                                } else {
                                    handleUpdateSecurityPreferences(true, detailedEventsEnabled)
                                }
                            }}
                        />
                        <div className="flex items-center gap-1.5">
                            <Label className="text-sm font-medium">Activity monitor</Label>
                            <TooltipProvider>
                                <Tooltip delayDuration={0}>
                                    <TooltipTrigger>
                                        <IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-[10px]">Master switch for all security logging. Disabling this completely stops all event tracking.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>

                    {activityMonitorEnabled && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                            <Switch
                                id="detailed-events-toggle"
                                checked={detailedEventsEnabled}
                                onCheckedChange={(checked) => handleUpdateSecurityPreferences(activityMonitorEnabled, checked)}
                            />
                            <div className="flex items-center gap-1.5">
                                <Label className="text-sm font-medium">Ellipticc Vigil</Label>
                                <TooltipProvider>
                                    <Tooltip delayDuration={0}>
                                        <TooltipTrigger>
                                            <IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-[280px]">
                                            <p className="text-[10px]">
                                                Our advanced threat monitoring system. Enabling this allows tracking of detailed device info, IP addresses, and location maps for security analysis.
                                                <br /><br />
                                                Untoggle this to stop tracking detailed metadata (you will still see basic security events).
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border rounded-lg overflow-hidden bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs tracking-wider">Event ID</th>
                                    <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs tracking-wider">Event</th>
                                    <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs tracking-wider">Location / IP</th>
                                    <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs tracking-wider">Status</th>
                                    <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs tracking-wider">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {isLoadingSecurityEvents && securityEvents.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                            <IconLoader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                            Loading security events...
                                        </td>
                                    </tr>
                                ) : securityEvents.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                            No security events recorded yet.
                                        </td>
                                    </tr>
                                ) : (
                                    securityEvents.map((event: any) => {
                                        const isExpanded = expandedEventId === event.id;
                                        const { osIcon, osName, browserIcon, browserName } = getUAInfo(event.userAgent);

                                        const PaidField = ({ label, value, tooltip = "Available on Pro and Unlimited" }: { label: string, value: string | React.ReactNode, tooltip?: string }) => (
                                            <div className="flex justify-between items-center py-2 border-b border-muted last:border-0">
                                                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                                                <TooltipProvider>
                                                    <Tooltip delayDuration={0}>
                                                        <TooltipTrigger asChild>
                                                            <span className={`text-xs font-mono transition-all ${!isPaid ? 'blur-[3.5px] select-none cursor-help' : ''}`}>
                                                                {isPaid ? (value || 'N/A') : '••••••••••••'}
                                                            </span>
                                                        </TooltipTrigger>
                                                        {!isPaid && <TooltipContent side="top">{tooltip}</TooltipContent>}
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                        );

                                        return (
                                            <React.Fragment key={event.id}>
                                                <tr
                                                    className="hover:bg-muted/30 transition-colors cursor-pointer group"
                                                    onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                                                >
                                                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                                        <div className="flex items-center gap-2">
                                                            {isExpanded ? <IconChevronUp className="h-3 w-3" /> : <IconChevronDown className="h-3 w-3" />}
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className="cursor-help underline decoration-dotted decoration-muted-foreground/30">
                                                                            {event.id.substring(0, 8)}...
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top">
                                                                        <p className="font-mono text-xs">{event.id}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-sm capitalize">
                                                                {event.eventType.replace(/_/g, ' ')}
                                                            </span>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <TooltipProvider>
                                                                    <Tooltip delayDuration={0}>
                                                                        <TooltipTrigger className={`flex items-center ${!isPaid ? 'blur-[3px] scale-95' : ''}`}>
                                                                            {osIcon}
                                                                        </TooltipTrigger>
                                                                        <TooltipContent side="top">
                                                                            <p className="text-xs">{isPaid ? osName : "Upgrade for device details"}</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                                <TooltipProvider>
                                                                    <Tooltip delayDuration={0}>
                                                                        <TooltipTrigger className={`flex items-center ${!isPaid ? 'blur-[3px] scale-95' : ''}`}>
                                                                            {browserIcon}
                                                                        </TooltipTrigger>
                                                                        <TooltipContent side="top">
                                                                            <p className="text-xs">{isPaid ? browserName : "Upgrade for browser details"}</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-mono whitespace-nowrap">
                                                                {detailedEventsEnabled ? event.ipAddress : '••••••••••••'}
                                                            </span>
                                                            {!isPaid && (
                                                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Location Restricted</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`text-xs font-bold uppercase py-0.5 px-1.5 rounded ${event.status === 'success'
                                                            ? 'text-emerald-600 bg-emerald-100/50 dark:bg-emerald-950/30'
                                                            : 'text-red-500 bg-red-100/50 dark:bg-red-950/30'
                                                            }`}>
                                                            {event.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                                                        {formatSessionDate(event.createdAt)}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-muted/10 border-b">
                                                        <td colSpan={5} className="px-8 py-6">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                                <div className="space-y-4">
                                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Network & Location</h4>
                                                                    <div className="bg-background/50 rounded-xl p-4 border border-muted/50">
                                                                        <PaidField label="Detailed Location" value={event.city ? `${event.city}, ${event.region}, ${event.country}` : 'N/A'} />
                                                                        <PaidField label="ASN / ISP" value={event.asn ? `${event.asn} (${event.isp})` : 'N/A'} />
                                                                        <PaidField label="IP Type" value={event.ipType} />
                                                                        <PaidField label="Proxy / VPN / Tor" value={(event.isVpn || event.isProxy || event.isTor) ? (
                                                                            <span className="text-red-500 font-bold uppercase text-[10px]">
                                                                                {[event.isVpn && 'VPN', event.isProxy && 'Proxy', event.isTor && 'Tor'].filter(Boolean).join(' + ')}
                                                                            </span>
                                                                        ) : 'None Detected'} />
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-4">
                                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Session & Risk Analytics</h4>
                                                                    <div className="bg-background/50 rounded-xl p-4 border border-muted/50">
                                                                        <PaidField label="Session Type" value={event.sessionType} />
                                                                        <PaidField label="Token Type" value={event.tokenType} />
                                                                        <PaidField
                                                                            label="Risk Level"
                                                                            value={
                                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${event.riskLevel === 'low' ? 'text-emerald-500 bg-emerald-500/10' :
                                                                                    event.riskLevel === 'medium' ? 'text-orange-500 bg-orange-500/10' :
                                                                                        'text-red-500 bg-red-500/10'
                                                                                    }`}>
                                                                                    {event.riskLevel || 'Low'}
                                                                                </span>
                                                                            }
                                                                        />
                                                                        <div className="flex flex-col gap-2 pt-2">
                                                                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Risk Signals</span>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {isPaid ? (
                                                                                    (event.riskSignals && event.riskSignals.length > 0) ? (
                                                                                        event.riskSignals.map((sig: string, idx: number) => (
                                                                                            <span key={idx} className="px-1.5 py-0.5 rounded bg-muted text-[10px] border border-muted-foreground/20">
                                                                                                {sig}
                                                                                            </span>
                                                                                        ))
                                                                                    ) : <span className="text-[10px] text-muted-foreground italic">No anomalies detected</span>
                                                                                ) : (
                                                                                    <span className="blur-sm text-[10px]">•••••••••••• ••••••••</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 items-stretch">
                                                                <div className="space-y-4 flex flex-col">
                                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Device Information</h4>
                                                                    <div className="bg-background/50 rounded-xl p-4 border border-muted/50 flex-1 flex flex-col justify-center">
                                                                        {(() => {
                                                                            const parser = new UAParser(event.userAgent);
                                                                            const uaResult = parser.getResult();
                                                                            return (
                                                                                <>
                                                                                    <PaidField label="Browser Name" value={uaResult.browser.name} />
                                                                                    <PaidField label="Browser Version" value={uaResult.browser.version} />
                                                                                    <PaidField label="Engine" value={`${uaResult.engine.name || 'N/A'} ${uaResult.engine.version || ''}`} />
                                                                                    <PaidField label="OS Name" value={uaResult.os.name} />
                                                                                    <PaidField label="OS Version" value={uaResult.os.version} />
                                                                                    <PaidField label="Device Vendor" value={uaResult.device.vendor} />
                                                                                    <PaidField label="Device Model" value={uaResult.device.model} />
                                                                                    <PaidField label="Device Type" value={uaResult.device.type || 'Desktop'} />
                                                                                    <PaidField label="CPU Architecture" value={uaResult.cpu.architecture} />
                                                                                </>
                                                                            )
                                                                        })()}
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-4 flex flex-col">
                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Location Map</h4>
                                                                        {!isPaid && <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Pro Feature</span>}
                                                                    </div>
                                                                    <div className={`bg-background/50 rounded-xl overflow-hidden border border-muted/50 h-[400px] relative ${!isPaid ? 'pointer-events-none' : ''}`}>
                                                                        <div className={`h-full w-full transition-all duration-500 ${!isPaid ? 'blur-[6px] scale-105' : ''}`}>
                                                                            <MapComponent
                                                                                lat={event.latitude || 0}
                                                                                lng={event.longitude || 0}
                                                                                popupText={`${event.city || 'Unknown'}, ${event.country || ''}`}
                                                                            />
                                                                        </div>
                                                                        {!isPaid && (
                                                                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                                                                <div className="bg-background/80 backdrop-blur-sm p-4 rounded-xl border shadow-lg max-w-[240px] text-center">
                                                                                    <IconLock className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                                                                                    <p className="font-semibold text-sm mb-1">Detailed Map View</p>
                                                                                    <p className="text-xs text-muted-foreground">Upgrade to Pro to view exact location maps for every security event.</p>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="mt-8 space-y-4">
                                                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                                    Additional Metadata
                                                                    {!isPaid && <span className="bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded-full border border-primary/20">Pro Feature</span>}
                                                                </h4>
                                                                <div className={`transition-all ${!isPaid ? 'blur-[5px] select-none pointer-events-none' : ''}`}>
                                                                    <JsonHighlighter data={event.additionalData} />
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                {securityEventsTotal > 10 && (
                    <div className="flex items-center justify-between mt-4">
                        <p className="text-xs text-muted-foreground">
                            Showing {securityEvents.length} of {securityEventsTotal} events
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => loadSecurityEvents(securityEventsPage - 1)}
                                disabled={securityEventsPage === 1 || isLoadingSecurityEvents}
                            >
                                <IconChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
                                Page {securityEventsPage}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => loadSecurityEvents(securityEventsPage + 1)}
                                disabled={!securityEventsHasMore || isLoadingSecurityEvents}
                            >
                                <IconChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>



            <Dialog open={showDisableMonitorDialog} onOpenChange={setShowDisableMonitorDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Disable Activity Monitoring?</DialogTitle>
                        <DialogDescription>
                            Disabling the security activity monitor will stop logging new events.
                            You will no longer be able to review security history through the dashboard.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDisableMonitorDialog(false)}>Cancel</Button>
                        <Button
                            onClick={() => {
                                handleUpdateSecurityPreferences(false, detailedEventsEnabled)
                                setSecurityEvents([])
                                setSecurityEventsTotal(0)
                                setSecurityEventsHasMore(false)
                                setShowDisableMonitorDialog(false)
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white"
                        >
                            Disable Monitor
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showWipeDialog} onOpenChange={setShowWipeDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Clear Activity Log?</DialogTitle>
                        <DialogDescription>
                            This will permanently remove all recorded security events from your account history. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowWipeDialog(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                handleWipeSecurityEvents()
                                setShowWipeDialog(false)
                            }}
                        >
                            Clear History
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Privacy Section */}
            <div className="border-t pt-6 space-y-4">
                <div className="flex items-center gap-2">
                    <IconChartAreaLine className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Privacy and data collection</h3>
                </div>

                <p className="text-sm text-muted-foreground">
                    To continuously improve our services, we sometimes collect data to monitor the proper functioning of our applications. This information is not shared with any 3rd-party services.
                </p>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-transparent hover:border-border transition-all">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <Label className="text-sm font-semibold">
                                    Collect usage diagnostics
                                </Label>
                                <TooltipProvider>
                                    <Tooltip delayDuration={0}>
                                        <TooltipTrigger asChild>
                                            <IconInfoCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>This setting controls Google Analytics</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Allow collection of anonymous usage data
                            </p>
                        </div>
                        <Switch
                            id="usage-diagnostics"
                            checked={usageDiagnosticsEnabled}
                            onCheckedChange={(checked) => handleUpdatePrivacySettings(checked, crashReportsEnabled)}
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-transparent hover:border-border transition-all">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <Label className="text-sm font-semibold">
                                    Send crash reports
                                </Label>
                                <TooltipProvider>
                                    <Tooltip delayDuration={0}>
                                        <TooltipTrigger asChild>
                                            <IconInfoCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>This setting controls Sentry Error Logging</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Automatically send error reports to help fix issues
                            </p>
                        </div>
                        <Switch
                            id="crash-reports"
                            checked={crashReportsEnabled}
                            onCheckedChange={(checked) => handleUpdatePrivacySettings(usageDiagnosticsEnabled, checked)}
                        />
                    </div>
                </div>
            </div>


            {/* Account Actions Section */}
            <div className="border-t pt-6 space-y-4">
                <h3 className="text-lg font-semibold">Account Actions</h3>
                <div className="space-y-3">
                    <Button
                        variant="outline"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full"
                    >
                        {isLoggingOut ? (
                            <>
                                <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                                Logging out...
                            </>
                        ) : (
                            <>
                                <IconLogout className="h-4 w-4 mr-2" />
                                Log Out
                            </>
                        )}
                    </Button>

                    <Button
                        variant="destructive"
                        onClick={() => setShowDeleteModal(true)}
                        className="w-full"
                    >
                        <IconTrash className="h-4 w-4 mr-2" />
                        Delete Account
                    </Button>
                </div>
            </div>

            {/* TOTP Modals - Setup */}
            <Dialog open={showTOTPSetup} onOpenChange={setShowTOTPSetup}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Set up 2-Factor Authentication</DialogTitle>
                        <DialogDescription>Scan the QR code with your authenticator app.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-4 py-4">
                        {totpQrCode && (
                            <div className="bg-white p-2 rounded-lg relative group">
                                <img
                                    src={totpQrCode}
                                    alt="TOTP QR Code"
                                    className="w-48 h-48 select-none"
                                    draggable="false"
                                    onDragStart={(e) => e.preventDefault()}
                                />
                                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none" />
                            </div>
                        )}
                        <div className="w-full">
                            <Label>Or enter code manually</Label>
                            <div className="flex items-center gap-2 mt-1">
                                <code className="flex-1 bg-muted p-2 rounded text-xs font-mono select-all">{totpSecret}</code>
                                <TooltipProvider>
                                    <Tooltip open={copiedSecret}>
                                        <TooltipTrigger asChild>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleCopySecret}
                                                className="shrink-0"
                                            >
                                                {copiedSecret ? <IconCheckmark className="h-4 w-4 text-emerald-500" /> : <IconCopy className="h-4 w-4" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Copied!</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                        <div className="w-full space-y-2">
                            <Label>Verify Code</Label>
                            <Input value={totpToken} onChange={(e) => setTotpToken(e.target.value)} placeholder="Enter 6-digit code" maxLength={6} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTOTPSetup(false)}>Cancel</Button>
                        <Button onClick={handleTOTPVerify} disabled={isVerifyingTOTP || totpToken.length !== 6}>
                            {isVerifyingTOTP && <IconLoader2 className="h-4 w-4 animate-spin mr-2" />}Verify & Enable
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Recovery Codes Modal */}
            <Dialog open={showRecoveryCodesModal} onOpenChange={setShowRecoveryCodesModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Recovery Codes</DialogTitle>
                        <DialogDescription>Save these codes in a secure place. You can use them to access your account if you lose your authenticator device.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-2 py-4">
                        {recoveryCodes.map((code, i) => (
                            <code key={i} className="bg-muted p-2 rounded text-center font-mono text-sm">{code}</code>
                        ))}
                    </div>
                    <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-4">
                        <div className="flex flex-1 gap-2">
                            <Button variant="outline" className="flex-1" onClick={handleDownloadRecoveryCodes}>
                                <IconDownload className="h-4 w-4 mr-2" />
                                Download
                            </Button>
                            <Button variant="outline" className="flex-1" onClick={handleCopyRecoveryCodes}>
                                {copiedCodes ? <IconCheckmark className="h-4 w-4 mr-2" /> : <IconCopy className="h-4 w-4 mr-2" />}
                                {copiedCodes ? 'Copied' : 'Copy'}
                            </Button>
                        </div>
                        <Button className="w-full sm:w-auto px-8" onClick={() => setShowRecoveryCodesModal(false)}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Disable TOTP Modal */}
            <Dialog open={showTOTPDisable} onOpenChange={setShowTOTPDisable}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Disable 2-Factor Authentication</DialogTitle>
                        <DialogDescription>Enter a TOTP code or recovery code to disable 2FA.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>TOTP Code</Label>
                            <Input value={disableToken} onChange={(e) => setDisableToken(e.target.value)} placeholder="000000" maxLength={6} />
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
                        </div>
                        <div className="space-y-2">
                            <Label>Recovery Code</Label>
                            <Input value={disableRecoveryCode} onChange={(e) => setDisableRecoveryCode(e.target.value)} placeholder="Enter 8-character recovery code" maxLength={8} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTOTPDisable(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleTOTPDisable} disabled={isDisablingTOTP}>
                            {isDisablingTOTP && <IconLoader2 className="h-4 w-4 animate-spin mr-2" />}Disable 2FA
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    )
}
