This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## SEO Configuration

This project includes comprehensive SEO optimizations:

- **Sitemap**: Automatically generated at `/sitemap.xml`
- **Robots.txt**: Configured for search engine crawling at `/robots.txt`
- **Meta Tags**: Open Graph, Twitter Cards, and structured data included
- **PWA Manifest**: Basic PWA support with `/manifest.json`

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
GOOGLE_SITE_VERIFICATION=your_google_verification_code
```

### SEO Features

- Dynamic sitemap generation
- Search engine crawling instructions
- Social media meta tags
- JSON-LD structured data
- Performance optimizations
- PWA manifest for mobile experience
