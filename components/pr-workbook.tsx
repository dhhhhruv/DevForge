"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    Circle,
    Clock,
    ExternalLink,
    Github,
    GitPullRequest,
    ListOrdered,
    Lock,
    LogOut,
    PenLine,
    RefreshCw,
    RotateCcw,
    Scale,
    ShieldCheck,
} from "lucide-react";
import { milestones, reflectionTemplate, rules, workbookMeta, ARENA_LABELS, type Arena } from "@/data/pr-workbook";
import { isMilestoneUnlocked, type JourneyEntry, type JourneyRecord, type PRState } from "@/lib/pr-journey";
import type { GithubIdentity } from "@/lib/github-auth";

const SIGN_IN_HREF = "/api/auth/github?next=/learn/open-source";

/** What to say when GitHub sends someone back without a session. */
const SIGN_IN_OUTCOMES: Record<string, string> = {
    denied: "Sign-in was cancelled on GitHub, so nothing was shared.",
    failed: "GitHub sign-in did not complete. Try again.",
    unconfigured: "GitHub sign-in is not switched on for this site yet.",
};

const ARENA_STYLES: Record<Arena, string> = {
    workbook: "bg-neutral-500/10 text-neutral-300 border-neutral-500/20",
    club: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    external: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20",
};

const PR_STATE_STYLES: Record<PRState, string> = {
    merged: "text-purple-300",
    open: "text-green-400",
    closed: "text-red-400",
};

const EMPTY_FORM = {
    url: "",
    tried: "",
    broke: "",
    reviewerSaid: "",
    differently: "",
    hours: "",
    rounds: "",
    status: "merged" as PRState,
};

type FormState = typeof EMPTY_FORM;

/** Renders `backticked` spans in a step as inline code. */
function withCode(text: string) {
    return text.split("`").map((part, i) =>
        i % 2 ? (
            <code key={i} className="font-mono [font-variant-ligatures:none] text-[12.5px] text-cyan-200 bg-neutral-800/80 px-1.5 py-0.5 rounded">
                {part}
            </code>
        ) : (
            part
        ),
    );
}

export function PRWorkbook() {
    const [journey, setJourney] = useState<JourneyRecord | null>(null);
    const [identity, setIdentity] = useState<GithubIdentity | null>(null);
    const [authed, setAuthed] = useState<boolean | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [openForm, setOpenForm] = useState<number | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    /** Non-null only for members who can sign milestones off; the API decides, not the UI. */
    const [queueSize, setQueueSize] = useState<number | null>(null);
    const [statusNote, setStatusNote] = useState<{ n: number; text: string } | null>(null);

    useEffect(() => {
        let live = true;
        fetch("/api/pr-journey")
            .then(async (r) => {
                if (!live) return;

                // GitHub sends people back with ?github=<outcome> when sign-in
                // did not produce a session. Say so once, then tidy the URL so
                // a refresh or a shared link does not repeat the message.
                const outcome = new URLSearchParams(window.location.search).get("github");
                if (outcome) {
                    setNotice(SIGN_IN_OUTCOMES[outcome] ?? null);
                    window.history.replaceState(null, "", window.location.pathname);
                }

                if (r.status === 401) {
                    setAuthed(false);
                    return;
                }
                const data = await r.json();
                setAuthed(true);
                setIdentity(data.identity as GithubIdentity);
                setJourney(data.journey as JourneyRecord);
            })
            .catch(() => live && setAuthed(false));
        // Whether this member is a reviewer is a question only the server can
        // answer, so ask it rather than re-deriving capabilities on the client.
        fetch("/api/pr-journey/review")
            .then(async (r) => {
                if (!live || !r.ok) return;
                const data = await r.json();
                setQueueSize((data.pending ?? []).length);
            })
            .catch(() => {});

        return () => {
            live = false;
        };
    }, []);

    const entries = journey?.entries ?? {};
    const entryFor = (n: number): JourneyEntry | undefined => entries[String(n)];
    const signedOff = Object.values(entries).filter((e) => e.state === "signed-off").length;

    /**
     * The ladder is the product, so it is enforced rather than suggested: a
     * milestone opens only once the one before it is signed off. Nobody jumps
     * to a feature PR in a stranger's repo in week one.
     */
    const isUnlocked = (n: number) => isMilestoneUnlocked(entries, n);

    async function submit(n: number) {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch(`/api/pr-journey/${n}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: form.url,
                    reflection: {
                        tried: form.tried,
                        broke: form.broke,
                        reviewerSaid: form.reviewerSaid,
                        differently: form.differently,
                        hours: Number(form.hours),
                        rounds: Number(form.rounds),
                        status: form.status,
                    },
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                setError(data.message ?? "That did not go through.");
                return;
            }
            setJourney((prev) =>
                prev ? { ...prev, entries: { ...prev.entries, [String(n)]: data.entry } } : prev,
            );
            setOpenForm(null);
            setForm(EMPTY_FORM);
        } finally {
            setBusy(false);
        }
    }

    /**
     * Asks GitHub what the linked PR looks like now. A submission made while the
     * PR was open should not sit on the record as "open" forever.
     */
    async function recheck(n: number) {
        setBusy(true);
        try {
            const response = await fetch(`/api/pr-journey/${n}`, { method: "PATCH" });
            const data = await response.json();
            if (!response.ok) return;
            setJourney((prev) =>
                prev ? { ...prev, entries: { ...prev.entries, [String(n)]: data.entry } } : prev,
            );
            setStatusNote({ n, text: data.message });
        } finally {
            setBusy(false);
        }
    }

    async function signOut() {
        await fetch("/api/auth/github/logout", { method: "POST" });
        setIdentity(null);
        setJourney(null);
        setOpenForm(null);
        setAuthed(false);
    }

    async function withdraw(n: number) {
        await fetch(`/api/pr-journey/${n}`, { method: "DELETE" });
        setJourney((prev) => {
            if (!prev) return prev;
            const next = { ...prev.entries };
            delete next[String(n)];
            return { ...prev, entries: next };
        });
    }

    return (
        <div className="min-h-screen bg-transparent text-white pt-4 pb-16">
            <div className="max-w-3xl mx-auto px-4">
                {/* Progress / sign-in */}
                {queueSize !== null && (
                    <Link
                        href="/dashboard/journey"
                        className="inline-flex items-center gap-1.5 mb-4 text-xs font-semibold text-cyan-300 bg-cyan-400/10 border border-cyan-400/25 hover:border-cyan-400/60 rounded-lg px-3 py-1.5 transition-colors"
                    >
                        <ShieldCheck size={13} />
                        Sign-off queue
                        <span className="font-mono text-cyan-400/70">{queueSize} waiting</span>
                    </Link>
                )}

                {authed === false ? (
                    <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 mb-12">
                        <div className="font-semibold text-white mb-1">Start the journey with GitHub</div>
                        <p className="text-sm text-neutral-400 leading-relaxed mb-2">
                            Open to anyone with a GitHub account — you do not need to be a club member. Your milestones
                            are tracked against the account you sign in with, and every one is backed by a link we check
                            against it, so what you end up with is a record somebody else can verify.
                        </p>
                        <p className="text-xs text-neutral-500 mb-4">
                            We read your public profile only. No access to your repositories is requested.
                        </p>
                        {notice && (
                            <p className="text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2 mb-4">
                                {notice}
                            </p>
                        )}
                        <a
                            href={SIGN_IN_HREF}
                            className="inline-flex items-center gap-2 text-sm font-semibold bg-white text-black hover:bg-neutral-200 rounded-xl px-4 py-2 transition-colors"
                        >
                            <Github size={16} />
                            Sign in with GitHub
                        </a>
                    </div>
                ) : (
                    <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 mb-12">
                        {identity && (
                            <div className="flex items-center justify-between gap-3 mb-4 pb-4 border-b border-neutral-800">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={identity.avatar}
                                        alt=""
                                        width={28}
                                        height={28}
                                        className="rounded-full border border-neutral-700 flex-shrink-0"
                                    />
                                    <span className="text-sm text-neutral-400 truncate">
                                        Signed in as <span className="font-mono text-white">@{identity.login}</span>
                                    </span>
                                </div>
                                <button
                                    onClick={signOut}
                                    className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors flex-shrink-0"
                                >
                                    <LogOut size={12} /> Sign out
                                </button>
                            </div>
                        )}
                        <div className="flex items-baseline justify-between mb-3">
                            <span className="text-sm text-neutral-400">Milestones signed off</span>
                            <span className="text-sm font-mono text-cyan-300">
                                {signedOff} / {milestones.length}
                            </span>
                        </div>
                        <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${(signedOff / milestones.length) * 100}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                        <p className="text-xs text-neutral-500 mt-3">{workbookMeta.cadence}</p>
                    </div>
                )}

                {/* Rules */}
                <div className="mb-14">
                    <div className="flex items-center gap-2 mb-5">
                        <Scale size={18} className="text-cyan-400" />
                        <h2 className="text-xl font-bold">The six rules</h2>
                    </div>
                    <div className="space-y-3">
                        {rules.map((r) => (
                            <div key={r.rule} className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4">
                                <div className="font-semibold text-white mb-1">{r.rule}</div>
                                <div className="text-sm text-neutral-400 leading-relaxed">{r.why}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Milestones */}
                <div className="flex items-center gap-2 mb-5">
                    <GitPullRequest size={18} className="text-cyan-400" />
                    <h2 className="text-xl font-bold">The ten milestones</h2>
                </div>

                <div className="space-y-4 mb-14">
                    {milestones.map((m) => {
                        const entry = entryFor(m.n);
                        const unlocked = authed ? isUnlocked(m.n) : true;
                        const done = entry?.state === "signed-off";
                        const bounced = entry?.state === "changes-requested";

                        return (
                            <div
                                key={m.n}
                                className={`rounded-2xl border p-5 transition-colors ${
                                    done
                                        ? "bg-cyan-400/[0.04] border-cyan-400/30"
                                        : bounced
                                          ? "bg-amber-500/[0.04] border-amber-500/30"
                                          : "bg-neutral-900/40 border-neutral-800"
                                } ${authed && !unlocked && !entry ? "opacity-55" : ""}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="mt-0.5 flex-shrink-0">
                                        {done ? (
                                            <CheckCircle2 size={22} className="text-cyan-400" />
                                        ) : entry ? (
                                            <Clock size={22} className="text-amber-400" />
                                        ) : authed && !unlocked ? (
                                            <Lock size={20} className="text-neutral-700" />
                                        ) : (
                                            <Circle size={22} className="text-neutral-600" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="font-mono text-xs text-neutral-500">
                                                PR {String(m.n).padStart(2, "0")}
                                            </span>
                                            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${ARENA_STYLES[m.arena]}`}>
                                                {ARENA_LABELS[m.arena]}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
                                                <Clock size={11} /> {m.est}
                                            </span>
                                        </div>

                                        <h3 className={`text-lg font-bold mb-1.5 ${done ? "text-cyan-200" : "text-white"}`}>
                                            {m.title}
                                        </h3>
                                        <p className="text-sm text-neutral-400 leading-relaxed mb-4">{m.goal}</p>
                                        <details className="group/steps mb-4 border border-neutral-700/50 rounded-xl bg-neutral-900/40">
                                            <summary className="cursor-pointer select-none list-none flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-cyan-300 hover:text-cyan-200">
                                                <ListOrdered size={15} /> How to do it · {m.steps.length} steps
                                                <ChevronDown size={14} className="ml-auto transition-transform group-open/steps:rotate-180" />
                                            </summary>
                                            <ol className="px-3 pb-3 space-y-2">
                                                {m.steps.map((step, i) => (
                                                    <li key={i} className="flex gap-2.5 text-sm text-neutral-300">
                                                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-400/10 text-cyan-300 text-[11px] font-mono flex items-center justify-center mt-0.5">
                                                            {i + 1}
                                                        </span>
                                                        <span className="leading-relaxed min-w-0 break-words">{withCode(step)}</span>
                                                    </li>
                                                ))}
                                            </ol>
                                            {m.links && (
                                                <div className="flex flex-wrap gap-2 px-3 pb-3">
                                                    {m.links.map((l) => {
                                                        const external = l.href.startsWith("http");
                                                        return (
                                                            <a
                                                                key={l.href}
                                                                href={l.href}
                                                                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                                                                className="inline-flex items-center gap-1.5 text-sm text-cyan-300 hover:text-cyan-200 border border-cyan-400/30 hover:border-cyan-400/60 rounded-lg px-3 py-1.5 transition-colors"
                                                            >
                                                                {l.label} {external && <ExternalLink size={12} />}
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </details>

                                        <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Done when</div>
                                        <ul className="space-y-1.5 mb-4">
                                            {m.done.map((d) => (
                                                <li key={d} className="flex gap-2.5 text-sm text-neutral-300">
                                                    <span className="text-neutral-600 mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-neutral-600" />
                                                    <span className="leading-relaxed">{d}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        <div className="flex gap-2.5 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl p-3 mb-3">
                                            <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                            <p className="text-sm text-amber-100/80 leading-relaxed">{m.trap}</p>
                                        </div>

                                        <div className="flex gap-2.5 bg-neutral-800/40 border border-neutral-700/50 rounded-xl p-3">
                                            <PenLine size={15} className="text-neutral-400 flex-shrink-0 mt-0.5" />
                                            <p className="text-sm text-neutral-300 leading-relaxed">
                                                <span className="text-neutral-500">Also answer: </span>
                                                {m.reflect}
                                            </p>
                                        </div>

                                        {/* What was submitted */}
                                        {entry && (
                                            <div className="mt-3 bg-neutral-950/60 border border-neutral-800 rounded-xl p-3.5">
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <a
                                                        href={entry.evidence.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-sm font-mono text-cyan-300 hover:underline truncate"
                                                    >
                                                        {entry.evidence.repo}#{entry.evidence.number}
                                                    </a>
                                                    <span className={`text-[11px] font-mono ${PR_STATE_STYLES[entry.evidence.state]}`}>
                                                        {entry.evidence.state}
                                                    </span>
                                                    <span className="text-[11px] text-neutral-500 font-mono">
                                                        {entry.evidence.reviewRounds} review {entry.evidence.reviewRounds === 1 ? "round" : "rounds"}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-neutral-400 mb-2 truncate">{entry.evidence.title}</p>

                                                {done && entry.signedOffByName && (
                                                    <div className="inline-flex items-center gap-1.5 text-xs text-cyan-300">
                                                        <ShieldCheck size={13} /> Signed off by {entry.signedOffByName}
                                                    </div>
                                                )}
                                                {bounced && (
                                                    <div className="text-sm text-amber-200/90 leading-relaxed border-l-2 border-amber-500/40 pl-3 mt-1">
                                                        <span className="text-amber-400/70">Sent back: </span>
                                                        {entry.reviewerNote}
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap items-center gap-3 mt-2">
                                                    {entry.state === "submitted" && (
                                                        <span className="text-xs text-amber-300">Waiting on a reviewer</span>
                                                    )}
                                                    <button
                                                        onClick={() => recheck(m.n)}
                                                        disabled={busy}
                                                        className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-cyan-300 disabled:opacity-50 transition-colors"
                                                    >
                                                        <RefreshCw size={11} /> Re-check status
                                                    </button>
                                                    {entry.state === "submitted" && (
                                                        <button
                                                            onClick={() => withdraw(m.n)}
                                                            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                                                        >
                                                            <RotateCcw size={11} /> Withdraw
                                                        </button>
                                                    )}
                                                    {statusNote?.n === m.n && (
                                                        <span className="text-xs text-neutral-500">{statusNote.text}</span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] font-mono text-neutral-700 mt-1.5">
                                                    last checked {new Date(entry.evidence.verifiedAt).toLocaleString()}
                                                </p>
                                            </div>
                                        )}

                                        {/* Submit: not while a submission is waiting on a reviewer */}
                                        {authed && !done && entry?.state !== "submitted" && (
                                            <div className="mt-3">
                                                {!unlocked ? (
                                                    <p className="text-xs text-neutral-600">
                                                        {entryFor(m.n - 1)?.state === "changes-requested"
                                                            ? `Opens when you fix and resubmit milestone ${m.n - 1}.`
                                                            : `Opens when you submit milestone ${m.n - 1}.`}
                                                    </p>
                                                ) : openForm === m.n ? (
                                                    <SubmitForm
                                                        milestone={m.n}
                                                        form={form}
                                                        setForm={setForm}
                                                        error={error}
                                                        busy={busy}
                                                        onSubmit={() => submit(m.n)}
                                                        onCancel={() => {
                                                            setOpenForm(null);
                                                            setError(null);
                                                        }}
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setOpenForm(m.n);
                                                            setForm(EMPTY_FORM);
                                                            setError(null);
                                                        }}
                                                        className="text-sm font-semibold text-cyan-300 bg-cyan-400/10 border border-cyan-400/25 hover:border-cyan-400/60 rounded-xl px-4 py-2 transition-colors"
                                                    >
                                                        {bounced ? "Resubmit" : "Submit this milestone"}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Reflection template */}
                <div className="mb-10">
                    <div className="flex items-center gap-2 mb-2">
                        <PenLine size={18} className="text-cyan-400" />
                        <h2 className="text-xl font-bold">The reflection, every time</h2>
                    </div>
                    <p className="text-sm text-neutral-400 mb-5 leading-relaxed">
                        Five fields, hard caps, filed within 48 hours of the review. The caps are enforced on submit,
                        not suggested — a reflection nobody can read in thirty seconds is one nobody reads at all,
                        including you, three months later, in an interview.
                    </p>
                    <div className="border border-neutral-800 rounded-2xl overflow-hidden divide-y divide-neutral-800">
                        {reflectionTemplate.map((f, i) => (
                            <div key={f.label} className="bg-neutral-900/40 p-4">
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="font-mono text-xs text-neutral-600">{i + 1}</span>
                                    <span className="font-semibold text-white">{f.label}</span>
                                    <span className="text-[11px] text-neutral-500 font-mono">{f.limit}</span>
                                </div>
                                <p className="text-sm text-neutral-400 leading-relaxed pl-5">{f.hint}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="text-sm text-neutral-500 border-l-2 border-neutral-800 pl-4 leading-relaxed">
                    {workbookMeta.notThis}
                </p>
            </div>
        </div>
    );
}

const FIELD_CLASS =
    "w-full bg-neutral-950 border border-neutral-800 focus:border-cyan-400/50 rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none transition-colors";

function SubmitForm({
    milestone,
    form,
    setForm,
    error,
    busy,
    onSubmit,
    onCancel,
}: {
    milestone: number;
    form: FormState;
    setForm: (f: FormState) => void;
    error: string | null;
    busy: boolean;
    onSubmit: () => void;
    onCancel: () => void;
}) {
    const urlInputId = useId();
    const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch });

    return (
        <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-3">
            <div>
                <label
                    htmlFor={urlInputId}
                    className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                    {milestone === 3 ? "Link to the issue you filed" : "Link to the pull request"}
                </label>
                <input
                    id={urlInputId}
                    value={form.url}
                    onChange={(e) => set({ url: e.target.value })}
                    placeholder="https://github.com/owner/repo/pull/123"
                    className={`${FIELD_CLASS} font-mono text-xs`}
                />
            </div>

            <Field label="What I tried" limit="100 words" value={form.tried} onChange={(v) => set({ tried: v })} />
            <Field label="What broke" limit="100 words" value={form.broke} onChange={(v) => set({ broke: v })} />
            <Field
                label="What the reviewer said"
                limit="paste it verbatim"
                value={form.reviewerSaid}
                onChange={(v) => set({ reviewerSaid: v })}
            />
            <Field
                label="What I would do differently"
                limit="60 words"
                value={form.differently}
                onChange={(v) => set({ differently: v })}
            />

            <div className="grid grid-cols-3 gap-2">
                <input
                    value={form.hours}
                    onChange={(e) => set({ hours: e.target.value })}
                    placeholder="Hours"
                    inputMode="decimal"
                    className={FIELD_CLASS}
                />
                <input
                    value={form.rounds}
                    onChange={(e) => set({ rounds: e.target.value })}
                    placeholder="Rounds"
                    inputMode="numeric"
                    className={FIELD_CLASS}
                />
                <select
                    value={form.status}
                    onChange={(e) => set({ status: e.target.value as PRState })}
                    className={FIELD_CLASS}
                >
                    <option value="merged">merged</option>
                    <option value="open">open</option>
                    <option value="closed">closed</option>
                </select>
            </div>

            {error && (
                <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2 leading-relaxed">
                    {error}
                </p>
            )}

            <div className="flex gap-2 pt-1">
                <button
                    onClick={onSubmit}
                    disabled={busy}
                    className="text-sm font-semibold text-cyan-300 bg-cyan-400/10 border border-cyan-400/25 hover:border-cyan-400/60 disabled:opacity-50 rounded-xl px-4 py-2 transition-colors"
                >
                    {busy ? "Checking the link…" : "Submit for sign-off"}
                </button>
                <button
                    onClick={onCancel}
                    className="text-sm text-neutral-500 hover:text-neutral-300 px-3 transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

function Field({
    label,
    limit,
    value,
    onChange,
}: {
    label: string;
    limit: string;
    value: string;
    onChange: (v: string) => void;
}) {
    const count = value.trim() ? value.trim().split(/\s+/).length : 0;
    return (
        <div>
            <div className="flex items-baseline justify-between mb-1.5">
                <label className="text-xs uppercase tracking-wider text-neutral-500">{label}</label>
                <span className="text-[11px] font-mono text-neutral-600">
                    {count} · {limit}
                </span>
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={3}
                className={`${FIELD_CLASS} resize-y leading-relaxed`}
            />
        </div>
    );
}
