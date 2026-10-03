"use client";

import { useEffect, useMemo, useState } from "react";
import { Github, Search, Star, GitFork, Check, Link2, RefreshCw } from "lucide-react";
import type { GithubRepo } from "@/app/api/github/repos/route";

interface RepoPickerProps {
    value: string;
    onChange: (url: string) => void;
    /** Offered alongside the repo, since GitHub records a homepage per repo. */
    onDemoUrl?: (url: string) => void;
}

type State =
    | { status: "loading" }
    | { status: "ready"; username: string; repos: GithubRepo[] }
    | { status: "unavailable"; message: string };

/**
 * Picks a repository from the member's own GitHub account instead of making
 * them paste a URL. Falls back to a plain text field whenever the list can't
 * be loaded, no GitHub username on file, a rate limit, GitHub being down -
 * so the form is never blocked by this.
 */
export function RepoPicker({ value, onChange, onDemoUrl }: RepoPickerProps) {
    const [state, setState] = useState<State>({ status: "loading" });
    const [query, setQuery] = useState("");
    const [manual, setManual] = useState(false);
    // Once a repo is chosen the list collapses; "Change" reopens it.
    const [picking, setPicking] = useState(false);

    async function fetchRepos(): Promise<State> {
        try {
            const response = await fetch("/api/github/repos");
            const body = await response.json();
            if (!response.ok || !body.ok) {
                return { status: "unavailable", message: body.message ?? "Couldn't reach GitHub." };
            }
            return { status: "ready", username: body.username, repos: body.repos };
        } catch {
            return { status: "unavailable", message: "Couldn't reach GitHub." };
        }
    }

    // State is already "loading", so nothing is set synchronously here, and the
    // result is dropped if the form unmounts while the request is in flight.
    useEffect(() => {
        let active = true;
        fetchRepos().then((next) => {
            if (active) setState(next);
        });
        return () => {
            active = false;
        };
    }, []);

    async function retry() {
        setState({ status: "loading" });
        setState(await fetchRepos());
    }

    const filtered = useMemo(() => {
        if (state.status !== "ready") return [];
        const q = query.trim().toLowerCase();
        if (!q) return state.repos;
        return state.repos.filter(
            (r) =>
                r.name.toLowerCase().includes(q) ||
                (r.description ?? "").toLowerCase().includes(q) ||
                (r.language ?? "").toLowerCase().includes(q),
        );
    }, [state, query]);

    const showManual = manual || state.status === "unavailable";
    const selectedRepo = state.status === "ready" ? state.repos.find((r) => r.url === value) : undefined;
    // Collapse to a summary once something's picked, unless the user reopened it.
    const showList = picking || !selectedRepo;

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <label className="block text-xs uppercase tracking-wider text-neutral-500">
                    GitHub repository
                </label>
                {state.status === "ready" && (
                    <button
                        type="button"
                        onClick={() => setManual((m) => !m)}
                        className="text-xs text-neutral-500 hover:text-cyan-300 transition-colors inline-flex items-center gap-1"
                    >
                        <Link2 size={12} />
                        {showManual ? "Pick from GitHub" : "Paste a URL"}
                    </button>
                )}
            </div>

            {showManual ? (
                <div className="flex items-center gap-2 glass-subtle !rounded-xl focus-within:outline focus-within:outline-2 focus-within:outline-cyan-400/50 px-4 py-3 transition-colors">
                    <Github size={16} className="text-neutral-400 flex-shrink-0" aria-hidden="true" />
                    <input
                        name="repoUrl"
                        type="url"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="https://github.com/you/your-project"
                        aria-label="GitHub repository URL"
                        className="bg-transparent outline-none w-full text-sm text-white placeholder:text-neutral-400"
                    />
                </div>
            ) : (
                <>
                    <input type="hidden" name="repoUrl" value={value} />

                    {selectedRepo && !showList && (
                        <div className="flex items-center gap-3 glass-subtle !rounded-xl px-4 py-3">
                            <Check size={16} className="text-cyan-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-white truncate">{selectedRepo.name}</p>
                                {selectedRepo.description && (
                                    <p className="text-xs text-neutral-500 truncate">{selectedRepo.description}</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setQuery("");
                                    setPicking(true);
                                }}
                                className="text-xs text-cyan-300 hover:text-cyan-200 flex-shrink-0"
                            >
                                Change
                            </button>
                        </div>
                    )}

                    {showList && (
                    <div className="glass rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                            <Search size={14} className="text-neutral-500 flex-shrink-0" />
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={
                                    state.status === "ready"
                                        ? `Search ${state.repos.length} repos…`
                                        : "Loading your repos…"
                                }
                                aria-label="Search your repositories"
                                className="bg-transparent outline-none w-full text-sm text-white placeholder:text-neutral-400"
                            />
                        </div>

                        <div className="max-h-64 overflow-y-auto">
                            {state.status === "loading" && (
                                <p className="px-4 py-6 text-sm text-neutral-500 text-center">
                                    Loading your repositories…
                                </p>
                            )}

                            {state.status === "ready" && filtered.length === 0 && (
                                <p className="px-4 py-6 text-sm text-neutral-500 text-center">
                                    Nothing matches “{query}”.
                                </p>
                            )}

                            {state.status === "ready" &&
                                filtered.map((repo) => {
                                    const selected = value === repo.url;
                                    return (
                                        <button
                                            key={repo.fullName}
                                            type="button"
                                            onClick={() => {
                                                onChange(repo.url);
                                                if (repo.homepage && onDemoUrl) onDemoUrl(repo.homepage);
                                                setPicking(false); // collapse the list
                                            }}
                                            className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-0 transition-colors ${
                                                selected ? "bg-cyan-400/10" : "hover:bg-white/5"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                {selected ? (
                                                    <Check size={14} className="text-cyan-400 flex-shrink-0" />
                                                ) : repo.fork ? (
                                                    <GitFork size={14} className="text-neutral-600 flex-shrink-0" />
                                                ) : (
                                                    <Github size={14} className="text-neutral-600 flex-shrink-0" />
                                                )}
                                                <span
                                                    className={`text-sm font-medium truncate ${
                                                        selected ? "text-cyan-300" : "text-white"
                                                    }`}
                                                >
                                                    {repo.name}
                                                </span>
                                                {repo.stars > 0 && (
                                                    <span className="inline-flex items-center gap-1 text-xs text-neutral-500 flex-shrink-0">
                                                        <Star size={11} />
                                                        <span className="font-mono tabular-nums">{repo.stars}</span>
                                                    </span>
                                                )}
                                            </div>
                                            {repo.description && (
                                                <p className="text-xs text-neutral-500 mt-1 line-clamp-1 pl-6">
                                                    {repo.description}
                                                </p>
                                            )}
                                        </button>
                                    );
                                })}
                        </div>
                    </div>
                    )}
                </>
            )}

            {state.status === "unavailable" && (
                <p className="text-xs text-neutral-600 mt-2 flex items-center gap-2">
                    {state.message}
                    <button
                        type="button"
                        onClick={() => void retry()}
                        className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                        <RefreshCw size={11} />
                        Retry
                    </button>
                </p>
            )}
        </div>
    );
}
