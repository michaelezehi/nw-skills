"use client";

// Client viewer for one user-journey page. The URL hash is the source of
// truth for the visible act (deep-linkable per act and per section); ←/→ step
// the journey machine while it can still advance, then cross acts. Escape
// returns to the hub.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JourneyMachine, type JourneyMachineHandle } from "./JourneyMachine";
import type { JourneyPageData, JourneySection } from "@/lib/rnd/user-journeys/types";
import styles from "./user-journeys.module.css";

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

interface JourneyViewerProps {
  data: JourneyPageData;
  /** Where the header link and Escape go; defaults to the user-journeys hub. */
  back?: { href: string; label: string };
}

export function JourneyViewer({
  data,
  back = { href: "/rnd/user-journeys", label: "User Journeys" },
}: JourneyViewerProps): React.ReactElement {
  const router = useRouter();
  const machineRef = useRef<JourneyMachineHandle>(null);
  const [prdOpen, setPrdOpen] = useState(false);

  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash.replace(/^#/, ""),
    () => "",
  );

  // Resolve the hash to an act (act ids and section ids are both linkable).
  const sectionAct = new Map<string, number>();
  data.acts.forEach((act, i) => {
    sectionAct.set(act.id, i);
    act.sections.forEach((s) => sectionAct.set(s.id, i));
  });
  const actIndex = sectionAct.get(hash) ?? 0;
  const act = data.acts[actIndex];

  // When the hash names a section, scroll it into view once the act renders.
  useEffect(() => {
    if (!hash || data.acts.some((a) => a.id === hash)) return;
    const el = document.getElementById(hash);
    el?.scrollIntoView({ block: "start" });
  }, [hash, actIndex, data.acts]);

  const goToAct = useCallback(
    (i: number) => {
      if (i < 0 || i >= data.acts.length) return;
      window.location.hash = data.acts[i].id;
      window.scrollTo({ top: 0 });
    },
    [data.acts],
  );

  const step = useCallback(
    (d: number) => {
      // Let the machine consume the arrow while it can still move.
      if (machineRef.current?.step(d)) return;
      goToAct(actIndex + d);
    },
    [actIndex, goToAct],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "Escape") router.push(back.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, router, back.href]);

  const prevAct = data.acts[actIndex - 1];
  const nextAct = data.acts[actIndex + 1];

  const renderSection = (s: JourneySection): React.ReactElement => (
    <section key={s.id} id={s.id} className={styles.section}>
      <h2 className={styles.h2}>{s.title}</h2>
      {s.lede && <p className={styles.sectionLede}>{s.lede}</p>}
      {s.machine && (
        <JourneyMachine ref={machineRef} data={data.machine} defaultMode={s.machine} />
      )}
      {s.svg && <div className={styles.sketch} dangerouslySetInnerHTML={{ __html: s.svg }} />}
      {s.quote && <blockquote className={styles.quote}>&ldquo;{s.quote}&rdquo;</blockquote>}
      {s.chips && (
        <div className={styles.chips}>
          {s.chips.map((c) => (
            <span key={c.label} className={c.hero ? styles.chipHero : styles.chip}>
              {c.label}
            </span>
          ))}
        </div>
      )}
      {s.lists && (
        <div className={styles.lists}>
          {s.lists.map((l) => (
            <div key={l.title} className={styles.listCard}>
              <p className={styles.listTitle}>{l.title}</p>
              <ul>
                {l.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {s.table && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {s.table.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.table.rows.map((r, i) => (
                <tr key={`${r.cells[0]}-${i}`}>
                  {r.cells.map((cell) => (
                    <td key={cell}>{cell}</td>
                  ))}
                  {r.on !== undefined && (
                    <td>
                      <span className={r.on ? styles.stateOn : styles.stateOff}>
                        {r.on ? "On" : "Off"}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {s.caption && <p className={styles.caption}>{s.caption}</p>}
      {s.detail && s.detail.length > 0 && (
        <details
          className={styles.prd}
          open={prdOpen}
          onToggle={(e) => setPrdOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className={styles.prdSummary}>From the PRD</summary>
          <ul className={styles.prdList}>
            {s.detail.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.hwrap}>
          <Link className={styles.back} href={back.href}>
            ← {back.label}
          </Link>
          <span className={styles.mark}>
            <span
              className={styles.markIcon}
              aria-hidden
              dangerouslySetInnerHTML={{ __html: data.icon }}
            />
            {data.name}
          </span>
          <nav className={styles.actTabs} aria-label="Acts">
            {data.acts.map((a, i) => (
              <a
                key={a.id}
                className={i === actIndex ? styles.actTabOn : styles.actTab}
                href={`#${a.id}`}
              >
                {a.eyebrow}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <p className={styles.eyebrow}>
          Renovyn · R&amp;D · {data.name} · {act.eyebrow}
        </p>
        <h1 className={styles.h1}>{act.title}</h1>
        <p className={styles.lede}>{act.lede}</p>
        {act.sections.map(renderSection)}
        <p className={styles.src}>Source: {data.prd}</p>
      </main>

      <footer className={styles.footer}>
        <div className={styles.fwrap}>
          <button
            className={styles.navBack}
            onClick={() => goToAct(actIndex - 1)}
            disabled={!prevAct}
          >
            {prevAct ? `← ${prevAct.eyebrow}` : "←"}
          </button>
          <span className={styles.hint}>
            <kbd className={styles.kbd}>←</kbd> <kbd className={styles.kbd}>→</kbd> walk the
            journey, then cross acts · <kbd className={styles.kbd}>Esc</kbd> back to the hub
          </span>
          <button
            className={styles.navNext}
            onClick={() => goToAct(actIndex + 1)}
            disabled={!nextAct}
          >
            {nextAct ? `${nextAct.eyebrow} →` : "→"}
          </button>
        </div>
      </footer>
    </div>
  );
}
