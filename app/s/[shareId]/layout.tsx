import { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
    const baseUrl = 'https://drive.ellipticc.com';
    const imageUrl = `${baseUrl}/og-share.png`;

    return {
        metadataBase: new URL(baseUrl),
        title: 'Shared File - Ellipticc Drive',
        description: 'Secure, end-to-end encrypted file shared via Ellipticc Drive.',
        openGraph: {
            title: 'Shared File - Ellipticc Drive',
            description: 'Secure, end-to-end encrypted file shared via Ellipticc Drive.',
            url: baseUrl,
            siteName: 'Ellipticc Drive',
            images: [
                {
                    url: imageUrl,
                    width: 1200,
                    height: 630,
                    alt: 'Shared File - Ellipticc Drive',
                },
            ],
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: 'Shared File - Ellipticc Drive',
            description: 'Secure, end-to-end encrypted file shared via Ellipticc Drive.',
            images: [imageUrl],
        },
    };
}

export default function ShareLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
