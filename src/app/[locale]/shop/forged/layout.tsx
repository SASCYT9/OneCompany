import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/**
 * One Company Forged shop layout.
 *
 * Brand identity is obsidian background with a subtle bronze accent.
 * Individual sections opt-in to `dark` scope, layout stays theme-aware
 * so the surrounding header/footer follow the active theme.
 */
export default function ShopForgedLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-background text-foreground forged-shop-page">{children}</div>
  );
}
