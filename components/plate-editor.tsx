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
  const [value, setValue] = React.useState<Value>(initialValue || [{ children: [{ text: '' }], type: 'h1' }]);

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

        <EditorContainer className="flex-1 w-full h-full flex overflow-y-auto">
          <Editor
            className="min-h-full w-full max-w-[850px] px-8 md:px-12 py-8 border-none shadow-none focus-visible:ring-0 mx-auto ml-[15%]"
            autoFocus
            placeholder="New Page"
          />
        </EditorContainer>
      </Plate>
    </div>
  );
}
