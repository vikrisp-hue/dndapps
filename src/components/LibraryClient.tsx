"use client";

import {
  Archive,
  BookOpen,
  CheckCircle2,
  Circle,
  Database,
  ExternalLink,
  FileText,
  Landmark,
  Link2,
  Search,
  Sparkles,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DmLibrary, DmReferenceTarget, DmScene, DmSession } from "@/types/dm";

type LibraryClientProps = {
  library: DmLibrary;
  supabaseStatus: string;
};

const typeLabels: Record<string, string> = {
  all: "Все",
  npc: "NPC",
  faction: "Фракции",
  other: "Прочее"
};

const typeIcons = {
  npc: UserRound,
  faction: Landmark,
  other: Sparkles
};

function normalize(value: string) {
  return value.toLocaleLowerCase("ru-RU");
}

function formatDate(value: string | null) {
  if (!value) return "без даты";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function countWords(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const parts = text.split(new RegExp(`(${escapeRegExp(query.trim())})`, "ig"));
  return (
    <>
      {parts.map((part, index) =>
        normalize(part) === normalize(query.trim()) ? <mark key={`${part}-${index}`}>{part}</mark> : part
      )}
    </>
  );
}

function SceneText({ scene, query }: { scene: DmScene; query: string }) {
  if (!scene.plainText.trim()) {
    return (
      <div className="empty-state">
        <FileText size={22} />
        <span>Пустая сцена</span>
      </div>
    );
  }

  return (
    <div className="scene-body">
      {scene.plainText.split("\n").map((rawLine, index) => {
        const line = rawLine.trim();

        if (!line) {
          return <div className="scene-spacer" key={`space-${index}`} />;
        }

        const isListItem = /^([•-]|\d+\.)/.test(line);
        const isHeading = !isListItem && line.length <= 70 && !/[.!?。]$/.test(line);

        if (isHeading) {
          return (
            <h2 key={`${line}-${index}`}>
              <HighlightedText text={line} query={query} />
            </h2>
          );
        }

        return (
          <p className={isListItem ? "scene-line scene-list-line" : "scene-line"} key={`${line}-${index}`}>
            <HighlightedText text={line} query={query} />
          </p>
        );
      })}
    </div>
  );
}

function ReferenceIcon({ type }: { type: string }) {
  const Icon = typeIcons[type as keyof typeof typeIcons] ?? Sparkles;
  return <Icon size={18} />;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function referenceMatches(reference: DmReferenceTarget, query: string) {
  const needle = normalize(query.trim());
  if (!needle) return true;

  return normalize(`${reference.title} ${reference.npcFirstName ?? ""} ${reference.npcLastName ?? ""} ${reference.text}`).includes(needle);
}

function sceneMatches(scene: DmScene, query: string) {
  const needle = normalize(query.trim());
  if (!needle) return false;
  return normalize(`${scene.title} ${scene.plainText}`).includes(needle);
}

function getSessionSceneCount(session: DmSession, scenes: DmScene[]) {
  return scenes.filter((scene) => scene.sessionId === session.id).length;
}

export function LibraryClient({ library, supabaseStatus }: LibraryClientProps) {
  const firstLiveSessionId = library.sessions.find((session) => !session.isDeleted)?.id ?? library.sessions[0]?.id ?? "";
  const [activeSessionId, setActiveSessionId] = useState(firstLiveSessionId);
  const [activeSceneId, setActiveSceneId] = useState("");
  const [query, setQuery] = useState("");
  const [referenceType, setReferenceType] = useState("all");
  const [showArchive, setShowArchive] = useState(false);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);

  const visibleSessions = useMemo(() => {
    const sessions = showArchive ? library.sessions : library.sessions.filter((session) => !session.isDeleted);
    return sessions.filter((session) => getSessionSceneCount(session, library.scenes) > 0);
  }, [library.scenes, library.sessions, showArchive]);

  const activeSession = useMemo(
    () => visibleSessions.find((session) => session.id === activeSessionId) ?? visibleSessions[0] ?? library.sessions[0],
    [activeSessionId, library.sessions, visibleSessions]
  );

  const scenesForSession = useMemo(() => {
    if (!activeSession) return [];
    return library.scenes.filter((scene) => scene.sessionId === activeSession.id);
  }, [activeSession, library.scenes]);

  useEffect(() => {
    if (!activeSession && visibleSessions[0]) {
      setActiveSessionId(visibleSessions[0].id);
      return;
    }

    if (activeSession && activeSession.id !== activeSessionId) {
      setActiveSessionId(activeSession.id);
    }
  }, [activeSession, activeSessionId, visibleSessions]);

  useEffect(() => {
    const currentScene = scenesForSession.find((scene) => scene.id === activeSceneId);
    if (!currentScene) {
      setActiveSceneId(scenesForSession.find((scene) => scene.plainText.trim())?.id ?? scenesForSession[0]?.id ?? "");
    }
  }, [activeSceneId, scenesForSession]);

  const activeScene = scenesForSession.find((scene) => scene.id === activeSceneId) ?? scenesForSession[0];

  const linkedReferenceIds = useMemo(() => {
    if (!activeScene) return new Set<string>();
    return new Set(library.textReferences.filter((link) => link.sceneId === activeScene.id).map((link) => link.targetId));
  }, [activeScene, library.textReferences]);

  const linkedReferences = useMemo(
    () => library.references.filter((reference) => linkedReferenceIds.has(reference.id)),
    [library.references, linkedReferenceIds]
  );

  const filteredReferences = useMemo(() => {
    return library.references
      .filter((reference) => referenceType === "all" || reference.type === referenceType)
      .filter((reference) => referenceMatches(reference, query));
  }, [library.references, query, referenceType]);

  const selectedReference =
    library.references.find((reference) => reference.id === selectedReferenceId) ?? linkedReferences[0] ?? filteredReferences[0] ?? null;

  const typeCounts = useMemo(() => {
    return library.references.reduce<Record<string, number>>(
      (acc, reference) => {
        acc.all += 1;
        acc[reference.type] = (acc[reference.type] ?? 0) + 1;
        return acc;
      },
      { all: 0 }
    );
  }, [library.references]);

  const activeTextReferences = activeScene
    ? library.textReferences.filter((link) => link.sceneId === activeScene.id && link.displayedText)
    : [];

  const statusLabel = library.source === "supabase" ? "Supabase" : "Импорт";
  const isSupabaseReady = library.source === "supabase" || supabaseStatus === "connected";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <BookOpen size={24} />
          </span>
          <div>
            <strong>DM Script</strong>
            <span>Кампания и справочник</span>
          </div>
        </div>

        <div className="search-box">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск" aria-label="Поиск" />
        </div>

        <div className="topbar-meta">
          <span className={isSupabaseReady ? "status-pill ok" : "status-pill"}>
            {isSupabaseReady ? <CheckCircle2 size={15} /> : <Circle size={15} />}
            {statusLabel}
          </span>
          <span className="status-pill">
            <Database size={15} />
            {library.sessions.length}/{library.scenes.length}/{library.references.length}
          </span>
        </div>
      </header>

      <main className="workspace">
        <aside className="panel sessions-panel" aria-label="Сессии">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Сессии</span>
              <h1>{activeSession?.title ?? "Нет сессий"}</h1>
            </div>
            <label className="archive-toggle">
              <input type="checkbox" checked={showArchive} onChange={(event) => setShowArchive(event.target.checked)} />
              <Archive size={17} />
            </label>
          </div>

          <div className="session-list">
            {visibleSessions.map((session) => {
              const sceneCount = getSessionSceneCount(session, library.scenes);
              const isActive = session.id === activeSession?.id;

              return (
                <button
                  className={isActive ? "session-button active" : "session-button"}
                  key={session.id}
                  onClick={() => {
                    setActiveSessionId(session.id);
                    setSelectedReferenceId(null);
                  }}
                  type="button"
                >
                  <span>
                    <strong>{session.title}</strong>
                    <small>{formatDate(session.updatedAt)}</small>
                  </span>
                  <em>{sceneCount}</em>
                </button>
              );
            })}
          </div>

          <div className="stats-grid">
            <Stat label="сессий" value={library.sessions.length} />
            <Stat label="сцен" value={library.scenes.length} />
            <Stat label="ссылок" value={library.textReferences.length} />
            <Stat label="карточек" value={library.references.length} />
          </div>
        </aside>

        <section className="panel scene-panel" aria-label="Сцены">
          <div className="scene-tabs" role="tablist" aria-label="Сцены сессии">
            {scenesForSession.map((scene) => {
              const hasMatch = sceneMatches(scene, query);

              return (
                <button
                  aria-selected={scene.id === activeScene?.id}
                  className={scene.id === activeScene?.id ? "scene-tab active" : "scene-tab"}
                  key={scene.id}
                  onClick={() => setActiveSceneId(scene.id)}
                  role="tab"
                  type="button"
                >
                  <FileText size={16} />
                  <span>{scene.title}</span>
                  {hasMatch ? <i /> : null}
                </button>
              );
            })}
          </div>

          {activeScene ? (
            <article className="scene-document">
              <div className="scene-meta">
                <span>{formatDate(activeScene.updatedAt)}</span>
                <span>{countWords(activeScene.plainText)} слов</span>
                <span>{linkedReferences.length} связей</span>
              </div>
              <h1>{activeScene.title}</h1>
              <SceneText scene={activeScene} query={query} />
            </article>
          ) : (
            <div className="empty-state">
              <FileText size={22} />
              <span>Нет сцен</span>
            </div>
          )}
        </section>

        <aside className="panel reference-panel" aria-label="Справочник">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Справочник</span>
              <h1>{selectedReference?.title ?? "Карточки"}</h1>
            </div>
          </div>

          {selectedReference ? (
            <section className="reference-detail">
              <div className="reference-title">
                <span className={`reference-icon ${selectedReference.type}`}>
                  <ReferenceIcon type={selectedReference.type} />
                </span>
                <div>
                  <strong>{selectedReference.title}</strong>
                  <span>{typeLabels[selectedReference.type] ?? selectedReference.type}</span>
                </div>
              </div>
              <p>
                <HighlightedText text={selectedReference.text || "Нет описания"} query={query} />
              </p>
              {selectedReference.externalUrl ? (
                <a className="external-link" href={selectedReference.externalUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />
                  Открыть
                </a>
              ) : null}
            </section>
          ) : null}

          <div className="reference-filters" role="tablist" aria-label="Типы справочника">
            {["all", "npc", "faction", "other"].map((type) => (
              <button
                aria-selected={referenceType === type}
                className={referenceType === type ? "filter-button active" : "filter-button"}
                key={type}
                onClick={() => setReferenceType(type)}
                role="tab"
                type="button"
              >
                {typeLabels[type]}
                <span>{typeCounts[type] ?? 0}</span>
              </button>
            ))}
          </div>

          {activeTextReferences.length ? (
            <section className="linked-mentions">
              <div className="mini-heading">
                <Link2 size={16} />
                <span>В сцене</span>
              </div>
              <div className="mention-list">
                {activeTextReferences.slice(0, 8).map((link) => (
                  <button
                    key={link.id}
                    onClick={() => setSelectedReferenceId(link.targetId)}
                    title={link.displayedText ?? ""}
                    type="button"
                  >
                    {link.displayedText}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <div className="reference-list">
            {filteredReferences.length ? (
              filteredReferences.map((reference) => (
                <button
                  className={reference.id === selectedReference?.id ? "reference-card active" : "reference-card"}
                  key={reference.id}
                  onClick={() => setSelectedReferenceId(reference.id)}
                  type="button"
                >
                  <span className={`reference-icon ${reference.type}`}>
                    <ReferenceIcon type={reference.type} />
                  </span>
                  <span>
                    <strong>{reference.title}</strong>
                    <small>{reference.text.slice(0, 112) || "Нет описания"}</small>
                  </span>
                </button>
              ))
            ) : (
              <div className="empty-state compact">
                <Search size={20} />
                <span>Нет карточек</span>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
