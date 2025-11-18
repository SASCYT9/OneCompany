import NewMessagesPage from './NewMessagesPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Messages',
  manifest: '/admin-manifest.json',
};

export default function Page() {
  return <NewMessagesPage />;
}
