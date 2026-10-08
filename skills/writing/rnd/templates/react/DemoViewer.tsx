"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RndTheme } from "@/lib/rnd/types";
import styles from "./rnd.module.css";

interface ThemeRef {
  slug: string;
  name: string;
}

interface DemoViewerProps {
  theme: RndTheme;
  allThemes: ThemeRef[];
}

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function DemoViewer({ theme, allThemes }: DemoViewerProps): React.ReactElement {
  const router = useRouter();
  const [prdOpen, setPrdOpen] = useState(false);

  // The URL hash is the single source of truth for which scene is showing.
  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash.replace(/^#/, ""),
    () => "",
  );
  const idx =
    hash === "last"
      ? theme.scenes.length - 1
      : Math.max(
          0,
          theme.scenes.findIndex((s) => s.id === hash),
        );

  const themeIndex = allThemes.findIndex((t) => t.slug === theme.slug);
  const prevTheme = allThemes[themeIndex - 1];
  const nextTheme = allThemes[themeIndex + 1];
  const scene = theme.scenes[idx];

  const step = useCallback(
    (d: number) => {
      const target = idx + d;
      if (target < 0) {
        if (prevTheme) router.push(`/rnd/${prevTheme.slug}/demo#last`);
        return;
      }
      if (target >= theme.scenes.length) {
        if (nextTheme) router.push(`/rnd/${nextTheme.slug}/demo`);
        return;
      }
      window.location.hash = theme.scenes[target].id;
    },
    [idx, theme.scenes, prevTheme, nextTheme, router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "Escape") router.push("/rnd");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, router]);

  const atFirst = idx === 0;
  const atLast = idx === theme.scenes.length - 1;

  return (
    <div className={`${styles.root} ${styles.viewer}`}>
      <aside className={styles.aside}>
        <Link className={styles.mark} href="/rnd">
          R&amp;D <span className={styles.markProj}>Renovyn · demos by theme</span>
        </Link>
        <nav className={styles.nav}>
          {allThemes.map((t, i) => {
            const current = t.slug === theme.slug;
            return (
              <div key={t.slug}>
                {current ? (
                  <a className={styles.tlinkCur} href={`#${theme.scenes[0].id}`}>
                    <span className={styles.tn}>{String(i + 1).padStart(2, "0")}</span>
                    {t.name}
                  </a>
                ) : (
                  <Link className={styles.tlink} href={`/rnd/${t.slug}/demo`}>
                    <span className={styles.tn}>{String(i + 1).padStart(2, "0")}</span>
                    {t.name}
                  </Link>
                )}
                {current && (
                  <ul className={styles.scenes}>
                    {theme.scenes.map((s, j) => (
                      <li key={s.id}>
                        <a className={j === idx ? styles.slinkOn : styles.slink} href={`#${s.id}`}>
                          <span className={styles.dot} />
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
        <div className={styles.aft}>
          {allThemes.length} themes · <Link href="/rnd">all of R&amp;D</Link>
        </div>
      </aside>
      <main className={styles.main}>
        <div className={styles.stage}>
          <p className={styles.eyebrow}>
            {theme.name} · {idx + 1} of {theme.scenes.length}
          </p>
          <h1 className={styles.title}>{scene.title}</h1>
          <div className={styles.sketch} dangerouslySetInnerHTML={{ __html: scene.svg }} />
          <p className={styles.caption}>{scene.caption}</p>
          {scene.detail.length > 0 && (
            <details
              className={styles.prd}
              open={prdOpen}
              onToggle={(e) => setPrdOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className={styles.prdSummary}>From the PRD</summary>
              <ul className={styles.prdList}>
                {scene.detail.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </details>
          )}
          <p className={styles.src}>Source: {theme.prd}</p>
        </div>
        <footer className={styles.footer}>
          <div className={styles.fwrap}>
            <button
              className={styles.navBack}
              onClick={() => step(-1)}
              disabled={atFirst && !prevTheme}
            >
              {atFirst ? (prevTheme ? `← ${prevTheme.name}` : "←") : "← Previous"}
            </button>
            <span className={styles.hint}>
              <kbd className={styles.kbd}>←</kbd> <kbd className={styles.kbd}>→</kbd> to step ·
              themes continue across pages · <kbd className={styles.kbd}>Esc</kbd> all themes
            </span>
            <button
              className={styles.navNext}
              onClick={() => step(1)}
              disabled={atLast && !nextTheme}
            >
              {atLast ? (nextTheme ? `${nextTheme.name} →` : "→") : "Next →"}
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
