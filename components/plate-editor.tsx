'use client';

import * as React from 'react';
import { Plate, usePlateEditor } from 'platejs/react';
import { type Value } from 'platejs';
import { EditorKit } from '@/components/editor-kit';
import { SettingsDialog } from '@/components/settings-dialog';
import { Editor, EditorContainer } from '@/components/ui/editor';

interface PlateEditorProps {
  initialValue?: Value;
  onChange?: (value: Value) => void;
  readOnly?: boolean;
}

export function PlateEditor({ initialValue, onChange, readOnly }: PlateEditorProps) {
  const [value, setValue] = React.useState<Value>(initialValue || [{ children: [{ text: '' }], type: 'p' }]);

  const editor = usePlateEditor({
    plugins: EditorKit,
    value: value,
    override: {
      components: {
        // Override components if needed
      }
    }
  });

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-background">
      <Plate
        editor={editor}
        readOnly={readOnly}
        onChange={({ value: newValue }) => {
          setValue(newValue);
          onChange?.(newValue);
        }}
      >
        <EditorContainer className="flex-1 overflow-y-auto w-full h-full max-w-none px-4 md:px-[10%] py-8">
          <Editor variant="fullWidth" className="min-h-full" />
        </EditorContainer>
        <SettingsDialog />
      </Plate>
    </div>
  );
}
