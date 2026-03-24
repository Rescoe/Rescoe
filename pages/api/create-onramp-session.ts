import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_PRIVATE!);

const OnrampSessionResource = Stripe.StripeResource.extend({
  create: Stripe.StripeResource.method({
    method: "POST",
    path: "crypto/onramp_sessions",
  }),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { walletAddress } = req.body;

    // ✅ ANY CAST (beta API pas typée)
    const session: any = await new OnrampSessionResource(stripe).create({
      transaction_details: {
        destination_currency: "eth",
        destination_exchange_amount: "0.01",
        destination_network: "base",
        supported_destination_networks: ["base"],
        wallet_address: walletAddress,
      },
      customer_ip_address: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || "127.0.0.1",
    });

    res.json({ clientSecret: session.client_secret });
  } catch (error: any) {
    console.error("❌", error.message);
    res.status(500).json({ error: error.message });
  }
}
