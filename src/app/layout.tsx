import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIP — Agent Internet Protocol",
  description:
    "A foundational open protocol for the agentic web. Discover, negotiate, and settle payments between AI agents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-bg-base text-off-white font-mono min-h-screen">
        {children}
      </body>
    </html>
  );
}
