'use client';

import * as React from 'react';

import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import { FontFamilyPlugin } from '@platejs/basic-styles/react';
import { DropdownMenuItemIndicator } from '@radix-ui/react-dropdown-menu';
import { CheckIcon, Search } from 'lucide-react';
import { useEditorRef, useSelectionFragmentProp, useEditorSelector } from 'platejs/react';
import { KEYS } from 'platejs';
import type { TElement } from 'platejs';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { ToolbarButton, ToolbarMenuGroup } from './toolbar';

export function FontFamilyToolbarButton(props: DropdownMenuProps) {
  const editor = useEditorRef();
  const { defaultNodeValue, validNodeValues: values = [] } =
    editor.getInjectProps(FontFamilyPlugin);

  const value = useSelectionFragmentProp({
    defaultValue: defaultNodeValue,
    getProp: (node) => node.fontFamily,
  });

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Detect cursor-level font (used as fallback if selection has mixed fonts)
  const cursorFont = useEditorSelector((editor) => {
    const fontMark = editor.api.marks()?.[KEYS.fontFamily];
    if (fontMark) return fontMark as string;
    const [block] = editor.api.block<TElement>() || [];
    return (block as any)?.fontFamily ?? undefined;
  }, []);

  // Determine display label and mixed state
  const selectedFont = value ?? undefined;
  const isMixed = selectedFont === undefined && cursorFont !== undefined && cursorFont !== defaultNodeValue;
  const displayLabel = selectedFont ?? cursorFont ?? defaultNodeValue;

  // Filter fonts based on search
  const filteredFonts = React.useMemo(() => {
    if (!search.trim()) return values;
    const searchLower = search.toLowerCase();
    return values.filter((font) => font.toLowerCase().includes(searchLower));
  }, [search, values]);

  // Reset search when dropdown closes
  React.useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  // Focus search input when dropdown opens
  React.useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  }, [open]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          className="ml-2 min-w-[140px] transition-colors duration-150"
          pressed={open}
          tooltip="Font family"
          isDropdown
        >
          {isMixed ? (
            <span className="italic text-sm text-muted-foreground truncate">Multiple</span>
          ) : (
            <span className="truncate text-sm" style={{ fontFamily: displayLabel }}>
              {displayLabel}
            </span>
          )}
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="ignore-click-outside/toolbar min-w-0 data-[state=open]:scale-100 data-[state=closed]:scale-95 transform transition-transform duration-150 ease-out"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          editor.tf.focus();
        }}
        align="start"
      >
        {/* Search Input */}
        <div className="sticky top-0 z-10 border-b bg-popover p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search fonts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full rounded-md border bg-background pl-8 pr-2 text-sm outline-none focus:ring-1 focus:ring-ring transition-shadow duration-150"
              onKeyDown={(e) => {
                // Prevent the dropdown from closing on escape
                if (e.key === 'Escape') {
                  if (search) {
                    e.stopPropagation();
                    setSearch('');
                  }
                }
                // Prevent PlateJS from handling arrow keys
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.stopPropagation();
                }
              }}
            />
          </div>
        </div>

        {/* Font List */}
        <div className="max-h-[350px] overflow-y-auto tiny-scrollbar">
          <ToolbarMenuGroup
            value={value}
            onValueChange={(newValue) => {
              editor
                .getTransforms(FontFamilyPlugin)
                .fontFamily.addMark(newValue);
              // close dropdown and focus editor for snappy UX
              setOpen(false);
              editor.tf.focus();
            }}
            label="Font family"
          >
            {filteredFonts.length > 0 ? (
              filteredFonts.map((fontFamily) => (
                <DropdownMenuRadioItem
                  key={fontFamily}
                  className="min-w-[200px] pl-2 *:first:[span]:hidden transition-colors duration-150 hover:bg-accent/5 data-[highlighted=true]:bg-accent/10"
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
              ))
            ) : (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                No fonts found
              </div>
            )}
          </ToolbarMenuGroup>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
