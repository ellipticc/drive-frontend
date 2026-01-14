'use client';

import * as React from 'react';
import { Plate, usePlateEditor } from 'platejs/react';
import { type Value } from 'platejs';
import { EditorKit } from '@/components/editor-kit';
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


        <EditorContainer className="flex-1 w-full h-full">
          <Editor className="min-h-full w-full max-w-4xl mx-auto px-4 md:px-6 py-4" />
        </EditorContainer>
      </Plate>
    </div>
  );
}
