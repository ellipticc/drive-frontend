'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { IconQuoteFilled } from '@tabler/icons-react';

interface TextSelectionMenuProps {
  onAddToChat: (text: string) => void;
}

export const TextSelectionMenu: React.FC<TextSelectionMenuProps> = ({ onAddToChat }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      const selectedText = window.getSelection()?.toString().trim();

      if (selectedText && selectedText.length > 0) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          // Position menu directly over the selected text
          setPosition({
            x: rect.left + rect.width / 2,
            y: rect.top
          });
          setIsVisible(true);
        }
      } else {
        setIsVisible(false);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleAddToChat = () => {
    const selectedText = window.getSelection()?.toString().trim();
    if (selectedText) {
      onAddToChat(selectedText);
      setIsVisible(false);
      window.getSelection()?.removeAllRanges();
    }
  };

  if (!isVisible) return null;

  return (
    <button
      ref={menuRef}
      onClick={handleAddToChat}
      className={cn(
        'fixed z-50 flex items-center gap-1.5 bg-popover border border-border rounded-lg shadow-lg px-3 py-2',
        'animate-in fade-in zoom-in-95 duration-200 text-sm font-medium',
        'text-primary bg-primary/10 hover:bg-primary/20 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary/50'
      )}
      style={{
        left: `calc(${position.x}px - 50%)`,
        top: `${position.y}px`,
        transform: 'translateY(-100%) translateY(-8px)'
      }}
      title="Add selected text to chat input as a follow-up"
    >
      <IconQuoteFilled className="w-4 h-4" />
      <span>Add to chat</span>
    </button>
  );
};

TextSelectionMenu.displayName = 'TextSelectionMenu';
