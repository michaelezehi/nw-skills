// Consensus route → app/rnd/<slug>/page.tsx.
// Server component: imports the generated data module and renders the client
// spec. Replace <slug>/SLUG_DATA/Renovyn per artifact.
import type { Metadata } from "next";
import { ConsensusSpec } from "@/components/rnd/ConsensusSpec";
import { SLUG_DATA } from "@/lib/rnd/SLUG";

export const metadata: Metadata = {
  title: `${SLUG_DATA.topic} · R&D · Renovyn`,
  robots: { index: false, follow: false },
};

export default function ConsensusPage(): React.ReactElement {
  return <ConsensusSpec data={SLUG_DATA} project="Renovyn" />;
}
