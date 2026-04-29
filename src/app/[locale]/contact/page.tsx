import ContactPageContent from './ContactPageContent';

// ISR: render the client component at build time / on revalidation, cache
// the SSR'd HTML for 1 hour. The page itself has no per-request data.
export const revalidate = 3600;

export default function Page() {
  return <ContactPageContent />;
}
