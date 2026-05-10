import "./ohlins-shop.css";

export default function OhlinsShopLayout({ children }: { children: React.ReactNode }) {
  return <div className="dark min-h-screen bg-[#0a0a0a] text-white">{children}</div>;
}
