"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { IconFile, IconFolder, IconReplace, IconCopy, IconX } from "@tabler/icons-react"

interface ConflictItem {
  id: string
  name: string
  type: 'file' | 'folder'
  existingPath: string
  newPath: string
}

interface ConflictModalProps {
  isOpen: boolean
  onClose: () => void
  conflicts: ConflictItem[]
  onResolve: (resolutions: Record<string, 'replace' | 'keepBoth' | 'ignore'>) => void
  operation: 'upload' | 'move' | 'rename' | 'copy'
}

export function ConflictModal({ isOpen, onClose, conflicts, onResolve, operation }: ConflictModalProps) {
  const [resolutions, setResolutions] = useState<Record<string, 'replace' | 'keepBoth' | 'ignore'>>({})
  const [applyToAll, setApplyToAll] = useState(false)
  const [globalResolution, setGlobalResolution] = useState<'replace' | 'keepBoth' | 'ignore'>('replace')

  const handleResolutionChange = (itemId: string, resolution: 'replace' | 'keepBoth' | 'ignore') => {
    if (applyToAll) {
      setGlobalResolution(resolution)
      const newResolutions: Record<string, 'replace' | 'keepBoth' | 'ignore'> = {}
      conflicts.forEach(conflict => {
        newResolutions[conflict.id] = resolution
      })
      setResolutions(newResolutions)
    } else {
      setResolutions(prev => ({ ...prev, [itemId]: resolution }))
    }
  }

  const handleApplyToAllChange = (checked: boolean) => {
    setApplyToAll(checked)
    if (checked) {
      const newResolutions: Record<string, 'replace' | 'keepBoth' | 'ignore'> = {}
      conflicts.forEach(conflict => {
        newResolutions[conflict.id] = globalResolution
      })
      setResolutions(newResolutions)
    }
  }

  const handleContinue = () => {
    // Ensure all conflicts have a resolution
    const completeResolutions: Record<string, 'replace' | 'keepBoth' | 'ignore'> = {}
    conflicts.forEach(conflict => {
      completeResolutions[conflict.id] = resolutions[conflict.id] || 'replace'
    })
    onResolve(completeResolutions)
    onClose()
  }

  const getTitle = () => {
    const opLabel = operation === 'upload' ? 'Upload' : operation === 'move' ? 'Move' : operation === 'copy' ? 'Copy' : 'Rename'
    if (conflicts.length === 1) {
      return `${opLabel} Conflict`
    }
    return `${opLabel} Conflicts (${conflicts.length})`
  }

  const getDescription = () => {
    if (conflicts.length === 1) {
      const conflict = conflicts[0]
      return `"${conflict.name}" already exists. What would you like to do?`
    }
    return `${conflicts.length} items already exist. Choose how to resolve each conflict.`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {conflicts.length === 1 ? (
              conflicts[0].type === 'file' ? <IconFile className="h-5 w-5" /> : <IconFolder className="h-5 w-5" />
            ) : (
              <IconFile className="h-5 w-5" />
            )}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {conflicts.map((conflict) => (
            <div key={conflict.id} className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center gap-2">
                {conflict.type === 'file' ? <IconFile className="h-4 w-4" /> : <IconFolder className="h-4 w-4" />}
                <span className="font-medium truncate">{conflict.name}</span>
              </div>

              <RadioGroup
                value={resolutions[conflict.id] || 'replace'}
                onValueChange={(value: string) => handleResolutionChange(conflict.id, value as 'replace' | 'keepBoth' | 'ignore')}
                className="space-y-2"
              >
                <label className="flex items-start space-x-3 p-3 rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
                  <RadioGroupItem value="replace" id={`replace-${conflict.id}`} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      <IconReplace className="h-4 w-4" />
                      Replace existing {conflict.type}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      The existing {conflict.type} will be overwritten with the new one.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 p-3 rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
                  <RadioGroupItem value="keepBoth" id={`keepBoth-${conflict.id}`} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      <IconCopy className="h-4 w-4" />
                      Keep both {conflict.type}s
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      The new {conflict.type} will be renamed with a number suffix.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 p-3 rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
                  <RadioGroupItem value="ignore" id={`ignore-${conflict.id}`} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      <IconX className="h-4 w-4" />
                      Skip this {conflict.type}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Don&apos;t {operation} this {conflict.type} and continue with others.
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          ))}

          <div className="flex items-center space-x-2 pt-4">
            <Checkbox
              id="applyToAll"
              checked={applyToAll}
              onCheckedChange={handleApplyToAllChange}
            />
            <Label htmlFor="applyToAll" className="text-sm font-medium cursor-pointer">
              Apply to all duplicates
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleContinue}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}