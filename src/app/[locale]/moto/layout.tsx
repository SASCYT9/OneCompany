import { ReactNode } from 'react';

export { generateMetadata } from './metadata';

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
