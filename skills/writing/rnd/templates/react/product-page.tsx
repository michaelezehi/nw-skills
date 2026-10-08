// Product route → app/rnd/<slug>/page.tsx.
// Server component: imports the generated flow data and renders the client deck.
import type { Metadata } from "next";
import { ProductionFlow } from "@/components/rnd/ProductionFlow";
import { SLUG_FLOW } from "@/lib/rnd/SLUG";

export const metadata: Metadata = {
  title: `${SLUG_FLOW.topic} · R&D · Renovyn`,
  robots: { index: false, follow: false },
};

export default function ProductPage(): React.ReactElement {
  return <ProductionFlow data={SLUG_FLOW} project="Renovyn" />;
}
