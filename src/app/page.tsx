import { redirect } from 'next/navigation'

// Root page redirects to default locale (ua)
// Middleware handles geo-detection; this is a fallback
export default function Home() {
  redirect('/ua')
}
