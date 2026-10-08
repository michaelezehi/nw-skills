"use client";

// Screen-by-screen build deck → components/rnd/ProductionFlow.tsx.
// Hash-routed (one slide at a time, #<screenId> deep-linkable), sticky contents
// rail, intro with the exec summary + screen index, per-screen technical call.
// Reproduces founder-x /rnd/production-flow in React + CSS modules.
import { useSyncExternalStore } from "react";
import Link from "next/link";
import type { ProductData, RndScreen } from "@/lib/rnd/types";
import styles from "./product.module.css";

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function ProductionFlow({ data, project }: { data: ProductData; project: string }) {
  const slugs = ["intro", ...data.screens.map((s) => s.id)];
  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash.replace(/^#/, ""),
    () => "intro",
  );
  const slug = slugs.includes(hash) ? hash : "intro";
  const idx = slugs.indexOf(slug);
  const screen = data.screens.find((s) => s.id === slug);
  const go = (s: string) => {
    window.location.hash = s;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const prev = idx > 0 ? slugs[idx - 1] : null;
  const next = idx < slugs.length - 1 ? slugs[idx + 1] : null;
  const hasDemo = new Set(data.flowsWithDemo);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.hwrap}>
          <Link className={styles.mark} href="/rnd">
            R&amp;D <span className={styles.proj}>{project}</span>
          </Link>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.grid}>
          <aside className={styles.rail}>
            <div className={styles.railSticky}>
              <button
                className={slug === "intro" ? styles.railOvOn : styles.railOv}
                onClick={() => go("intro")}
              >
                Overview
              </button>
              {data.screens.map((s) => (
                <button
                  key={s.id}
                  className={slug === s.id ? styles.railOn : styles.railBtn}
                  onClick={() => go(s.id)}
                >
                  <span className={styles.n}>{s.n}</span>
                  <span className={styles.railName}>{s.name}</span>
                </button>
              ))}
            </div>
          </aside>
          <div className={styles.col}>
            <div className={styles.mpick}>
              <select value={slug} onChange={(e) => go(e.target.value)}>
                <option value="intro">Overview</option>
                {data.screens.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.n}. {s.name}
                  </option>
                ))}
              </select>
            </div>

            {screen ? (
              <Slide screen={screen} total={data.screens.length} hasDemo={hasDemo.has(screen.id)} />
            ) : (
              <Intro data={data} project={project} hasDemoSet={data.flowsWithDemo.length > 0} />
            )}

            <div className={styles.pager}>
              <button className={styles.back} disabled={!prev} onClick={() => prev && go(prev)}>
                ← Back
              </button>
              <span className={styles.pos}>
                {idx === 0 ? "Overview" : `${idx} / ${data.screens.length}`}
              </span>
              <button className={styles.next} disabled={!next} onClick={() => next && go(next)}>
                Next →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Intro({
  data,
  project,
  hasDemoSet,
}: {
  data: ProductData;
  project: string;
  hasDemoSet: boolean;
}): React.ReactElement {
  return (
    <div>
      <p className={styles.eyebrow}>
        {project} · R&amp;D · {data.topic}
      </p>
      <h1 className={styles.h1}>
        What we&rsquo;re building<span className={styles.h1sub}>screen by screen.</span>
      </h1>
      <p className={styles.lede}>{data.introLede}</p>
      <div className={styles.summary}>
        <h4>In one paragraph</h4>
        <p>{data.execSummary}</p>
      </div>
      <div className={styles.duo}>
        <div>
          <h4>How to read this</h4>
          <p>
            Step through the screens with the arrows or the list. Each is a self-contained brief —
            wireframe on the left; build scope and the technical call on the right. Share the link to
            any single screen.
          </p>
        </div>
        <div className={styles.warn}>
          <h4>Before we build</h4>
          <p>{data.beforeWeBuild}</p>
        </div>
      </div>
      <div className={styles.idx}>
        {data.screens.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            <span className={styles.idxN}>{s.n}</span>
            <span style={{ minWidth: 0 }}>
              <b>{s.name}</b>
              <span className={styles.idxI}>{s.intent}</span>
            </span>
          </a>
        ))}
      </div>
      <div className={styles.ctas}>
        <a className={styles.ctaPri} href={`#${data.screens[0]?.id ?? ""}`}>
          Start the flow →
        </a>
        {hasDemoSet && (
          <Link className={styles.ctaHero} href={`/rnd/${data.slug}/demo`}>
            Walk the interactive demo →
          </Link>
        )}
        {data.consensusSlug && (
          <Link className={styles.ctaSec} href={`/rnd/${data.consensusSlug}`}>
            Open the votable spec
          </Link>
        )}
      </div>
    </div>
  );
}

function Slide({
  screen,
  total,
  hasDemo,
}: {
  screen: RndScreen;
  total: number;
  hasDemo: boolean;
}): React.ReactElement {
  return (
    <div className={styles.slide}>
      <div className={styles.sketchCol}>
        {screen.svg && <div dangerouslySetInnerHTML={{ __html: screen.svg }} />}
        {screen.caption && <p className={styles.scap}>{screen.caption}</p>}
      </div>
      <div>
        <span className={styles.snum}>
          Screen {screen.n} / {total}
        </span>
        <h2 className={styles.slideH2}>{screen.name}</h2>
        {screen.term && <p className={styles.term}>{screen.term}</p>}
        <p className={styles.intent}>{screen.intent}</p>
        <p className={styles.context}>{screen.context}</p>
        <div className={styles.bl}>
          <h4>What we&rsquo;re building</h4>
          <ul>
            {screen.build.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
        <div className={styles.rec}>
          <h4>Technical call</h4>
          <p>{screen.rec}</p>
        </div>
        {screen.open && <p className={styles.open}>Resolves: {screen.open}</p>}
        {hasDemo && (
          <a className={styles.demoLink} href={`demo#${screen.id}`}>
            Open the interactive demo →
          </a>
        )}
      </div>
    </div>
  );
}
