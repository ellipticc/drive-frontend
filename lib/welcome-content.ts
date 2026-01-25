/**
 * Welcome paper content for new users
 * This content is created client-side with proper E2EE + PQC encryption
 */

import { uuidv7 } from "uuidv7-js";

export const WELCOME_PAPER_TITLE = "Welcome to Ellipticc Drive!";

export const WELCOME_PAPER_CONTENT = `# Welcome to Ellipticc Drive!

Your **post-quantum**, **end-to-end encrypted** cloud workspace.

This is a fully private space — everything is encrypted on your device before upload using battle-tested post-quantum algorithms. No one (not even us) can read your files or notes.

Explore the editor below, edit anything, delete it, or create new pages. This demo page auto-appears only once per workspace.

## Secure by Design

Write sensitive notes, plans, passwords, or ideas here with total confidence.

* **End-to-end encryption** — zero-knowledge architecture
* **Post-quantum cryptography** — safe from future quantum computers
* **Client-side only** — no server-side plaintext ever

Feel free to type your most private thoughts right now and watch them sync securely across devices.

## Colored Text 🎨

You can make text **stand out** using colors:

<span style="color: #FE0000;">Red text</span>, <span style="color: #00FF00;">green text</span>, <span style="color: #1300FF;">blue text</span>, even add some <span style="background-color: #9900FF;">background</span> colors!

Try <span style="color: #FF00FF;">changing</span> the <span style="color: #FEFF00;">colors yourself</span>!

## Try the Rich Editor - a.k.a. Ellipticc "Paper"

Press **/** for slash commands, drag & drop images/files, or use these shortcuts:

**Bold**, _italic_, <u>underline</u>, ~~strikethrough~~, \`inline code\`

* Bullet lists
  * Nested items

1. Numbered lists
   1. With nesting

> Blockquotes for emphasis or quotes:
> "Privacy isn't optional — it's the default here."

\`\`\`javascript
function hello() {
  console.info('Code blocks are supported!');
}
\`\`\`

Create links, @mention users, or insert emojis ✨. Use the slash command (/) for quick access to elements. 🚀

## To-do List:

* [x] Create my account
* [x] Save my seed phrase
* [x] Read this Paper
* [ ] Modify this Paper
* [ ] Finish the to-do list? 🤔

## Media & Files — All E2EE

Drag & drop images, PDFs, audio here. They'll stay encrypted at rest and in transit!

## Tables for Organized Notes

| Feature             | Ellipticc            | Traditional Cloud Drives |
| ------------------- | -------------------- | ------------------------ |
| E2EE                | ✅ Full client-side   | Often partial/server     |
| Post-Quantum Crypto | ✅ Kyber + Dilithium  | ❌ Vulnerable             |
| Zero-Knowledge      | ✅                    | Rare                     |
| Open Source         | ✅                    | Usually proprietary      |
| Price               | Free tier + generous | Paid for basics          |

## Technical Highlights ⚙️

Ellipticc Papers are built for **security, performance, and reliability**:

* **Block-based architecture** - Each Paper is made of independent blocks. Changes are tracked per block for efficiency and integrity.
* **Auto-save & versioning** - All your edits are saved automatically. Every version is stored, so you can always revert.
* **Secure diffing** - Block changes are hashed using **SHA-256** to detect modifications safely and efficiently.
* **Encryption & performance** - All content is encrypted client-side with **XChaCha20-Poly1305**. Heavy cryptography operations run in **Web Workers** for smooth editing without lag.

Experience **fast, safe, and collaborative editing** without sacrificing security.

## Get Started

* Delete this page anytime (on dashboard)
* Click **+ New Paper** to create your first real note
* Upload files/folders from your device
* Check docs: [docs.ellipticc.com](https://docs.ellipticc.com) or [blog.ellipticc.com](https://blog.ellipticc.com) for deep dives

Welcome aboard, your fortress in the cloud awaits! 🔐
`;

/**
 * Initial block content for the welcome paper
 * This creates a simple paragraph block with the markdown content
 */
export function getWelcomeBlockContent() {
    return [{
        id: uuidv7(),
        type: 'p',
        children: [{ text: WELCOME_PAPER_CONTENT }]
    }];
}
