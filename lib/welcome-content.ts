/**
 * Welcome paper content for new users
 * This content is created client-side with proper E2EE + PQC encryption
 * Content will be imported as markdown for proper formatting
 */

export const WELCOME_PAPER_TITLE = "Welcome to Ellipticc Drive!";

// Full markdown content with all features
export const WELCOME_PAPER_MARKDOWN = `# Welcome to Ellipticc Drive!

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

Create [links](/docs/link), [@mention](/docs/mention) users like [Alice](mention:Alice), or insert [emojis](/docs/emoji) ✨. Use the [slash command](/docs/slash-command) (/) for quick access to elements. 🚀

## To-do List:

* [x] <span style="font-size: 17px;">Create my account</span>
* [x] <span style="font-size: 17px;">Save my seed phrase</span>
* [x] <span style="font-size: 17px;">Read this Paper</span>
* [ ] <span style="font-size: 17px;">Modify this Paper</span>
* [ ] <span style="font-size: 17px;">Finish the to-do list?</span> 🤔

## Media & Files — All E2EE

Drag & drop images, PDFs, audio here. They'll stay encrypted at rest and in transit!

![OpenPeeps, that's what we use to generate your beautiful avatar!](https://cdn.prod.website-files.com/5e51b3b0337309d672efd94c/5e5346352c16e8d69e1649f2_cover_hero-1.svg "OpenPeeps, that's what we use to generate your beautiful avatar!")

_What we use to protect your data:_

<file name="whitepaper.pdf" position="0|i0007q:zzz" _id="null" src="https://cdn.ellipticc.com/whitepaper.pdf" />

<audio name="null" position="0|i0007q:zzzi" _id="null" src="https://cdn.ellipticc.com/welcome_.mp3" />

_And a warm welcoming message!_

#### Table of Contents

<toc />

## Tables for Organized Notes

| Feature             | Ellipticc            | Traditional Cloud Drives |
| ------------------- | -------------------- | ------------------------ |
| E2EE                | ✅ Full client-side   | Often partial/server     |
| Post-Quantum Crypto | ✅ Kyber + Dilithium  | ❌ Vulnerable             |
| Zero-Knowledge      | ✅                    | Rare                     |
| Open Source         | ✅                    | Usually proprietary      |
| Price               | Free tier + generous | Paid for basics          |

## Callout for Key Info

<callout variant="info" id="74TbTveeSM" position="0|i0007r:" _id>
  This entire page (and your whole workspace) is protected by post-quantum encryption. Test it: write something confidential, refresh, log out/in, it stays yours alone.
</callout>

## Dates & Quick Inserts

Today's date: <date>Sun Jan 25 2026</date> (auto-insert with /date)

Inline math if useful: $E = mc^2$ or block equations:
$\\text{Security} = \\text{E2EE} \\times \\text{PQC}$

### Multi-column Layout

<column_group _id="null" position="0|i0008v:">
  <column width="50%">
    First column content. Great for side-by-side comparisons.
  </column>
  <column width="50%">
    Second column content. Layout flexibility at its best.
  </column>
</column_group>

***

## Technical Highlights ⚙️

Ellipticc Papers are built for **security, performance, and reliability**:

* **Block-based architecture** - Each Paper is made of independent blocks. Changes are tracked per block for efficiency and integrity.
* **Auto-save & versioning** - All your edits are saved automatically. Every version is stored, so you can always revert.
  **Retention history by plan:**
  - _Free_ users: 7 days
  - _Plus_ users: 14 days
  - _Pro_ users: 30 days
  - _Unlimited_ users: 90 days
  [Upgrade your plan →](https://drive.ellipticc.com/pricing)
* **Secure diffing** - Block changes are hashed using **SHA-256** to detect modifications safely and efficiently.
* **Encryption & performance** - All content is encrypted client-side with **XChaCha20-Poly1305**. Heavy cryptography operations run in **Web Workers** for smooth editing without lag.

***

Experience **fast, safe, and collaborative editing** without sacrificing security.

## Get Started

* Delete this page anytime (on dashboard)
* Click **+ New Paper** to create your first real note
* Upload files/folders from your device
* Check docs: [docs.ellipticc.com](https://docs.ellipticc.com) or blog for deep dives

Welcome aboard, your fortress in the cloud awaits! 🔐
`;
