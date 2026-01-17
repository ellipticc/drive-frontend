"use client"

import React, { useEffect, useState, useMemo } from 'react'
import { IconLoader2 } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Plate, usePlateEditor, PlateController } from 'platejs/react'
import { paperService } from '@/lib/paper-service'
import { masterKeyManager } from '@/lib/master-key'
import { Editor, EditorContainer } from '@/components/ui/editor'
import { EditorKit } from '@/components/editor-kit'

interface PaperPreviewProps {
  fileId: string
  initialContent?: any
  filename?: string
}

export function PaperPreview({ fileId, initialContent, filename }: PaperPreviewProps) {
  const [loading, setLoading] = useState(!initialContent)
  // Use a key to force editor remount when content changes significantly
  const [editorKey, setEditorKey] = useState(0)

  const [content, setContent] = useState<any>(initialContent || [{ type: 'p', children: [{ text: '' }] }])

  const editor = usePlateEditor({
    id: `preview-${fileId}-${editorKey}`,
    plugins: EditorKit,
    value: content
  })

  // Synchronize content when it changes from outside
  useEffect(() => {
    if (initialContent) {
      setContent(initialContent)
      setEditorKey(prev => prev + 1)
      setLoading(false)
    }
  }, [initialContent])

  useEffect(() => {
    if (initialContent) return

    const loadPaper = async () => {
      setLoading(true)
      try {
        if (!masterKeyManager.hasMasterKey()) {
          toast.error('Encryption key missing.')
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
        setContent(loadedContent)
        setEditorKey(prev => prev + 1)
      } catch (err) {
        console.error('Failed to load paper:', err)
        toast.error('Failed to load paper')
      } finally {
        setLoading(false)
      }
    }

    loadPaper()
  }, [fileId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-background/50 backdrop-blur-sm">
        <IconLoader2 className="w-8 h-8 animate-spin text-primary/40" />
      </div>
    )
  }

  return (
    <PlateController>
      <Plate editor={editor} key={editorKey}>
        <div className="w-full flex justify-center bg-background min-h-full">
          <div className="w-full max-w-[850px] px-8 md:px-16 py-12">
            <Editor readOnly className="border-none shadow-none focus-visible:ring-0" />
          </div>
        </div>
      </Plate>
    </PlateController>
  )
}

export default PaperPreview
