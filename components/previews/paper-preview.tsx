"use client"

import React, { useEffect, useState } from 'react'
import { IconLoader2 } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Plate, usePlateEditor } from 'platejs/react'
import { paperService } from '@/lib/paper-service'
import { masterKeyManager } from '@/lib/master-key'
import { Editor, EditorContainer } from '@/components/ui/editor'
import { EditorKit } from '@/components/editor-kit'

interface PaperPreviewProps {
  fileId: string
  filename?: string
}

export function PaperPreview({ fileId }: PaperPreviewProps) {
  const [loading, setLoading] = useState(true)
  const [initialValue, setInitialValue] = useState<any>([{ type: 'p', children: [{ text: '' }] }])

  const editor = usePlateEditor({ plugins: EditorKit, value: initialValue })

  useEffect(() => {
    const loadPaper = async () => {
      try {
        if (!masterKeyManager.hasMasterKey()) {
          toast.error('Encryption key missing. Please login again to preview this paper.')
          setLoading(false)
          return
        }
        const paper = await paperService.getPaper(fileId)
        const rawContent = paper.content
        let loadedContent: any
        if (rawContent && typeof rawContent === 'object' && !Array.isArray(rawContent) && 'content' in rawContent) {
          loadedContent = (rawContent as any).content
        } else if (Array.isArray(rawContent)) {
          loadedContent = rawContent
        } else {
          loadedContent = [{ type: 'p', children: [{ text: '' }] }]
        }
        setInitialValue(loadedContent)
        // Update editor value
        editor?.setValue && (editor as any).setValue({ value: loadedContent })
      } catch (err) {
        console.error('Failed to load paper for preview:', err)
        toast.error('Failed to load paper for preview')
      } finally {
        setLoading(false)
      }
    }

    loadPaper()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId])

  useEffect(() => {
    // Ensure editor is read-only
    try {
      if (editor && editor.dom) {
        (editor.dom as any).readOnly = true
      }
    } catch (e) {
      // ignore
    }
  }, [editor])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <Plate editor={editor}>
      <div className="w-full max-w-[850px] px-8 md:px-12">
        <Editor className="min-h-full w-full py-4 border-none shadow-none focus-visible:ring-0" readOnly />
      </div>
    </Plate>
  )
}

export default PaperPreview
