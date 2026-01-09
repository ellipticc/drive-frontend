import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ellipticc.com'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/auth/',
        '/backup/',
        '/pricing/',
        '/otp/',
        '/recover/',
        '/shared/',
        '/shared-with-me/',
        '/totp/',
        '/trash/',
        '/[...slug]/',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}