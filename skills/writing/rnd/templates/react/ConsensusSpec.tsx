"use client";

// Votable living spec → components/rnd/ConsensusSpec.tsx.
// Identity gate → hero → per-participant tracker → grouped pages (current vs
// planned, quote, technical note, wireframe, source refs) → vote/comment row.
// Votes/comments are live-shared via Convex (useSpec). Reproduces founder-x
// /rnd/platform-redesign in React + CSS modules.
import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { ConsensusData, RndPage, RndPanel, VoteStatus } from "@/lib/rnd/types";
import {
  getIdentitySnapshot,
  setIdentity,
  clearIdentity,
  subscribeIdentity,
} from "@/lib/rnd/identity";
import { useSpec } from "@/lib/rnd/useSpec";
import { IdentityGate } from "./IdentityGate";
import styles from "./consensus.module.css";

const PRIORITY_LABEL: Record<RndPage["priority"], string> = {
  must: "Must-have",
  should: "Should-have",
  nice: "Nice-to-have",
  new: "New build",
};

function Panel({ kind, label, panel }: { kind: "cur" | "plan"; label: string; panel?: RndPanel }) {
  if (!panel) return null;
  return (
    <div className={kind === "cur" ? styles.panelCur : styles.panelPlan}>
      <h4>{label}</h4>
      {panel.lead && <p className={styles.panelLead}>{panel.lead}</p>}
      <ul>
        {panel.points.map((pt) => (
          <li key={pt}>{pt}</li>
        ))}
      </ul>
    </div>
  );
}

export function ConsensusSpec({ data, project }: { data: ConsensusData; project: string }) {
  const peopleIds = useMemo(() => data.people.map((p) => p.id), [data.people]);
  const me = useSyncExternalStore(
    subscribeIdentity,
    () => getIdentitySnapshot(data.docId, peopleIds),
    () => null,
  );
  const spec = useSpec(data.docId);
  const [viewer, setViewer] = useState<{ doc: string; section: string } | null>(null);

  if (!me) {
    return (
      <div className={styles.root}>
        <IdentityGate
          people={data.people}
          avatarSvg={data.avatarSvg}
          onPick={(id) => setIdentity(data.docId, id)}
        />
      </div>
    );
  }

  const viewerDoc = viewer ? data.docs.find((d) => d.id === viewer.doc) : null;

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.hwrap}>
          <Link className={styles.mark} href="/rnd">
            R&amp;D <span className={styles.proj}>{project}</span>
          </Link>
          <div className={styles.who}>
            <span>Reading as</span>
            <b>{me}</b>
            <button onClick={() => clearIdentity(data.docId)}>Switch</button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <p className={styles.eyebrow}>
          {project} · R&amp;D · {data.topic}
        </p>
        <h1 className={styles.h1}>
          {data.headline}
          <span className={styles.h1sub}>{data.headlineSub}</span>
        </h1>
        <p className={styles.lede}>{data.lede}</p>

        {data.aligned.length > 0 && (
          <div className={styles.aligned}>
            {data.aligned.map((a) => (
              <div key={a.title} className={styles.alignedPt}>
                <b>{a.title}</b>
                <span>{a.body}</span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.tracker}>
          {data.people.map((p) => {
            const n = spec.votes.filter((v) => v.person === p.id && v.status === "approve").length;
            return (
              <div key={p.id} className={styles.person}>
                <b>{p.id}</b>
                <span>
                  {p.role} · {n}/{data.pages.length} approved
                </span>
              </div>
            );
          })}
        </div>

        {data.groups.map((g) => {
          const pages = data.pages.filter((p) => p.group === g.id);
          if (pages.length === 0) return null;
          return (
            <section key={g.id}>
              <h2 className={styles.groupH}>{g.label}</h2>
              {pages.map((p) => {
                const myVote = spec.votes.find((v) => v.pageId === p.id && v.person === me);
                const refs = data.pageRefs[p.id] ?? [];
                return (
                  <article key={p.id} className={styles.card}>
                    <span className={styles.area}>{p.area}</span>
                    <span className={styles[p.priority]}>{PRIORITY_LABEL[p.priority]}</span>
                    <h3 className={styles.cardTitle}>{p.title}</h3>
                    {p.svg && (
                      <div
                        className={styles.sketchWrap}
                        dangerouslySetInnerHTML={{ __html: p.svg }}
                      />
                    )}
                    <div className={styles.panels}>
                      <Panel kind="cur" label="Current" panel={p.current} />
                      <Panel kind="plan" label="Planned" panel={p.planned} />
                    </div>
                    {p.quote && (
                      <div className={styles.quote}>
                        &ldquo;{p.quote.text}&rdquo; <b>— {p.quote.who}</b>
                      </div>
                    )}
                    {p.architect && (
                      <p className={styles.arch}>
                        <b>Technical note</b> · {p.architect}
                      </p>
                    )}
                    {refs.length > 0 && (
                      <div className={styles.refs}>
                        {refs.map((r) => (
                          <button
                            key={`${r.doc}-${r.section}`}
                            onClick={() => setViewer({ doc: r.doc, section: r.section })}
                          >
                            {r.label} ↗
                          </button>
                        ))}
                      </div>
                    )}
                    <VoteRow
                      pageId={p.id}
                      me={me}
                      myStatus={myVote?.status ?? null}
                      myNote={myVote?.note ?? ""}
                      votes={spec.votes.filter((v) => v.pageId === p.id)}
                      comments={spec.comments.filter((c) => c.pageId === p.id)}
                      onVote={(status) => spec.setVote(p.id, me, status)}
                      onNote={(note) => spec.setNote(p.id, me, note)}
                      onComment={(text) => spec.addComment(p.id, me, text)}
                    />
                  </article>
                );
              })}
            </section>
          );
        })}

        <footer className={styles.footer}>
          Internal R&amp;D surface. Not indexed. Not for redistribution without permission.
        </footer>
      </main>

      {viewerDoc && (
        <div className={styles.viewer}>
          <div className={styles.viewerScrim} onClick={() => setViewer(null)} />
          <div className={styles.viewerSheet}>
            <button className={styles.viewerClose} onClick={() => setViewer(null)}>
              Close
            </button>
            <h3>{viewerDoc.title}</h3>
            <p className={styles.viewerSrc}>{viewerDoc.source}</p>
            {viewerDoc.sections.map((s) => (
              <section
                key={s.id}
                className={s.id === viewer?.section ? styles.viewerHit : undefined}
              >
                <h4>{s.heading}</h4>
                {s.body.map((b, i) => (
                  <p key={i}>{b}</p>
                ))}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface VoteRowProps {
  pageId: string;
  me: string;
  myStatus: VoteStatus;
  myNote: string;
  votes: { person: string; status: VoteStatus; note: string }[];
  comments: { id: string; author: string; text: string; ts: number }[];
  onVote: (status: VoteStatus) => void;
  onNote: (note: string) => void;
  onComment: (text: string) => void;
}

function VoteRow({
  myStatus,
  myNote,
  votes,
  comments,
  onVote,
  onNote,
  onComment,
}: VoteRowProps): React.ReactElement {
  const [draft, setDraft] = useState("");
  const btn = (status: Exclude<VoteStatus, null>, label: string) => (
    <button
      className={myStatus === status ? styles[`on_${status}`] : styles.vbtn}
      onClick={() => onVote(myStatus === status ? null : status)}
    >
      {label}
    </button>
  );
  return (
    <div className={styles.voteRow}>
      <div className={styles.btns}>
        {btn("approve", "Approve")}
        {btn("decline", "Needs discussion")}
        {btn("comment", "Commenting")}
      </div>
      <div className={styles.votes}>
        {votes.map((v) => (
          <span key={v.person} className={v.status ? styles[`v_${v.status}`] : styles.v}>
            {v.person}
            {v.status ? ` · ${v.status}` : ""}
            {v.note ? ` — ${v.note}` : ""}
          </span>
        ))}
      </div>
      <textarea
        className={styles.noteBox}
        rows={2}
        defaultValue={myNote}
        placeholder="A note next to your vote (everyone can read it)"
        onBlur={(e) => e.target.value !== myNote && onNote(e.target.value)}
      />
      <div className={styles.comments}>
        {comments.map((c) => (
          <div key={c.id} className={styles.comment}>
            <b>{c.author}</b>
            <time>{new Date(c.ts).toLocaleDateString()}</time>
            <br />
            {c.text}
          </div>
        ))}
      </div>
      <div className={styles.crow}>
        <textarea
          className={styles.cBox}
          rows={1}
          value={draft}
          placeholder="Add a comment…"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          onClick={() => {
            if (draft.trim()) {
              onComment(draft);
              setDraft("");
            }
          }}
        >
          Post
        </button>
      </div>
    </div>
  );
}
