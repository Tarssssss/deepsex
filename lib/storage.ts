"use client";

/**
 * Client-side persistence for settings and sessions.
 *
 * Everything lives in localStorage — the server is stateless, so durable state
 * (personal settings, memory, and Codex-style session "rollouts") is the
 * client's responsibility. All helpers are SSR-safe (no-op when `window` is
 * undefined) and defensive against corrupt/partial JSON.
 */
import {
  AgentSettings,
  DEFAULT_SETTINGS,
  SessionMeta,
  StoredSession,
} from "@/lib/types";

const SETTINGS_KEY = "ds-settings";
const SESSION_INDEX_KEY = "ds-sessions";
const SESSION_PREFIX = "ds-session:";

function canUse(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

/* ----------------------------- settings ----------------------------- */

export function loadSettings(): AgentSettings {
  if (!canUse()) return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AgentSettings>;
    // Merge over defaults so new fields appear for existing users.
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      customSkills: parsed.customSkills ?? [],
      disabledSkills: parsed.disabledSkills ?? [],
      mcpServers: parsed.mcpServers ?? [],
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AgentSettings): void {
  if (!canUse()) return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* quota / serialization failure — ignore */
  }
}

/* ----------------------------- sessions ----------------------------- */

export function loadSessionIndex(): SessionMeta[] {
  if (!canUse()) return [];
  try {
    const raw = localStorage.getItem(SESSION_INDEX_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SessionMeta[];
    return Array.isArray(list)
      ? list.sort((a, b) => b.updatedAt - a.updatedAt)
      : [];
  } catch {
    return [];
  }
}

function saveSessionIndex(index: SessionMeta[]): void {
  if (!canUse()) return;
  try {
    localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(index));
  } catch {
    /* ignore */
  }
}

export function loadSession(id: string): StoredSession | null {
  if (!canUse()) return null;
  try {
    const raw = localStorage.getItem(SESSION_PREFIX + id);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  if (!canUse()) return;
  try {
    localStorage.setItem(SESSION_PREFIX + session.id, JSON.stringify(session));
    const index = loadSessionIndex().filter((s) => s.id !== session.id);
    const meta: SessionMeta = {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      model: session.model,
      messageCount: session.messageCount,
      usage: session.usage,
    };
    saveSessionIndex([meta, ...index]);
  } catch {
    /* ignore quota errors */
  }
}

export function deleteSession(id: string): void {
  if (!canUse()) return;
  try {
    localStorage.removeItem(SESSION_PREFIX + id);
    saveSessionIndex(loadSessionIndex().filter((s) => s.id !== id));
  } catch {
    /* ignore */
  }
}

/** Derive a short session title from the first user message. */
export function deriveTitle(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "Untitled session";
  return clean.length > 48 ? clean.slice(0, 47) + "…" : clean;
}
