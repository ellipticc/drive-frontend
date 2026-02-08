/**
 * Example Markdown content to test complete rendering pipeline
 * Tests all Markdown elements with custom design system components
 */

export const markdownTestContent = `
# Heading 1 - Main Title

This is a paragraph with **bold text**, *italic text*, and \`inline code\`.

## Heading 2 - Subsection

Here's another paragraph with a [link to Google](https://google.com) and more inline formatting.

### Heading 3 - Smaller Section

\`\`\`python
def hello_world():
    print("Hello, World!")
    return True

result = hello_world()
\`\`\`

\`\`\`javascript
const greet = (name) => {
  console.log(\`Hello, \${name}!\`);
  return true;
};

greet("Alice");
\`\`\`

> This is a blockquote. It can contain multiple lines
> and should render with a nice left border and background.

#### Lists Example

**Unordered List:**
- Item one with some text
- Item two with more content
  - Nested item under two
- Item three wraps up the list

**Ordered List:**
1. First step in the process
2. Second step follows
3. Third and final step

#### Table Example

| Feature | Support | Details |
|---------|---------|---------|
| Syntax Highlighting | ✓ | Via Shiki |
| Math Blocks | ✓ | KaTeX powered |
| Tables | ✓ | GFM extension |
| Task Lists | ✓ | Check boxes |

---

More content after a horizontal rule.

Inline \`code example\` and **bold** text in the same paragraph.

Math support: \\$E = mc^2\\$ for inline and:

\\$\\$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
\\$\\$

Done!
`;
