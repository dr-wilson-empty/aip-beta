import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/ui/Nav";
import DemoBanner, { DEMO_BANNER_HEIGHT } from "@/components/ui/DemoBanner";
import WalletProvider from "@/components/connect/WalletProvider";
import WalletSync from "@/components/connect/WalletSync";

export const metadata: Metadata = {
  title: "AIP — Agent Internet Protocol",
  description:
    "A foundational open protocol for the agentic web. Discover, negotiate, and settle payments between AI agents.",
  icons: {
    icon: "/favicon.ico",
    apple: "/aipLogo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-mono min-h-screen" style={{ backgroundColor: "#e6e5e0", color: "#000000" }} suppressHydrationWarning>
        <WalletProvider>
          <WalletSync />
          <DemoBanner />
          <Nav />
          <main style={{ paddingTop: 63 + DEMO_BANNER_HEIGHT }}>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
