'use client';

import { cn } from '@/lib/utils';

import { Toolbar } from './toolbar';

export function FixedToolbar(props: React.ComponentProps<typeof Toolbar>) {
  return (
    <Toolbar
      {...props}
      className={cn(
        'scrollbar-hide sticky top-0 left-0 z-50 w-full justify-between overflow-x-auto border-b border-b-border bg-background/95 backdrop-blur-sm supports-backdrop-blur:bg-background/60 py-1 md:py-2 px-2 md:px-4 -webkit-overflow-scrolling-touch',
        props.className
      )}
    />
  );
}
