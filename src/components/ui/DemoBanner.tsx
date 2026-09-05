/**
 * Permanent testnet-demo notice, pinned above the navigation.
 *
 * This deployment cannot move funds: the escrow authority is switched off at
 * the source (src/lib/payment/authority.ts). That fact belongs on every page,
 * not in a README nobody reads before connecting a wallet.
 *
 * The nav is `fixed top-0 z-50`, so this bar is also fixed, sits above it on
 * z-index, and everything below is offset by DEMO_BANNER_HEIGHT.
 */
export const DEMO_BANNER_HEIGHT = 28;

export default function DemoBanner() {
  return (
    <div
      role="note"
      aria-label="Deployment status"
      className="fixed top-0 left-0 right-0 z-[60] font-mono"
      style={{
        height: DEMO_BANNER_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        fontSize: 11,
        letterSpacing: "0.03em",
        backgroundColor: "#1c1c1a",
        color: "#f5f4ef",
        padding: "0 12px",
      }}
    >
      <strong style={{ fontWeight: 600 }}>TESTNET DEMO</strong>
      <span style={{ opacity: 0.8 }}>escrow disabled, no funds move — superseded by</span>
      <a
        href="https://github.com/wienerlabs/mandate"
        target="_blank"
        rel="noreferrer"
        style={{ color: "#f5f4ef", textDecoration: "underline", textUnderlineOffset: 2 }}
      >
        wienerlabs/mandate
      </a>
    </div>
  );
}
