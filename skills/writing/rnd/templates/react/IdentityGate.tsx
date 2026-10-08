"use client";

// The participant intro page → components/rnd/IdentityGate.tsx.
// Full-screen "Who are you?" picker over the consensus PEOPLE. One shared
// hand-drawn avatar (Sketches output) is reused for every participant.
import type { RndPerson } from "@/lib/rnd/types";
import styles from "./consensus.module.css";

interface IdentityGateProps {
  people: RndPerson[];
  avatarSvg: string;
  onPick: (id: string) => void;
}

export function IdentityGate({ people, avatarSvg, onPick }: IdentityGateProps): React.ReactElement {
  return (
    <div className={styles.gate} role="dialog" aria-modal="true" aria-labelledby="rnd-gate-title">
      <div className={styles.gateScrim} />
      <div className={styles.gateInner}>
        <p className={styles.gateEyebrow}>Step 1 · Sign-in lite</p>
        <h2 id="rnd-gate-title" className={styles.gateTitle}>
          Who are you?
        </h2>
        <p className={styles.gateSub}>
          Pick your character — you&rsquo;ll vote and comment as them. Saved to this link.
        </p>
        <div className={styles.gateGrid}>
          {people.map((p) => (
            <button key={p.id} className={styles.pick} onClick={() => onPick(p.id)}>
              <span className={styles.av} dangerouslySetInnerHTML={{ __html: avatarSvg }} />
              <span>
                <b className={styles.pickName}>{p.id}</b>
                <span className={styles.pickRole}>{p.codename ?? p.role}</span>
              </span>
            </button>
          ))}
        </div>
        <p className={styles.gateHint}>No password — switch anytime from the header.</p>
      </div>
    </div>
  );
}
