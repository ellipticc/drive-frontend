'use client';

import * as React from 'react';

import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import { FontFamilyPlugin } from '@platejs/basic-styles/react';
import { DropdownMenuItemIndicator } from '@radix-ui/react-dropdown-menu';
import { CheckIcon, ChevronDown } from 'lucide-react';
import { useEditorRef, useSelectionFragmentProp } from 'platejs/react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { ToolbarButton } from './toolbar';

export function FontFamilyToolbarButton(props: DropdownMenuProps) {
  const editor = useEditorRef();
  const { defaultNodeValue, validNodeValues: values = [] } =
    editor.getInjectProps(FontFamilyPlugin);

  const value = useSelectionFragmentProp({
    defaultValue: defaultNodeValue,
    getProp: (node) => node.fontFamily,
  });

  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false} {...props}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex h-7 min-w-[120px] items-center justify-between gap-1 rounded-md bg-muted/60 px-2 text-sm hover:bg-muted',
            open && 'bg-muted'
          )}
          type="button"
        >
          <span 
            className="flex-1 truncate text-left"
            style={{ fontFamily: value }}
          >
            {value || defaultNodeValue}
          </span>
          <ChevronDown className="size-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="max-h-[400px] overflow-y-auto" align="start">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(newValue) => {
            editor
              .getTransforms(FontFamilyPlugin)
              .fontFamily.addMark(newValue);
            editor.tf.focus();
          }}
        >
          {values.map((fontFamily) => (
            <DropdownMenuRadioItem
              key={fontFamily}
              className="min-w-[200px] pl-2 *:first:[span]:hidden"
              value={fontFamily}
              style={{ fontFamily }}
            >
              <span className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center">
                <DropdownMenuItemIndicator>
                  <CheckIcon />
                </DropdownMenuItemIndicator>
              </span>
              {fontFamily}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
