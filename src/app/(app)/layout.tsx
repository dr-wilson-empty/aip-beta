import Nav from "@/components/ui/Nav";
import WalletProvider from "@/components/connect/WalletProvider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletProvider>
      <Nav />
      <main className="pt-14">{children}</main>
    </WalletProvider>
  );
}
