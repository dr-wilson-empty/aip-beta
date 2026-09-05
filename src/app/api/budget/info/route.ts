import { NextResponse } from "next/server";
import { getAuthorityAddress, isEscrowEnabled } from "@/lib/payment/authority";

/**
 * GET /api/budget/info
 * Returns platform authority address and USDC mint for frontend deposits.
 */
export async function GET() {
  // Tells the frontend where to send a deposit. With escrow off there is
  // nothing to settle against, so handing out an address would be the worst
  // possible answer.
  if (!isEscrowEnabled()) {
    return NextResponse.json(
      { error: "Escrow is disabled on this deployment", escrowEnabled: false },
      { status: 503 }
    );
  }

  const mint = process.env.USDC_MINT_DEVNET;
  if (!mint) {
    return NextResponse.json({ error: "Platform not configured" }, { status: 500 });
  }

  return NextResponse.json({
    authorityAddress: getAuthorityAddress(),
    usdcMint: mint,
  });
}
