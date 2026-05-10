import "../adro/adro-shop.css";

export default function AdroLayout({ children }: { children: React.ReactNode }) {
  return <div className="dark">{children}</div>;
}
