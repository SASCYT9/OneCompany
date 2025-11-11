import { redirect } from 'next/navigation';

type Props = {
  params: { rest?: string[] };
};

export default function LegacyCatchAll({ params }: Props) {
  const rest = params.rest ?? [];
  const path = rest.join('/');
  // Redirect any unmatched root-level path to default locale equivalent
  if (!path) {
    redirect('/ua');
  }
  redirect(`/ua/${path}`);
}
