import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DemoViewer } from "@/components/rnd/DemoViewer";
import { RND_THEMES } from "@/lib/rnd";

interface PageProps {
  params: Promise<{ theme: string }>;
}

export function generateStaticParams(): { theme: string }[] {
  return RND_THEMES.map((t) => ({ theme: t.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { theme } = await params;
  const data = RND_THEMES.find((t) => t.slug === theme);
  return {
    title: data ? `${data.name} · R&D · Renovyn` : "R&D · Renovyn",
    robots: { index: false, follow: false },
  };
}

export default async function RndThemeDemoPage({ params }: PageProps): Promise<React.ReactElement> {
  const { theme } = await params;
  const data = RND_THEMES.find((t) => t.slug === theme);
  // /rnd/<brief>/demo also lands here: the [theme] segment matches any slug.
  // Never 404 inside /rnd. A brief with its own page (app/rnd/<slug>/page.tsx,
  // listed with an href on the index) has no demo, so go to the index.
  if (!data) redirect("/rnd");
  return (
    <DemoViewer
      theme={data}
      allThemes={RND_THEMES.map((t) => ({ slug: t.slug, name: t.name }))}
    />
  );
}
