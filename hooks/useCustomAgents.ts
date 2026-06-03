"use client";

/**
 * useCustomAgents — state, persistence, and streaming for the ccswitch-style
 * Custom Agents hub. Each agent has its own OpenAI-compatible provider config
 * and a per-agent conversation, all persisted in localStorage. Chat streams via
 * the stateless /api/agents/chat passthrough.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACCENT_SWATCHES,
  CustomAgent,
  CustomAgentMessage,
} from "@/lib/types";
import { streamChat } from "@/lib/stream-client";
import {
  loadCustomAgents,
  saveCustomAgents,
  loadCustomConvos,
  saveCustomConvos,
} from "@/lib/storage";

let idc = 0;
function uid(p: string): string {
  idc += 1;
  return `${p}_${Date.now().toString(36)}_${idc}`;
}

export type CAStatus = "idle" | "thinking" | "streaming";

export function newAgentDraft(): CustomAgent {
  return {
    id: uid("agent"),
    name: "",
    description: "",
    accent: ACCENT_SWATCHES[0],
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "",
    systemPrompt: "",
    temperature: 0.7,
    createdAt: Date.now(),
  };
}

export function useCustomAgents() {
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [convos, setConvos] = useState<Record<string, CustomAgentMessage[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<CAStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const convosRef = useRef(convos);
  const agentsRef = useRef(agents);
  const activeIdRef = useRef(activeId);

  // Mirror state into refs after commit (the mutators below also keep them
  // eagerly in sync within a tick, so the async chat path never sees stale data).
  useEffect(() => {
    convosRef.current = convos;
  }, [convos]);
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const busy = status !== "idle";

  // Hydrate from localStorage.
  useEffect(() => {
    const a = loadCustomAgents();
    const c = loadCustomConvos();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAgents(a);
    setConvos(c);
    setActiveId(a.length ? a[0].id : null);
    setHydrated(true);
  }, []);

  const persistAgents = useCallback((next: CustomAgent[]) => {
    agentsRef.current = next;
    setAgents(next);
    saveCustomAgents(next);
  }, []);

  const persistConvos = useCallback(
    (next: Record<string, CustomAgentMessage[]>) => {
      convosRef.current = next;
      setConvos(next);
      saveCustomConvos(next);
    },
    []
  );

  const activeAgent = useMemo(
    () => agents.find((a) => a.id === activeId) ?? null,
    [agents, activeId]
  );
  const messages = useMemo(
    () => (activeId ? convos[activeId] ?? [] : []),
    [activeId, convos]
  );

  /* -------------------- agent CRUD -------------------- */

  const createAgent = useCallback(
    (agent: CustomAgent) => {
      persistAgents([...agentsRef.current, agent]);
      setActiveId(agent.id);
    },
    [persistAgents]
  );

  const updateAgent = useCallback(
    (agent: CustomAgent) => {
      persistAgents(agentsRef.current.map((a) => (a.id === agent.id ? agent : a)));
    },
    [persistAgents]
  );

  const removeAgent = useCallback(
    (id: string) => {
      const next = agentsRef.current.filter((a) => a.id !== id);
      persistAgents(next);
      const restConvos = { ...convosRef.current };
      delete restConvos[id];
      persistConvos(restConvos);
      if (activeIdRef.current === id) {
        setActiveId(next.length ? next[0].id : null);
      }
    },
    [persistAgents, persistConvos]
  );

  /* -------------------- chat -------------------- */

  const newConversation = useCallback(() => {
    const id = activeIdRef.current;
    if (!id) return;
    persistConvos({ ...convosRef.current, [id]: [] });
  }, [persistConvos]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
  }, []);

  const send = useCallback(
    async (text: string) => {
      const agent = agentsRef.current.find((a) => a.id === activeIdRef.current);
      const trimmed = text.trim();
      if (!agent || !trimmed || abortRef.current) return;
      setError(null);

      const userMsg: CustomAgentMessage = {
        id: uid("u"),
        role: "user",
        content: trimmed,
      };
      const assistantId = uid("a");
      const base = convosRef.current[agent.id] ?? [];
      const history = [...base, userMsg];
      persistConvos({
        ...convosRef.current,
        [agent.id]: [
          ...history,
          { id: assistantId, role: "assistant", content: "", streaming: true },
        ],
      });

      const patchAssistant = (patch: Partial<CustomAgentMessage>) => {
        const cur = convosRef.current[agent.id] ?? [];
        persistConvos({
          ...convosRef.current,
          [agent.id]: cur.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
        });
      };

      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("thinking");
      let started = false;

      try {
        await streamChat(
          {
            baseUrl: agent.baseUrl,
            apiKey: agent.apiKey,
            model: agent.model,
            systemPrompt: agent.systemPrompt,
            temperature: agent.temperature,
            messages: history.map((m) => ({ role: m.role, content: m.content })),
          },
          controller.signal,
          (evt, agg) => {
            if (evt.type === "content") {
              if (!started) {
                started = true;
                setStatus("streaming");
              }
              patchAssistant({ content: agg.content });
            }
          },
          "/api/agents/chat"
        );
        patchAssistant({ streaming: false });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (e instanceof DOMException && e.name === "AbortError") {
          patchAssistant({ streaming: false });
        } else {
          patchAssistant({ streaming: false, error: true, content: msg });
          setError(msg);
        }
      } finally {
        abortRef.current = null;
        setStatus("idle");
      }
    },
    [persistConvos]
  );

  return useMemo(
    () => ({
      agents,
      activeAgent,
      activeId,
      setActive: setActiveId,
      messages,
      hydrated,
      status,
      busy,
      error,
      createAgent,
      updateAgent,
      removeAgent,
      send,
      stop,
      newConversation,
    }),
    [
      agents,
      activeAgent,
      activeId,
      messages,
      hydrated,
      status,
      busy,
      error,
      createAgent,
      updateAgent,
      removeAgent,
      send,
      stop,
      newConversation,
    ]
  );
}
