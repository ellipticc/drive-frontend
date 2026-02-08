/**
 * Streamdown Shiki Code Plugin
 * 
 * Replaces the default @streamdown/code plugin with our Shiki-powered version.
 * Integrates async highlighting while maintaining Streamdown's API.
 */

'use client';

import React from 'react';
import { ShikiCodeBlock } from '@/components/ai-elements/shiki-code-block';

export interface CodePluginOptions {
  lineNumbers?: boolean;
  highlightLines?: number[];
}

/**
 * Create a Streamdown plugin for Shiki-powered code blocks
 */
export function createShikiCodePlugin(options?: CodePluginOptions) {
  return {
    name: 'shiki-code',
    test: (node: any) => {
      return node.type === 'code';
    },
    component: ({ node }: { node: any }) => {
      const code = node.content || '';
      const language = (node.meta?.language || node.meta || '') as string;

      return React.createElement(ShikiCodeBlock, {
        code,
        language,
        inline: false,
      });
    },
  };
}

/**
 * Factory function to create a combined code plugin
 * Can be used with Streamdown to replace the default code plugin
 */
export function createCustomCodeRenderer(
  defaultCodePlugin?: any,
  options?: CodePluginOptions
) {
  const shikiPlugin = createShikiCodePlugin(options);

  return {
    ...defaultCodePlugin,
    component: ({ node }: { node: any }) => {
      if (node.type === 'code') {
        return shikiPlugin.component({ node });
      }
      return defaultCodePlugin?.component?.({ node });
    },
  };
}
