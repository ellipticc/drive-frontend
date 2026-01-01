"use client"

import { useState, useEffect, useRef } from "react"
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"
import { Button } from "@/components/ui/button"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { IconFlag, IconLoader2 } from "@tabler/icons-react"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const REPORT_TYPES = [
  {
    value: "inappropriate_content",
    label: "Inappropriate Content",
    description: "Content that is offensive, explicit, or violates community standards"
  },
  {
    value: "copyright_violation",
    label: "Copyright Violation",
    description: "Content that infringes on intellectual property rights"
  },
  {
    value: "spam_misleading",
    label: "Spam or Misleading",
    description: "Unsolicited content or intentionally deceptive information"
  },
  {
    value: "malware_security",
    label: "Malware or Security Risk",
    description: "Content that may harm devices or compromise security"
  },
  {
    value: "child_exploitation",
    label: "Child Exploitation",
    description: "Content involving the exploitation of minors"
  },
  {
    value: "terrorism_extremism",
    label: "Terrorism or Extremism",
    description: "Content promoting violence, terrorism, or extremist ideologies"
  },
  {
    value: "violent_content",
    label: "Violent Content",
    description: "Content depicting extreme violence or harm"
  },
  {
    value: "harassment",
    label: "Harassment",
    description: "Content intended to harass, intimidate, or bully"
  },
  {
    value: "other",
    label: "Other",
    description: "Other concerns not covered above"
  }
]

interface ReportDialogProps {
  shareId: string
  trigger?: React.ReactNode
  onReportSuccess?: () => void
  className?: string
}

export function ReportDialog({ shareId, trigger, onReportSuccess, className }: ReportDialogProps) {
  const [open, setOpen] = useState(false)
  const [reportType, setReportType] = useState("")
  const [description, setDescription] = useState("")
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [turnstileToken, setTurnstileToken] = useState<string>("")
  const turnstileRef = useRef<TurnstileInstance>(null)

  const MAX_DESCRIPTION = 1000
  const MAX_EMAIL = 254

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setReportType("")
      setDescription("")
      setEmail("")
      setEmailError("")
      setTurnstileToken("")
      turnstileRef.current?.reset()
    }
  }, [open])

  // Email regex for validation
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val.length <= MAX_EMAIL) {
      setEmail(val)
      if (val && !EMAIL_REGEX.test(val)) {
        setEmailError("Please enter a valid email address")
      } else {
        setEmailError("")
      }
    }
  }

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    if (val.length <= MAX_DESCRIPTION) {
      setDescription(val)
    }
  }

  const handleSubmit = async () => {
    if (!reportType) {
      toast.error("Report type required", {
        description: "Please select a report type before submitting."
      })
      return
    }

    if (email && !EMAIL_REGEX.test(email)) {
      toast.error("Invalid Email", {
        description: "Please enter a valid email address."
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await apiClient.reportShare(shareId, {
        reportType,
        description: description.trim() || undefined,
        email: email.trim() || undefined,
        turnstileToken
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to submit report')
      }

      const data = response.data

      if (data && data.autoDeactivated) {
        toast.success("Report submitted and share deactivated", {
          description: "Thank you for your report. This share has been automatically deactivated due to multiple reports."
        })
      } else {
        toast.success("Report submitted", {
          description: "Thank you for your report. Our team will review it shortly."
        })
      }

      // Reset form and close dialog
      setReportType("")
      setDescription("")
      setEmail("")
      setEmailError("")
      setOpen(false)

      // Call success callback to refresh page data
      if (onReportSuccess) {
        onReportSuccess()
      }

    } catch (error: unknown) {
      console.error('Report submission error:', error)
      const errorMessage = error instanceof Error ? error.message : "An error occurred while submitting your report. Please try again."

      if (errorMessage === 'You cannot report your own content.') {
        toast.error("You cannot report your own content.")
      } else {
        toast.error("Failed to submit report", {
          description: errorMessage
        })
      }
    } finally {
      setIsSubmitting(false)
      // Reset Turnstile after each attempt (successful or failed) for security
      turnstileRef.current?.reset()
      setTurnstileToken("")
    }
  }

  const selectedReportType = REPORT_TYPES.find(type => type.value === reportType)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "fixed bottom-4 right-4 z-50 h-8 w-8 rounded-full opacity-50 hover:opacity-100 transition-all hover:bg-muted/50 text-muted-foreground",
              className
            )}
            title="Report Content"
          >
            <IconFlag className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Report Shared Content
          </DialogTitle>
          <DialogDescription>
            Help us keep our platform safe by reporting content that violates our community guidelines.
            All reports are anonymous and reviewed by our moderation team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="report-type">Report Type *</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue placeholder="Select a report type" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedReportType && (
              <p className="text-sm text-muted-foreground">
                {selectedReportType.description}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Your Email (Optional)</Label>
            <Input
              id="email"
              placeholder="name@example.com"
              type="email"
              value={email}
              onChange={handleEmailChange}
              className={emailError ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {emailError ? (
              <p className="text-xs text-red-500">
                {emailError}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                We may contact you if we need more information about this report.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="description">Additional Details (Optional)</Label>
              <span className={`text-xs ${description.length >= MAX_DESCRIPTION ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
                {description.length}/{MAX_DESCRIPTION}
              </span>
            </div>
            <Textarea
              id="description"
              placeholder="Provide any additional context or details about your report..."
              value={description}
              onChange={handleDescriptionChange}
              rows={3}
              className="resize-none max-h-40 overflow-y-auto field-sizing-fixed"
            />
            <p className="text-xs text-muted-foreground">
              Please be specific and include any relevant details.
            </p>
          </div>

          {/* Cloudflare Turnstile */}
          <div className="flex justify-center py-2">
            <Turnstile
              ref={turnstileRef}
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAA476sX870u0JihB"}
              onSuccess={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken("")}
              onError={() => setTurnstileToken("")}
              options={{
                theme: 'light',
                size: 'normal',
              }}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reportType || isSubmitting || !!emailError || !turnstileToken}
            className="min-w-[100px]"
          >
            {isSubmitting ? (
              <>
                <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                Submit Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}