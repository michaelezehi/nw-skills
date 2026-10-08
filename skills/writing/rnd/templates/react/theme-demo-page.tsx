import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  if (!data) notFound();
  return (
    <DemoViewer
      theme={data}
      allThemes={RND_THEMES.map((t) => ({ slug: t.slug, name: t.name }))}
    />
  );
}
