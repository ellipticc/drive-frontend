import { useFormatter } from "@/hooks/use-formatter";
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
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { PasswordInput } from "@/components/ui/password-input"
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
    IconChartAreaLine,
    IconKey,
    IconRotate,
    IconAlertCircle,
    IconEye,
    IconEyeOff,
    IconFingerprint,
    IconCalendar as CalendarIcon,
    IconX as IconClose
} from "@tabler/icons-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { DateRange } from "react-day-picker"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { getUAInfo, getOSIcon, getBrowserIcon } from './device-icons'
import { apiClient } from "@/lib/api"
import { masterKeyManager } from "@/lib/master-key"
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import OPAQUE, { OPAQUELogin, OPAQUERegistration } from "@/lib/opaque"
import { deriveEncryptionKey, encryptData, generateKeyDerivationSalt } from "@/lib/crypto"
import type { UserData, SecurityEvent } from "@/lib/api"

interface Session {
    id: string;
    ip_address: string;
    user_agent: string;
    device_info: Record<string, unknown>;
    is_revoked: boolean;
    last_active: string;
    created_at: string;
    isCurrent: boolean;
}
import { toast } from "sonner"
// @ts-expect-error JSONHighlighter has no type definitions
import JSONHighlighter from 'react-json-syntax-highlighter'
import dynamic from 'next/dynamic'
import { UAParser } from 'ua-parser-js'

import {
    Map,
    MapMarker,
    MapPopup,
    MapTileLayer,
    MapZoomControl,
} from "@/components/ui/map"

interface Device {
    id: string;
    device_name?: string;
    is_revoked?: boolean;
    last_active?: string;
    ip_address?: string;
    user_agent?: string;
    os?: string;
    browser?: string;
    location?: string;
    is_current?: boolean;
}

interface DevicePlan {
    name: string;
    maxDevices: number;
    currentDevices: number;
}

interface SecurityTabProps {
    user: UserData | null;
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
    userSessions: Session[];
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
    userDevices: Device[];
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
    devicePlan: DevicePlan | null;

    // Activity
    securityEvents: SecurityEvent[];
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
    setSecurityEvents: (val: SecurityEvent[]) => void;
    setSecurityEventsTotal: (val: number) => void;
    setSecurityEventsHasMore: (val: boolean) => void;
    securityEventsDateRange?: DateRange;
    setSecurityEventsDateRange?: (val: DateRange | undefined) => void;
    securityEventType?: string;
    setSecurityEventType?: (val: string) => void;

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
}

const JsonHighlighter = ({ data }: { data: unknown }) => {
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
        userPlan,
        securityEventsDateRange, setSecurityEventsDateRange,
        securityEventType, setSecurityEventType
    } = props;

    const { formatDate } = useFormatter();

    const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
    const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
    const [eventActiveTab, setEventActiveTab] = useState<'overview' | 'metadata'>('overview');

    const SECURITY_EVENT_TYPES = [
        { id: 'login', label: 'Login' },
        { id: 'logout', label: 'Logout' },
        { id: 'password_changed', label: 'Password Changed' },
        { id: '2fa_enabled', label: '2FA Enabled' },
        { id: '2fa_disabled', label: '2FA Disabled' },
        { id: 'device_added', label: 'Device Added' },
        { id: 'device_removed', label: 'Device Removed' },
        { id: 'session_revoked', label: 'Session Revoked' },
    ];

    const SecurityEventTypeSelector = React.memo(function SecurityEventTypeSelector() {
        const [open, setOpen] = useState(false);
        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-36 justify-start text-xs px-3">
                        <span className="truncate text-xs">{securityEventType ? (SECURITY_EVENT_TYPES.find(et => et.id === securityEventType)?.label || 'Selected') : 'All Events'}</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                    <div className="max-h-[300px] overflow-y-auto">
                        <div className="flex flex-col">
                            <button onClick={() => { setSecurityEventType?.(''); setOpen(false); }} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">All Events</button>
                            {SECURITY_EVENT_TYPES.map(et => (
                                <button key={et.id} onClick={() => { setSecurityEventType?.(et.id); setOpen(false); }} className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors">{et.label}</button>
                            ))}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        );
    });

    const handleExpandEvent = async (eventId: string) => {
        if (expandedEventId === eventId) {
            setExpandedEventId(null);
            return;
        }

        setExpandedEventId(eventId);
        setEventActiveTab('overview');

        // Check if we have details (additionalData should be present if loaded)
        // We use finding by ID in the list
        const event = securityEvents.find(e => e.id === eventId);

        if (event && !event.additionalData && !event.riskSignals && !loadingDetails) {
            setLoadingDetails(eventId);
            try {
                const res = await apiClient.getSecurityEvent(eventId);
                if (res.success && res.data) {
                    // Update the event in the list via the parent's setter
                    const newEvents = securityEvents.map(e =>
                        e.id === eventId ? { ...e, ...res.data } : e
                    );
                    setSecurityEvents(newEvents);
                }
            } catch (e) {
                console.error(e);
                toast.error("Failed to load event details");
            } finally {
                setLoadingDetails(null);
            }
        }
    };

    const [copiedCodes, setCopiedCodes] = useState(false);
    const [copiedSecret, setCopiedSecret] = useState(false);
    const [showWipeDialog, setShowWipeDialog] = useState(false);

    // Upgrade dialog state for Pro features / archived events
    const [upgradeDialogData, setUpgradeDialogData] = useState<{ open: boolean; title: string; description: string } | null>(null);

    // Master Key Reveal/Export state
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [revealPassword, setRevealPassword] = useState("");
    const [isRevealing, setIsRevealing] = useState(false);
    const [revealedKey, setRevealedKey] = useState<{ key: string; salt: string } | null>(null);
    const [showKey, setShowKey] = useState(false);
    const [isRotating, setIsRotating] = useState(false);

    // Password Change State (Local)
    const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);

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

    const handleDownloadMasterKey = () => {
        if (!revealedKey || !user) return;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `MK-${user.id}-${timestamp}.txt`;
        const content = `Ellipticc Drive - Master Key Export
----------------------------------------
Date: ${new Date().toLocaleString()}
User ID: ${user.id}
Email: ${user.email}

Master Key: ${revealedKey.key}
Account Salt: ${revealedKey.salt}

CRITICAL: Keep this file in a safe, offline location. Anyone with access to this key can decrypt your data.
----------------------------------------`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success("Master Key downloaded successfully");
    };

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

    const handleRevealMasterKey = async () => {
        if (!revealPassword) {
            toast.error("Please enter your password");
            return;
        }

        if (!user?.email) {
            toast.error("User email not found");
            return;
        }

        setIsRevealing(true);
        try {
            // 1. Validate password with OPAQUE (manual steps to control reporting)
            try {
                const loginFlow = new OPAQUELogin();
                const { startLoginRequest } = await loginFlow.step1(revealPassword);
                const { loginResponse } = await loginFlow.step2(user.email, startLoginRequest);
                // Step 3 verifies the server response - throws if password is wrong
                await loginFlow.step3(loginResponse);
            } catch (opaqueErr) {
                console.error("OPAQUE validation failed:", opaqueErr);
                throw new Error("Incorrect password");
            }

            // 2. Retrieve the cached master key (already unwrapped and verified during login)
            if (!masterKeyManager.hasMasterKey()) {
                throw new Error("Master key not active in current session");
            }
            const key = masterKeyManager.getMasterKey();
            const salt = masterKeyManager.getAccountSalt() || "Unknown";

            // Convert to hex for display
            const keyHex = Array.from(key).map(b => b.toString(16).padStart(2, '0')).join('');

            setRevealedKey({ key: keyHex, salt });
            setShowKey(true);

            // Track success event
            await apiClient.trackMasterKeyRevealed();
            toast.success("Master Key revealed successfully");
        } catch (err) {
            console.error(err);
            const errorMsg = err instanceof Error ? err.message : "Failed to reveal Master Key";
            toast.error(errorMsg === "Incorrect password" ? "Incorrect password" : "Failed to reveal Master Key");

            // Report failure
            await apiClient.trackMasterKeyRevealFailed(errorMsg);
        } finally {
            setIsRevealing(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast.error("Please fill in all fields");
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error("New passwords do not match");
            return;
        }

        if (newPassword.length < 8) {
            toast.error("New password must be at least 8 characters");
            return;
        }

        setIsChangingPassword(true);

        try {
            // Ensure user email is available
            const userEmail = user?.email;
            if (!userEmail) {
                toast.error("User email not found. Cannot change password.");
                setIsChangingPassword(false);
                return;
            }

            // Critical: Ensure we have the Master Key before proceeding
            // If we don't have it, we can't re-encrypt it, leading to data loss
            if (!masterKeyManager.hasMasterKey()) {
                toast.error("Security session expired. Please log out and log in again to change your password.");
                setIsChangingPassword(false);
                return;
            }

            // 1. Verify current password with OPAQUE (client-side)
            const opaqueLogin = new OPAQUELogin();

            try {
                // Step 1: Start login request
                const { startLoginRequest } = await opaqueLogin.step1(currentPassword);

                // Step 2: Get server response (using helper that calls the correct endpoint)
                const { loginResponse } = await opaqueLogin.step2(userEmail, startLoginRequest);

                // Step 3: Finish login (verify password)
                // This will throw if the server response doesn't match our derived key
                await opaqueLogin.step3(loginResponse);

            } catch (err) {
                console.error("Password verification failed:", err);
                toast.error("Incorrect current password");
                // Report failure if possible (best effort)
                if (apiClient.reportOpaqueFailure) {
                    apiClient.reportOpaqueFailure("PASSWORD_CHANGE", "VERIFICATION", "Incorrect password");
                }
                setIsChangingPassword(false);
                return;
            }

            // 2. Generate new OPAQUE registration record
            let newOpaquePasswordFile: string;

            try {
                const opaqueReg = new OPAQUERegistration();
                const { registrationRequest } = await opaqueReg.step1(newPassword);
                const { registrationResponse } = await opaqueReg.step2(userEmail, registrationRequest);
                const { registrationRecord } = await opaqueReg.step3(registrationResponse);
                newOpaquePasswordFile = registrationRecord;
            } catch (err) {
                console.error("Failed to generate new OPAQUE record:", err);
                toast.error("Failed to prepare new password security. Please try again.");
                setIsChangingPassword(false);
                return;
            }

            // 3. Re-encrypt Master Key
            let newEncryptedMasterKey: string | undefined;
            let newSalt: string | undefined;
            let newNonce: string | undefined;

            if (masterKeyManager.hasMasterKey()) {
                try {
                    const masterKey = masterKeyManager.getMasterKey();
                    newSalt = generateKeyDerivationSalt();
                    const newKek = await deriveEncryptionKey(newPassword, newSalt);
                    const { encryptedData, nonce } = encryptData(masterKey, newKek);
                    newEncryptedMasterKey = encryptedData;
                    newNonce = nonce;
                } catch (err) {
                    console.error("Failed to re-encrypt master key:", err);
                    toast.error("Security error: Could not re-encrypt master key.");
                    setIsChangingPassword(false);
                    return;
                }
            }

            // 4. Send to backend
            const response = await apiClient.changePassword({
                newOpaquePasswordFile,
                encryptedMasterKey: newEncryptedMasterKey,
                masterKeySalt: newSalt,
                masterKeyNonce: newNonce,
                masterKeyVersion: 1
            });

            if (response.success) {
                // Explicitly revoke all other sessions to ensure full account protection
                try {
                    await apiClient.revokeAllSessions();
                } catch (revokeErr) {
                    console.error("Post-password change session revocation failed:", revokeErr);
                    // Continue anyway as the primary session will be cleared next
                }

                toast.success("Password changed successfully. All other devices have been disconnected.");
                setShowChangePasswordDialog(false);
                // Clear sensitive data
                masterKeyManager.clearMasterKey();
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");

                // Force logout
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
            } else {
                toast.error(response.error || "Failed to change password");
            }

        } catch (error) {
            console.error("Password change error:", error);
            toast.error("An unexpected error occurred");
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleRotateIdentity = () => {
        setIsRotating(true);
        setTimeout(() => {
            setIsRotating(false);
            toast.info("Identity Rotation", {
                description: "This feature is currently in development. It will allow you to rotate your cryptographic identity without losing data access."
            });
        }, 1500);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold">Security & Privacy</h2>



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
                    onClick={() => setShowChangePasswordDialog(true)}
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
                                                        <TooltipContent 
                                                            side="top"
                                                            className="cursor-pointer"
                                                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(session.id); toast.success('Copied session id'); }}
                                                        >
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
                                                {formatDate(session.created_at)}
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
                {sessionsTotal > 5 && (
                    <div className="flex items-center justify-between mt-4">
                        <p className="text-xs text-muted-foreground">
                            Showing {userSessions.length} of {sessionsTotal} sessions
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => loadUserSessions(sessionsPage - 1)}
                                disabled={sessionsPage === 1 || isLoadingSessions}
                            >
                                <IconChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
                                Page {sessionsPage} of {sessionsTotalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => loadUserSessions(sessionsPage + 1)}
                                disabled={sessionsPage >= sessionsTotalPages || isLoadingSessions}
                            >
                                <IconChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
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
                                        {devicePlan.currentDevices}/{devicePlan.name === 'Unlimited' ? 'Unlimited' : devicePlan.maxDevices} {devicePlan.name !== 'Unlimited' ? devicePlan.name : ''} Slots
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">Manage authorized devices and cryptographic identities</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
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
                                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="cursor-help underline decoration-dotted decoration-muted-foreground/30">
                                                                {device.id.substring(0, 8)}...
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent 
                                                            side="top"
                                                            className="cursor-pointer"
                                                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(device.id); toast.success('Copied device id'); }}
                                                        >
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
                                                                        setUpgradeDialogData({
                                                                            open: true,
                                                                            title: 'Pro Feature',
                                                                            description: 'Upgrade to a Pro plan to customize your device names.'
                                                                        });
                                                                    }
                                                                }}
                                                            >
                                                                {editingDeviceId === device.id ? (
                                                                    <Input
                                                                        value={editNameValue}
                                                                        onChange={(e) => setEditNameValue(e.target.value.slice(0, 30))}
                                                                        onBlur={() => {
                                                                            const dev = userDevices.find((d) => d.id === editingDeviceId);
                                                                            if (dev && editNameValue.trim() !== (dev.device_name || '')) {
                                                                                handleUpdateDeviceName(dev.id, editNameValue);
                                                                            } else {
                                                                                setEditingDeviceId(null);
                                                                            }
                                                                        }}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                const dev = userDevices.find((d) => d.id === editingDeviceId);
                                                                                if (dev && editNameValue.trim() !== (dev.device_name || '')) {
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
                                                {formatDate(device.last_active)}
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
                {devicesTotal > 5 && (
                    <div className="flex items-center justify-between mt-4">
                        <p className="text-xs text-muted-foreground">
                            Showing {userDevices.length} of {devicesTotal} devices
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => loadUserDevices(devicesPage - 1)}
                                disabled={devicesPage === 1 || isLoadingDevices}
                            >
                                <IconChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
                                Page {devicesPage} of {devicesTotalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => loadUserDevices(devicesPage + 1)}
                                disabled={devicesPage >= devicesTotalPages || isLoadingDevices}
                            >
                                <IconChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
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
                                                if (planName.includes('Unlimited')) return "Events are never archived";
                                                if (planName.includes('Pro')) return "Events are archived & blurred after 180 days";
                                                if (planName.includes('Plus')) return "Events are archived & blurred after 60 days";
                                                return "Events are archived & blurred after 7 days";
                                            })()}
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <SecurityEventTypeSelector />

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "h-8 justify-start text-left font-normal px-3",
                                        !securityEventsDateRange && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {securityEventsDateRange?.from ? (
                                        securityEventsDateRange.to ? (
                                            <>
                                                {format(securityEventsDateRange.from, "LLL dd, y")} -{" "}
                                                {format(securityEventsDateRange.to, "LLL dd, y")}
                                            </>
                                        ) : (
                                            format(securityEventsDateRange.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span>Pick a date</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={securityEventsDateRange?.from}
                                    selected={securityEventsDateRange}
                                    onSelect={setSecurityEventsDateRange}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>

                        {securityEventsDateRange && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => setSecurityEventsDateRange?.(undefined)}
                            >
                                <IconClose className="h-4 w-4" />
                            </Button>
                        )}

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => loadSecurityEvents(1)}
                                        disabled={isLoadingSecurityEvents}
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
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
                                        disabled={securityEvents.length === 0}
                                        className={`h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 ${securityEvents.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                            onClick={() => {
                                                if (hasExportAccess) {
                                                    handleDownloadSecurityEvents();
                                                } else {
                                                    setUpgradeDialogData({ open: true, title: 'Export is a premium feature', description: 'Exporting security events is available on Pro & Unlimited plans.' });
                                                }
                                            }}
                                            aria-disabled={!hasExportAccess}
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
                                    <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs tracking-wider hidden sm:table-cell">Event ID</th>
                                    <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs tracking-wider">Event</th>
                                    <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs tracking-wider hidden md:table-cell">Location / IP</th>
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
                                    securityEvents.map((event: SecurityEvent) => {
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

                                        const isBlurred = event.is_blurred;

                                        return (
                                            <React.Fragment key={event.id}>
                                                <TooltipProvider>
                                                    <Tooltip delayDuration={200}>
                                                        <TooltipTrigger asChild>
                                                            <tr
                                                                className={`hover:bg-muted/30 transition-colors cursor-pointer group ${isBlurred ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                                onClick={() => {
                                                                    if (isBlurred) {
                                                                        setUpgradeDialogData({ open: true, title: 'Upgrade required', description: 'Upgrade your plan to view full history.' });
                                                                    } else {
                                                                        handleExpandEvent(event.id);
                                                                    }
                                                                }}
                                                            >
                                                                <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">
                                                                    <div className="flex items-center gap-2">
                                                                        {isExpanded ? <IconChevronUp className="h-3 w-3" /> : <IconChevronDown className="h-3 w-3" />}
                                                                        <TooltipProvider>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <span className="cursor-help underline decoration-dotted decoration-muted-foreground/30">
                                                                                        {event.id.substring(0, 8)}...
                                                                                    </span>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent 
                                                                                    side="top"
                                                                                    className="cursor-pointer"
                                                                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(event.id); toast.success('Copied event id'); }}
                                                                                >
                                                                                    <p className="font-mono text-xs">{event.id}</p>
                                                                                </TooltipContent>
                                                                            </Tooltip>
                                                                        </TooltipProvider>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className={`flex flex-col ${isBlurred ? 'blur-[3px]' : ''}`}>
                                                                        <span className="font-medium text-sm capitalize flex items-center gap-1.5">
                                                                            {isBlurred && <IconLock className="h-3 w-3 text-muted-foreground/50" />}
                                                                            {isBlurred ? (event.summary || 'Archived Event') : (
                                                                                event.eventType.replace(/_/g, ' ').toLowerCase()
                                                                            )}
                                                                        </span>
                                                                        {!isBlurred && (
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
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 hidden md:table-cell">
                                                                    <div className={`flex flex-col ${isBlurred ? 'blur-[3px]' : ''}`}>
                                                                        <span className="text-sm font-mono whitespace-nowrap">
                                                                            {detailedEventsEnabled ? event.ipAddress : '••••••••••••'}
                                                                        </span>
                                                                        {!isPaid && !isBlurred && (
                                                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Location Restricted</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`text-xs font-bold uppercase py-0.5 px-1.5 rounded ${isBlurred ? 'bg-muted text-muted-foreground' : (event.status === 'success'
                                                                        ? 'text-emerald-600 bg-emerald-100/50 dark:bg-emerald-950/30'
                                                                        : 'text-red-500 bg-red-100/50 dark:bg-red-950/30')
                                                                        }`}>
                                                                        {isBlurred ? 'ARCHIVED' : event.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                                                                    {formatDate(event.createdAt)}
                                                                </td>
                                                            </tr>
                                                        </TooltipTrigger>
                                                        {isBlurred && (
                                                            <TooltipContent>
                                                                <p>Upgrade your plan to view full history</p>
                                                            </TooltipContent>
                                                        )}
                                                    </Tooltip>
                                                </TooltipProvider>
                                                {isExpanded && (
                                                    <tr className="bg-muted/10 border-b">
                                                        <td colSpan={5} className="px-0 py-0">
                                                            {loadingDetails === event.id || (!event.additionalData && !event.riskSignals) ? (
                                                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-3">
                                                                    <IconLoader2 className="h-6 w-6 animate-spin" />
                                                                    <span className="text-xs font-medium uppercase tracking-wider">Loading details...</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col">
                                                                    {/* Tab Header */}
                                                                    <div className="flex items-center px-4 border-b bg-muted/20">
                                                                        <button
                                                                            onClick={() => setEventActiveTab('overview')}
                                                                            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${eventActiveTab === 'overview'
                                                                                ? 'border-primary text-primary'
                                                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                                                                }`}
                                                                        >
                                                                            Overview
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setEventActiveTab('metadata')}
                                                                            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${eventActiveTab === 'metadata'
                                                                                ? 'border-primary text-primary'
                                                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                                                                }`}
                                                                        >
                                                                            Raw Log
                                                                        </button>
                                                                    </div>

                                                                    {/* Tab Content */}
                                                                    <div className="p-8">
                                                                        {eventActiveTab === 'overview' && (
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
                                                                                        <PaidField label="Session Type" value={String(event.additionalData?.sessionType ?? 'N/A')} />
                                                                                        <PaidField label="Token Type" value={String(event.additionalData?.tokenType ?? 'N/A')} />
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
                                                                                                    (((event.riskSignals) as string[] | undefined) || []).length > 0 ? (
                                                                                                        (((event.riskSignals) as string[]) || []).map((sig: string, idx: number) => (
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
                                                                                            <Map
                                                                                                center={[event.latitude || 0, event.longitude || 0]}
                                                                                                zoom={14}
                                                                                                className="h-full w-full z-0"
                                                                                            >
                                                                                                <MapTileLayer />
                                                                                                <MapZoomControl />
                                                                                                <MapMarker position={[event.latitude || 0, event.longitude || 0]} />
                                                                                            </Map>
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
                                                                        )}

                                                                        {eventActiveTab === 'metadata' && (
                                                                            <div className="space-y-4">
                                                                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                                                    Additional Metadata
                                                                                    {!isPaid && <span className="bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded-full border border-primary/20">Pro Feature</span>}
                                                                                </h4>
                                                                                <div className={`transition-all ${!isPaid ? 'blur-[5px] select-none pointer-events-none' : ''}`}>
                                                                                    <JsonHighlighter data={event.additionalData || {}} />
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
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
                                onClick={() => loadSecurityEvents(Math.max(1, securityEventsPage - 1))}
                                disabled={securityEventsPage <= 1 || isLoadingSecurityEvents}
                            >
                                <IconChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
                                Page {securityEventsPage} of {securityEventsTotal > 0 ? Math.ceil(securityEventsTotal / 10) : 1}
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

            {/* Upgrade Alert Dialog */}
            <AlertDialog open={!!upgradeDialogData?.open} onOpenChange={(open: boolean) => !open && setUpgradeDialogData(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{upgradeDialogData?.title}</AlertDialogTitle>
                        <AlertDialogDescription className="pt-2 text-sm">
                            {upgradeDialogData?.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-2">
                        <AlertDialogCancel>Maybe later</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { setUpgradeDialogData(null); window.location.href = '/pricing'; }} className="bg-primary">Upgrade</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Master Key & Cryptographic Identity Section */}
            <div className="border-t pt-6 space-y-4">
                <div className="flex items-center gap-3">
                    <IconFingerprint className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="font-medium">Master Key & Cryptographic Identity</p>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider h-5 flex items-center gap-1">
                                            <IconShieldLock className="h-3 w-3" />
                                            Zero-Knowledge
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-xs">Your keys never leave your device. Only you can access your data.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Manage the root of your encryption and your digital identity.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-muted/30 border-dashed hover:bg-muted/50 transition-colors">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <IconRotate className="h-4 w-4 text-primary" />
                                    Identity Rotation
                                </CardTitle>
                                <Badge variant="secondary" className="text-[9px]">BETA</Badge>
                            </div>
                            <CardDescription className="text-xs">
                                Replace your current cryptographic identity with a new one.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-xs h-8"
                                onClick={handleRotateIdentity}
                                disabled={isRotating}
                            >
                                {isRotating ? (
                                    <IconLoader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                                ) : (
                                    <IconRefresh className="h-3.5 w-3.5 mr-2" />
                                )}
                                Rotate Identity
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-muted/30 border-dashed hover:bg-muted/50 transition-colors">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <IconKey className="h-4 w-4 text-primary" />
                                    Export Master Key
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <IconInfoCircle className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary transition-all ml-1" />
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p className="text-xs">Securely export your root encryption key</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                Download your root encryption key for emergency recovery.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-xs h-8"
                                onClick={() => setIsExportModalOpen(true)}
                            >
                                <IconDownload className="h-3.5 w-3.5 mr-2" />
                                Export Key
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-amber-600 dark:text-amber-400">
                    <IconAlertCircle className="h-4 w-4 flex-shrink-0" />
                    <p className="text-[11px] font-medium leading-tight">
                        Warning: Your Master Key is the ONLY way to recover your data if you lose access to your account.
                        Keep it in a safe, offline location.
                    </p>
                </div>
            </div>

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
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-dashed transition-all">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <Label className="text-sm font-semibold">
                                    Anonymous Performance Tracking
                                </Label>
                                <TooltipProvider>
                                    <Tooltip delayDuration={0}>
                                        <TooltipTrigger asChild>
                                            <IconInfoCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Helps us optimize encryption speed (no identity or file data revealed)</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Allow collection of anonymous performance metrics
                            </p>
                        </div>
                        <Switch
                            id="usage-diagnostics"
                            checked={usageDiagnosticsEnabled}
                            onCheckedChange={(checked) => handleUpdatePrivacySettings(checked, crashReportsEnabled)}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-dashed transition-all">
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

            {/* Password Change Dialog */}
            <Dialog open={showChangePasswordDialog} onOpenChange={(open) => {
                if (!open && !isChangingPassword) {
                    setShowChangePasswordDialog(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogDescription>
                            Changing your password will re-encrypt your security keys and disconnect all other active devices. You will need to log back in everywhere.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }}>
                        <div className="space-y-4 py-4">
                            <div className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-lg text-red-600 dark:text-red-400 mb-2">
                                <IconAlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider mb-1">Global Disconnect</p>
                                    <p className="text-[11px] leading-normal opacity-90">
                                        For your security, all active sessions and devices will be revoked immediately upon changing your password.
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="current-password">Current Password</Label>
                                <PasswordInput
                                    id="current-password"
                                    name="current-password"
                                    autoComplete="current-password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-password">New Password</Label>
                                <PasswordInput
                                    id="new-password"
                                    name="new-password"
                                    autoComplete="new-password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password (min 8 chars)"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm New Password</Label>
                                <PasswordInput
                                    id="confirm-password"
                                    name="confirm-password"
                                    autoComplete="new-password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowChangePasswordDialog(false)} disabled={isChangingPassword}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isChangingPassword}>
                                {isChangingPassword ? (
                                    <>
                                        <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                                        Updating...
                                    </>
                                ) : (
                                    "Change Password"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

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
            {/* Master Key Export Modal */}
            <Dialog open={isExportModalOpen} onOpenChange={(open) => {
                setIsExportModalOpen(open);
                if (!open) {
                    setRevealPassword("");
                    setRevealedKey(null);
                    setShowKey(false);
                }
            }}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <IconKey className="h-5 w-5 text-primary" />
                            Export Master Key
                        </DialogTitle>
                        <DialogDescription>
                            Your Master Key is the root of your zero-knowledge encryption.
                            Revealing it requires your account password.
                        </DialogDescription>
                    </DialogHeader>

                    {!revealedKey ? (
                        <form onSubmit={(e) => { e.preventDefault(); handleRevealMasterKey(); }}>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="reveal-password">Verify Account Password</Label>
                                    <PasswordInput
                                        id="reveal-password"
                                        name="password"
                                        autoComplete="current-password"
                                        placeholder="Enter your password"
                                        value={revealPassword}
                                        onChange={(e) => setRevealPassword(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400">
                                    <IconAlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs leading-normal">
                                        NEVER share this key with anyone. Ellipticc employees will never ask for your Master Key.
                                    </p>
                                </div>
                            </div>
                            <DialogFooter className="pt-2">
                                <Button type="button" variant="outline" onClick={() => setIsExportModalOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={isRevealing || !revealPassword}>
                                    {isRevealing ? (
                                        <>
                                            <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                                            Verifying...
                                        </>
                                    ) : (
                                        "Reveal Key"
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    ) : (
                        <div className="space-y-6 py-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Your Master Key</Label>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-[10px] text-primary hover:text-primary hover:bg-primary/10"
                                            onClick={handleDownloadMasterKey}
                                        >
                                            <IconDownload className="h-3 w-3 mr-1" /> Download
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-[10px]"
                                            onClick={() => setShowKey(!showKey)}
                                        >
                                            {showKey ? <><IconEyeOff className="h-3 w-3 mr-1" /> Hide</> : <><IconEye className="h-3 w-3 mr-1" /> Show</>}
                                        </Button>
                                    </div>
                                </div>
                                <div className="relative group">
                                    <div className={`p-4 rounded-xl border bg-muted/50 font-mono text-[11px] break-all leading-relaxed transition-all duration-300 ${!showKey ? 'blur-md select-none' : ''}`}>
                                        {revealedKey.key}
                                    </div>
                                    {showKey && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => {
                                                navigator.clipboard.writeText(revealedKey.key);
                                                toast.success("Master Key copied");
                                            }}
                                        >
                                            <IconCopy className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Account Salt</Label>
                                <div className="relative group">
                                    <div className="p-3 rounded-xl border bg-muted/50 font-mono text-[11px] break-all">
                                        {revealedKey.salt}
                                    </div>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="absolute top-1.5 right-1.5 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => {
                                            navigator.clipboard.writeText(revealedKey.salt);
                                            toast.success("Account Salt copied");
                                        }}
                                    >
                                        <IconCopy className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg">
                                <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
                                <p className="text-[10px] text-muted-foreground leading-normal">
                                    Both the Master Key and Account Salt are required to manually reconstruct your encryption environment.
                                </p>
                            </div>
                            <DialogFooter className="pt-2">
                                <Button className="w-full" onClick={() => setIsExportModalOpen(false)}>
                                    Done
                                </Button>
                            </DialogFooter>
                        </div>
                    )}


                </DialogContent>
            </Dialog>
        </div>
    )
}
