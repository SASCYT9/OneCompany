import { redirect } from 'next/navigation';

export default function LegacyMessagesRedirect() {
  redirect('/admin?panel=messages');
}
