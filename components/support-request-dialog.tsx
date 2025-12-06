import * as React from "react"
import { IconHelp, IconSend } from "@tabler/icons-react"
import { toast } from "sonner"

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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiClient } from "@/lib/api"
import { useIsMobile } from "@/hooks/use-mobile"

interface SupportRequestDialogProps {
  children?: React.ReactNode
}

export function SupportRequestDialog({ children }: SupportRequestDialogProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    subject: "",
    message: "",
    priority: "medium",
    category: ""
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Send support request to backend
      const supportData = {
        subject: formData.subject,
        message: formData.message,
        priority: formData.priority,
        category: formData.category,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }

      const response = await apiClient.sendSupportRequest(supportData)

      if (response.success) {
        toast.success("Support request sent successfully! We'll get back to you soon.", {
          duration: 5000,
          style: {
            background: '#22c55e',
            color: '#ffffff',
            border: '1px solid #16a34a',
            borderRadius: '8px',
            fontWeight: '500',
          },
        })
        setFormData({ subject: "", message: "", priority: "medium", category: "" })
        setOpen(false)
      } else {
        toast.error(response.error || "Failed to send support request. Please try again.", {
          duration: 5000,
          style: {
            background: '#ef4444',
            color: '#ffffff',
            border: '1px solid #dc2626',
            borderRadius: '8px',
            fontWeight: '500',
          },
        })
      }
    } catch (error) {
      // console.error('Support request failed:', error)
      toast.error("Failed to send support request. Please try again.", {
        duration: 5000,
        style: {
          background: '#ef4444',
          color: '#ffffff',
          border: '1px solid #dc2626',
          borderRadius: '8px',
          fontWeight: '500',
        },
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm">
            <IconHelp className="h-4 w-4" />
            <span className="sr-only">Get Help</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={`${isMobile ? 'w-[90vw] max-w-none h-[75vh] max-h-none overflow-y-auto' : 'sm:max-w-[500px]'} animate-in fade-in-0 zoom-in-95 duration-200`}>
        <div className="flex flex-col h-full">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <IconHelp className="h-5 w-5 text-primary" />
              Request Support
            </DialogTitle>
            <DialogDescription>
              Need help? We&apos;re here to assist you. Please provide details about your issue.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="flex-1 px-6 py-4">
              <FieldGroup className="space-y-4">
            <Field>
              <FieldLabel htmlFor="subject">Subject</FieldLabel>
              <Input
                id="subject"
                name="subject"
                type="text"
                placeholder="Brief description of your issue"
                required
                value={formData.subject}
                onChange={handleInputChange}
                className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
              <FieldDescription>
                A short title describing your support request
              </FieldDescription>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="priority">Priority</FieldLabel>
                <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger className="transition-all duration-200 focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  How urgent is this request?
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="category">Category</FieldLabel>
                <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger className="transition-all duration-200 focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug-report">Bug Report</SelectItem>
                    <SelectItem value="technical">Technical Issue</SelectItem>
                    <SelectItem value="account">Account Problem</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="feature-request">Feature Request</SelectItem>
                    <SelectItem value="general">General Inquiry</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  What type of issue is this?
                </FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="message">Message</FieldLabel>
              <Textarea
                id="message"
                name="message"
                placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce, or specific questions you have."
                required
                rows={6}
                value={formData.message}
                onChange={handleInputChange}
                className="transition-all duration-200 focus:ring-2 focus:ring-primary/20 resize-none"
              />
              <FieldDescription>
                Provide as much detail as possible to help us assist you better
              </FieldDescription>
            </Field>
              </FieldGroup>
            </div>

            <DialogFooter className="flex-shrink-0 gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
                className="transition-all duration-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !formData.subject.trim() || !formData.message.trim()}
                className="transition-all duration-200"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <IconSend className="h-4 w-4 mr-2" />
                    Send Request
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
