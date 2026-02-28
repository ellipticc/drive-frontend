import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] px-4 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">404 - Page Not Found</h1>
        <p className="text-muted-foreground max-w-[600px] md:text-xl">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col gap-2 min-[400px]:flex-row justify-center">
          <Button asChild>
            <Link href="/">
              Go back home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}