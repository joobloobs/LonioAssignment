import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Source Tax Onboarding",
  description: "Swiss source-tax tariff determination PoC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <span className="brand">Source Tax PoC</span>
            <nav>
              <Link href="/onboarding">Employee onboarding</Link>
              <Link href="/dashboard">HR dashboard</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
