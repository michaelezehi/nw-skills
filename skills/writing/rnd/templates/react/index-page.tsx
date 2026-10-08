import type { Metadata } from "next";
import Link from "next/link";
import { RND_THEMES } from "@/lib/rnd";
import styles from "@/components/rnd/rnd.module.css";

export const metadata: Metadata = {
  title: "R&D · Renovyn",
  robots: { index: false, follow: false },
};

export default function RndIndexPage(): React.ReactElement {
  return (
    <div className={styles.root}>
      <header className={styles.idxHeader}>
        <div className={styles.idxHwrap}>
          <Link className={styles.idxMark} href="/rnd">
            R&amp;D <span className={styles.idxProj}>Renovyn</span>
          </Link>
          <Link className={styles.idxExt} href="/">
            Main site ↗
          </Link>
        </div>
      </header>
      <main className={styles.idxMain}>
        <p className={styles.eyebrow}>Renovyn · R&amp;D</p>
        <h1 className={styles.idxH1}>
          Where we think out loud <span className={styles.idxSub}>about what we&rsquo;re building.</span>
        </h1>
        <p className={styles.idxLede}>
          Living briefs and visual prototypes from the team. Each entry is a single, shareable
          page, written for clarity rather than marketing.
        </p>
        <div className={styles.idxListHead}>
          <h2>Briefs &amp; prototypes</h2>
          <p className={styles.idxCount}>{RND_THEMES.length} entries</p>
        </div>
        <ul className={styles.idxEntries}>
          {RND_THEMES.map((t) => (
            <li key={t.slug}>
              <Link className={styles.entry} href={`/rnd/${t.slug}/demo`}>
                <span
                  className={styles.entryIcon}
                  dangerouslySetInnerHTML={{ __html: t.icon }}
                />
                <span>
                  <span className={styles.entryRow}>
                    <h3>{t.name}</h3>
                    <span className={styles.chip}>Live</span>
                  </span>
                  <p>{t.summary}</p>
                </span>
                <span className={styles.entryMeta}>
                  <span>June 2026</span>
                  <span className={styles.arrow}>→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <footer className={styles.idxFooter}>
          Internal R&amp;D surface. Not indexed. Not for redistribution without permission.
        </footer>
      </main>
    </div>
  );
}
