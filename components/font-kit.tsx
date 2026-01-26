'use client';

import type { PlatePluginConfig } from 'platejs/react';

import {
  FontBackgroundColorPlugin,
  FontColorPlugin,
  FontFamilyPlugin,
  FontSizePlugin,
} from '@platejs/basic-styles/react';
import { KEYS } from 'platejs';

const options = {
  inject: { targetPlugins: [...KEYS.heading, KEYS.p] },
} satisfies PlatePluginConfig;

export const FontKit = [
  FontColorPlugin.configure({
    inject: {
      ...options.inject,
      nodeProps: {
        defaultNodeValue: 'black',
      },
    },
  }),
  FontBackgroundColorPlugin.configure(options),
  FontSizePlugin.configure(options),
  FontFamilyPlugin.configure({
    inject: {
      ...options.inject,
      nodeProps: {
        defaultNodeValue: 'Arial',
        validNodeValues: [
          'Arial',
          'Calibri',
          'Comic Sans MS',
          'Courier New',
          'Georgia',
          'Geist',
          'Helvetica',
          'Impact',
          'Lucida Console',
          'Monaco',
          'Palatino',
          'Roboto',
          'Tahoma',
          'Times New Roman',
          'Trebuchet MS',
          'Ubuntu',
          'Verdana',
          'sans-serif',
          'serif',
          'monospace',
        ],
      },
    },
  }),
];
