"use client";

import {
  Archive,
  Bold,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Dice5,
  Edit3,
  FileText,
  Image,
  Italic,
  Landmark,
  Library,
  Link2,
  List,
  Minus,
  MoreHorizontal,
  PanelLeftOpen,
  PanelRightOpen,
  Play,
  Plus,
  Quote,
  RotateCcw,
  Scissors,
  Search,
  Sparkles,
  Trash2,
  Underline,
  UserRound,
  Volume2,
  X
} from "lucide-react";
import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import type { DmLibrary, DmReferenceTarget, DmScene, DmSession } from "@/types/dm";

type LibraryClientProps = {
  library: DmLibrary;
  supabaseStatus: string;
};

type ModalState =
  | { type: "reference"; target: DmReferenceTarget; edit: boolean }
  | { type: "addReference" }
  | { type: "deleted" }
  | { type: "image"; target: DmReferenceTarget }
  | null;

type InspectorScope = "scene" | "shared" | "all";
type AppMode = "editor" | "library";

const referenceTypeLabels: Record<string, string> = {
  npc: "NPC",
  faction: "Фракции",
  other: "Прочее"
};

const diceDefinitions = [4, 6, 8, 10, 12, 20, 100];

function normalize(value: string) {
  return value.toLocaleLowerCase("ru-RU");
}

function normalizeId(value: string) {
  return value.replaceAll("-", "").toLocaleLowerCase("en-US");
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

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function referenceIcon(type: string) {
  if (type === "npc") return <UserRound size={15} />;
  if (type === "faction") return <Landmark size={15} />;
  return <Sparkles size={15} />;
}

function typeLabel(type: string) {
  return referenceTypeLabels[type] ?? type;
}

function makeEmptyScene(sessionId: string): DmScene {
  const now = new Date().toISOString();
  return {
    id: createId(),
    sessionId,
    title: "Новая сцена",
    sortIndex: Date.now(),
    plainText: "",
    richTextHtml: null,
    masterNotes: null,
    createdAt: now,
    updatedAt: now
  };
}

function SceneRow({
  scene,
  active,
  onSelect,
  onRename,
  onDelete
}: {
  scene: DmScene;
  active: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={active ? "scene-row selected" : "scene-row"}>
      <button onClick={onSelect} type="button">
        <FileText size={16} />
        <span>
          <strong>{scene.title}</strong>
          <small>{scene.plainText.slice(0, 68) || "Пустой документ"}</small>
        </span>
      </button>
      <div className="row-actions">
        <button aria-label="Rename scene" onClick={onRename} title="Переименовать" type="button">
          <Edit3 size={13} />
        </button>
        <button aria-label="Delete scene" onClick={onDelete} title="Удалить" type="button">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function ReferenceRow({
  target,
  active,
  onOpen,
  onEdit,
  onDelete,
  onPlayAudio,
  onShowImage
}: {
  target: DmReferenceTarget;
  active: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPlayAudio: () => void;
  onShowImage: () => void;
}) {
  return (
    <div className={active ? `target-row active ${target.type}` : `target-row ${target.type}`}>
      <button onClick={onOpen} type="button">
        <span className="target-icon">{referenceIcon(target.type)}</span>
        <span>
          <strong>{target.title}</strong>
          <small>{target.text.split("\n")[0] || typeLabel(target.type)}</small>
        </span>
      </button>
      <div className="row-actions">
        {target.imagePath ? (
          <button aria-label="Show image" onClick={onShowImage} title="Изображение" type="button">
            <Image size={13} />
          </button>
        ) : null}
        {target.audioPath ? (
          <button aria-label="Play audio" onClick={onPlayAudio} title="Аудио" type="button">
            <Volume2 size={13} />
          </button>
        ) : null}
        <button aria-label="Edit reference" onClick={onEdit} title="Редактировать" type="button">
          <Edit3 size={13} />
        </button>
        <button aria-label="Archive reference" onClick={onDelete} title="В архив" type="button">
          <Archive size={13} />
        </button>
      </div>
    </div>
  );
}

function RichTextEditor({
  scene,
  onOpenReference
}: {
  scene: DmScene;
  onOpenReference: (id: string) => void;
}) {
  const html = scene.richTextHtml;

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const link = target.closest("a[href^='dmref://']");
    const href = link?.getAttribute("href");
    if (!href) return;

    event.preventDefault();
    onOpenReference(href.replace("dmref://", ""));
  }

  if (!scene.plainText.trim() && !html) {
    return (
      <div className="empty-editor">
        <FileText size={24} />
        <span>Пустая сцена</span>
      </div>
    );
  }

  if (html) {
    return (
      <div
        className="rich-text-host"
        contentEditable
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handleClick}
        onMouseDown={handleClick}
        suppressContentEditableWarning
      />
    );
  }

  return (
    <div className="plain-editor" contentEditable suppressContentEditableWarning>
      {scene.plainText.split("\n").map((line, index) => (
        <p key={`${line}-${index}`}>{line || <br />}</p>
      ))}
    </div>
  );
}

function Modal({
  modal,
  references,
  deletedSessions,
  onClose,
  onSaveTarget,
  onCreateTarget,
  onRestoreTarget,
  onRemoveArchivedTarget,
  onRestoreSession
}: {
  modal: ModalState;
  references: DmReferenceTarget[];
  deletedSessions: DmSession[];
  onClose: () => void;
  onSaveTarget: (target: DmReferenceTarget) => void;
  onCreateTarget: (target: DmReferenceTarget) => void;
  onRestoreTarget: (target: DmReferenceTarget) => void;
  onRemoveArchivedTarget: (target: DmReferenceTarget) => void;
  onRestoreSession: (session: DmSession) => void;
}) {
  if (!modal) return null;

  if (modal.type === "image") {
    return (
      <div className="modal-backdrop" onMouseDown={onClose}>
        <section className="modal image-modal" onMouseDown={(event) => event.stopPropagation()}>
          <header>
            <strong>{modal.target.title}</strong>
            <button onClick={onClose} type="button">
              <X size={16} />
            </button>
          </header>
          <div className="image-placeholder">
            <Image size={36} />
            <span>{modal.target.imagePath}</span>
          </div>
        </section>
      </div>
    );
  }

  if (modal.type === "deleted") {
    const archivedTargets = references.filter((target) => target.isArchivedFromDeletedSession);

    return (
      <div className="modal-backdrop" onMouseDown={onClose}>
        <section className="modal deleted-modal" onMouseDown={(event) => event.stopPropagation()}>
          <header>
            <strong>Удалённые материалы</strong>
            <button onClick={onClose} type="button">
              <X size={16} />
            </button>
          </header>
          <div className="deleted-columns">
            <div>
              <h3>Справочник</h3>
              {archivedTargets.length ? (
                archivedTargets.map((target) => (
                  <div className="deleted-row" key={target.id}>
                    <span>
                      <strong>{target.title}</strong>
                      <small>{target.archivedSessionTitle ?? typeLabel(target.type)}</small>
                    </span>
                    <button onClick={() => onRestoreTarget(target)} type="button">
                      <RotateCcw size={14} />
                    </button>
                    <button onClick={() => onRemoveArchivedTarget(target)} type="button">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="muted">Архив пуст</p>
              )}
            </div>
            <div>
              <h3>Сессии</h3>
              {deletedSessions.length ? (
                deletedSessions.map((session) => (
                  <div className="deleted-row" key={session.id}>
                    <span>
                      <strong>{session.title}</strong>
                      <small>{formatDate(session.updatedAt)}</small>
                    </span>
                    <button onClick={() => onRestoreSession(session)} type="button">
                      <RotateCcw size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="muted">Удалённых сессий нет</p>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const initial =
    modal.type === "reference"
      ? modal.target
      : ({
          id: createId(),
          title: "",
          type: "npc",
          npcFirstName: null,
          npcLastName: null,
          text: "",
          externalUrl: null,
          imagePath: null,
          audioPath: null,
          externalFilePath: null,
          sharedSessionIds: [],
          isSharedAcrossAllSessions: true,
          isArchivedFromDeletedSession: false,
          archivedSessionTitle: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } satisfies DmReferenceTarget);

  return (
    <ReferenceFormModal
      initial={initial}
      mode={modal.type === "addReference" ? "create" : modal.edit ? "edit" : "view"}
      onClose={onClose}
      onSave={(target) => {
        if (modal.type === "addReference") onCreateTarget(target);
        else onSaveTarget(target);
      }}
    />
  );
}

function ReferenceFormModal({
  initial,
  mode,
  onClose,
  onSave
}: {
  initial: DmReferenceTarget;
  mode: "view" | "edit" | "create";
  onClose: () => void;
  onSave: (target: DmReferenceTarget) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [isEditing, setIsEditing] = useState(mode !== "view");

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ ...draft, updatedAt: new Date().toISOString() });
    onClose();
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal reference-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
        <header>
          <div>
            <span>{mode === "create" ? "Новая ссылка" : typeLabel(draft.type)}</span>
            <strong>{draft.title || "Без названия"}</strong>
          </div>
          <button onClick={onClose} type="button">
            <X size={16} />
          </button>
        </header>

        <div className="form-grid">
          <label>
            <span>Название</span>
            <input
              disabled={!isEditing}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              value={draft.title}
            />
          </label>
          <label>
            <span>Тип</span>
            <select
              disabled={!isEditing}
              onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}
              value={draft.type}
            >
              <option value="npc">NPC</option>
              <option value="faction">Фракция</option>
              <option value="other">Прочее</option>
            </select>
          </label>
          <label>
            <span>Имя NPC</span>
            <input
              disabled={!isEditing}
              onChange={(event) => setDraft((current) => ({ ...current, npcFirstName: event.target.value || null }))}
              value={draft.npcFirstName ?? ""}
            />
          </label>
          <label>
            <span>Фамилия NPC</span>
            <input
              disabled={!isEditing}
              onChange={(event) => setDraft((current) => ({ ...current, npcLastName: event.target.value || null }))}
              value={draft.npcLastName ?? ""}
            />
          </label>
          <label className="wide">
            <span>Описание</span>
            <textarea
              disabled={!isEditing}
              onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
              rows={10}
              value={draft.text}
            />
          </label>
          <label className="wide checkbox-row">
            <input
              checked={draft.isSharedAcrossAllSessions}
              disabled={!isEditing}
              onChange={(event) =>
                setDraft((current) => ({ ...current, isSharedAcrossAllSessions: event.target.checked }))
              }
              type="checkbox"
            />
            <span>Доступно во всех сессиях</span>
          </label>
        </div>

        <footer>
          {isEditing ? (
            <button className="primary-button" type="submit">
              Сохранить
            </button>
          ) : (
            <button onClick={() => setIsEditing(true)} type="button">
              <Edit3 size={14} />
              Редактировать
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}

function DiceRoller() {
  const [expanded, setExpanded] = useState(false);
  const [selectedCounts, setSelectedCounts] = useState<Record<number, number>>({});
  const [lastResult, setLastResult] = useState<{ formula: string; rolls: number[]; total: number } | null>(null);

  function updateCount(sides: number, delta: number) {
    setSelectedCounts((current) => {
      const next = Math.max(0, (current[sides] ?? 0) + delta);
      return { ...current, [sides]: next };
    });
  }

  function roll() {
    const rolls: number[] = [];
    const formula = diceDefinitions
      .flatMap((sides) => {
        const count = selectedCounts[sides] ?? 0;
        for (let index = 0; index < count; index += 1) {
          rolls.push(1 + Math.floor(Math.random() * sides));
        }
        return count ? [`${count}d${sides}`] : [];
      })
      .join(" + ");

    if (!rolls.length) return;
    setLastResult({ formula, rolls, total: rolls.reduce((sum, value) => sum + value, 0) });
  }

  return (
    <div className={expanded ? "dice-roller expanded" : "dice-roller"}>
      <button className="dice-handle" onClick={() => setExpanded((value) => !value)} title="Dice Roller" type="button">
        <Dice5 size={18} />
        {lastResult ? <strong>{lastResult.total}</strong> : null}
      </button>
      {expanded ? (
        <div className="dice-panel">
          <div className="dice-grid">
            {diceDefinitions.map((sides) => (
              <div className="die-row" key={sides}>
                <span>d{sides}</span>
                <button onClick={() => updateCount(sides, -1)} type="button">
                  <Minus size={13} />
                </button>
                <strong>{selectedCounts[sides] ?? 0}</strong>
                <button onClick={() => updateCount(sides, 1)} type="button">
                  <Plus size={13} />
                </button>
              </div>
            ))}
          </div>
          <button className="primary-button" onClick={roll} type="button">
            Бросить
          </button>
          {lastResult ? (
            <div className="dice-result">
              <span>{lastResult.formula}</span>
              <strong>{lastResult.total}</strong>
              <small>{lastResult.rolls.join(", ")}</small>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function LibraryClient({ library, supabaseStatus }: LibraryClientProps) {
  const [sessions, setSessions] = useState(library.sessions);
  const [scenes, setScenes] = useState(library.scenes);
  const [references, setReferences] = useState(library.references);
  const [mode, setMode] = useState<AppMode>("editor");
  const [query, setQuery] = useState("");
  const [isFindVisible, setIsFindVisible] = useState(false);
  const [findIndex, setFindIndex] = useState(0);
  const [inspectorScope, setInspectorScope] = useState<InspectorScope>("scene");
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({ npc: true, faction: true, other: true });
  const [modal, setModal] = useState<ModalState>(null);
  const [audioTitle, setAudioTitle] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const liveSessions = useMemo(() => sessions.filter((session) => !session.isDeleted), [sessions]);
  const deletedSessions = useMemo(() => sessions.filter((session) => session.isDeleted), [sessions]);
  const firstSessionId = liveSessions[0]?.id ?? sessions[0]?.id ?? "";
  const [openedSessionIds, setOpenedSessionIds] = useState<string[]>(firstSessionId ? [firstSessionId] : []);
  const [activeSessionId, setActiveSessionId] = useState(firstSessionId);
  const [activeSceneId, setActiveSceneId] = useState("");

  const openedSessions = useMemo(
    () => openedSessionIds.map((id) => sessions.find((session) => session.id === id)).filter(Boolean) as DmSession[],
    [openedSessionIds, sessions]
  );

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? liveSessions[0] ?? sessions[0];
  const scenesForSession = useMemo(
    () => (activeSession ? scenes.filter((scene) => scene.sessionId === activeSession.id) : []),
    [activeSession, scenes]
  );

  useEffect(() => {
    if (!activeSession && liveSessions[0]) {
      setActiveSessionId(liveSessions[0].id);
      setOpenedSessionIds([liveSessions[0].id]);
    }
  }, [activeSession, liveSessions]);

  useEffect(() => {
    const activeScene = scenesForSession.find((scene) => scene.id === activeSceneId);
    if (!activeScene) {
      setActiveSceneId(scenesForSession.find((scene) => scene.plainText.trim())?.id ?? scenesForSession[0]?.id ?? "");
    }
  }, [activeSceneId, scenesForSession]);

  const activeScene = scenesForSession.find((scene) => scene.id === activeSceneId) ?? scenesForSession[0];
  const linkedTargetIds = useMemo(
    () =>
      new Set(
        library.textReferences
          .filter((link) => link.sceneId === activeScene?.id)
          .map((link) => normalizeId(link.targetId))
      ),
    [activeScene?.id, library.textReferences]
  );

  const sceneReferences = references.filter((target) => linkedTargetIds.has(normalizeId(target.id)));
  const sharedReferences = references.filter((target) => target.isSharedAcrossAllSessions && !target.isArchivedFromDeletedSession);
  const archivedReferences = references.filter((target) => target.isArchivedFromDeletedSession);
  const visibleReferences = (inspectorScope === "scene" ? sceneReferences : inspectorScope === "shared" ? sharedReferences : references)
    .filter((target) => !target.isArchivedFromDeletedSession)
    .filter((target) => normalize(`${target.title} ${target.text}`).includes(normalize(query)));

  const groupedReferences = visibleReferences.reduce<Record<string, DmReferenceTarget[]>>((groups, target) => {
    const key = target.type || "other";
    groups[key] = groups[key] ?? [];
    groups[key].push(target);
    return groups;
  }, {});

  const findTotal = activeScene && query ? normalize(activeScene.plainText).split(normalize(query)).length - 1 : 0;
  const dataSourceLabel =
    library.source === "supabase" ? "Supabase" : supabaseStatus === "tables-missing" ? "Локальный импорт" : "Импорт";

  function openSession(session: DmSession) {
    setOpenedSessionIds((current) => (current.includes(session.id) ? current : [...current, session.id]));
    setActiveSessionId(session.id);
    setMode("editor");
  }

  function createSession() {
    const now = new Date().toISOString();
    const session: DmSession = {
      id: createId(),
      title: "Новая сессия",
      sortIndex: sessions.length,
      isDeleted: false,
      createdAt: now,
      updatedAt: now
    };
    const scene = makeEmptyScene(session.id);
    setSessions((current) => [...current, session]);
    setScenes((current) => [...current, scene]);
    setOpenedSessionIds((current) => [...current, session.id]);
    setActiveSessionId(session.id);
    setActiveSceneId(scene.id);
  }

  function renameSession(session: DmSession) {
    const title = window.prompt("Название сессии", session.title);
    if (!title?.trim()) return;
    setSessions((current) => current.map((item) => (item.id === session.id ? { ...item, title: title.trim() } : item)));
  }

  function deleteSession(session: DmSession) {
    setSessions((current) => current.map((item) => (item.id === session.id ? { ...item, isDeleted: true } : item)));
    setOpenedSessionIds((current) => current.filter((id) => id !== session.id));
  }

  function closeSession(sessionId: string) {
    setOpenedSessionIds((current) => {
      const next = current.filter((id) => id !== sessionId);
      if (activeSessionId === sessionId && next[0]) setActiveSessionId(next[0]);
      return next.length ? next : current;
    });
  }

  function addScene() {
    if (!activeSession) return;
    const scene = makeEmptyScene(activeSession.id);
    setScenes((current) => [...current, scene]);
    setActiveSceneId(scene.id);
  }

  function renameScene(scene: DmScene) {
    const title = window.prompt("Название сцены", scene.title);
    if (!title?.trim()) return;
    setScenes((current) => current.map((item) => (item.id === scene.id ? { ...item, title: title.trim() } : item)));
  }

  function deleteScene(scene: DmScene) {
    setScenes((current) => current.filter((item) => item.id !== scene.id));
  }

  function openTargetById(id: string) {
    const target = references.find((item) => normalizeId(item.id) === normalizeId(id));
    if (target) setModal({ type: "reference", target, edit: false });
  }

  function archiveTarget(target: DmReferenceTarget) {
    setReferences((current) =>
      current.map((item) =>
        item.id === target.id
          ? {
              ...item,
              isArchivedFromDeletedSession: true,
              archivedSessionTitle: activeSession?.title ?? item.archivedSessionTitle
            }
          : item
      )
    );
  }

  function command(commandName: string) {
    editorRef.current?.focus();
    document.execCommand(commandName);
  }

  function setFontSize(delta: number) {
    const host = editorRef.current?.querySelector(".rich-text-host") as HTMLDivElement | null;
    if (!host) return;
    const current = Number(host.dataset.zoom ?? 1);
    const next = Math.min(1.4, Math.max(0.8, current + delta));
    host.dataset.zoom = String(next);
    host.style.setProperty("--editor-zoom", String(next));
  }

  function updateFindIndex(delta: number) {
    if (!findTotal) return;
    setFindIndex((current) => (current + delta + findTotal) % findTotal);
  }

  return (
    <div className="native-shell">
      <header className="window-bar">
        <div className="traffic-lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <nav className="session-tabs" aria-label="Открытые сессии">
          {openedSessions.map((session) => (
            <div className={session.id === activeSession?.id ? "session-tab active" : "session-tab"} key={session.id}>
              <button onClick={() => openSession(session)} type="button">
                {session.title}
              </button>
              <button aria-label="Close session" onClick={() => closeSession(session.id)} type="button">
                <X size={12} />
              </button>
            </div>
          ))}
          <button className="icon-button" onClick={createSession} title="Новая сессия" type="button">
            <Plus size={15} />
          </button>
        </nav>

        <div className="window-actions">
          <select
            aria-label="Открыть сессию"
            onChange={(event) => {
              const session = sessions.find((item) => item.id === event.target.value);
              if (session) openSession(session);
            }}
            value={activeSession?.id ?? ""}
          >
            {liveSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title}
              </option>
            ))}
          </select>
          <button className={mode === "editor" ? "seg-button active" : "seg-button"} onClick={() => setMode("editor")} type="button">
            <BookOpen size={14} />
            Редактор
          </button>
          <button className={mode === "library" ? "seg-button active" : "seg-button"} onClick={() => setMode("library")} type="button">
            <Library size={14} />
            Библиотека
          </button>
          <button className="icon-button" onClick={() => setIsFindVisible((value) => !value)} title="Поиск" type="button">
            <Search size={15} />
          </button>
        </div>
      </header>

      {isFindVisible ? (
        <div className="find-bar">
          <Search size={15} />
          <input
            autoFocus
            onChange={(event) => {
              setQuery(event.target.value);
              setFindIndex(0);
            }}
            placeholder="Найти в сцене и справочнике"
            value={query}
          />
          <span>{findTotal ? `${findIndex + 1} из ${findTotal}` : "0"}</span>
          <button onClick={() => updateFindIndex(-1)} type="button">
            <ChevronDown className="flip" size={14} />
          </button>
          <button onClick={() => updateFindIndex(1)} type="button">
            <ChevronDown size={14} />
          </button>
          <button onClick={() => setIsFindVisible(false)} type="button">
            <X size={14} />
          </button>
        </div>
      ) : null}

      <main className="native-workspace">
        <aside className="scene-sidebar">
          <div className="sidebar-header">
            <div>
              <span>Сессия</span>
              <strong>{activeSession?.title ?? "Нет сессии"}</strong>
            </div>
            <button onClick={() => activeSession && renameSession(activeSession)} title="Переименовать сессию" type="button">
              <MoreHorizontal size={15} />
            </button>
          </div>
          <div className="sidebar-toolbar">
            <button onClick={addScene} type="button">
              <Plus size={14} />
              Сцена
            </button>
            <button onClick={() => activeSession && deleteSession(activeSession)} type="button">
              <Archive size={14} />
            </button>
          </div>
          <div className="scene-list">
            {scenesForSession.map((scene) => (
              <SceneRow
                active={scene.id === activeScene?.id}
                key={scene.id}
                onDelete={() => deleteScene(scene)}
                onRename={() => renameScene(scene)}
                onSelect={() => setActiveSceneId(scene.id)}
                scene={scene}
              />
            ))}
          </div>
          <button className="deleted-button" onClick={() => setModal({ type: "deleted" })} type="button">
            <Archive size={14} />
            Удалённые материалы
            <span>{archivedReferences.length + deletedSessions.length}</span>
          </button>
        </aside>

        <section className="editor-pane">
          {mode === "editor" ? (
            <>
              <div className="editor-toolbar">
                <div className="toolbar-group">
                  <button onClick={() => command("bold")} title="Bold" type="button">
                    <Bold size={15} />
                  </button>
                  <button onClick={() => command("italic")} title="Italic" type="button">
                    <Italic size={15} />
                  </button>
                  <button onClick={() => command("underline")} title="Underline" type="button">
                    <Underline size={15} />
                  </button>
                </div>
                <div className="toolbar-group">
                  <button onClick={() => command("insertUnorderedList")} title="List" type="button">
                    <List size={15} />
                  </button>
                  <button onClick={() => command("formatBlock")} title="Quote" type="button">
                    <Quote size={15} />
                  </button>
                  <button onClick={() => command("insertHorizontalRule")} title="Divider" type="button">
                    <Minus size={15} />
                  </button>
                </div>
                <div className="toolbar-group">
                  <button onClick={() => setFontSize(-0.05)} title="Меньше" type="button">
                    A-
                  </button>
                  <button onClick={() => setFontSize(0.05)} title="Больше" type="button">
                    A+
                  </button>
                </div>
                <button className="toolbar-action" onClick={() => setModal({ type: "addReference" })} type="button">
                  <Link2 size={15} />
                  Reference
                </button>
                <button className="toolbar-action" onClick={() => setIsFindVisible(true)} type="button">
                  <Search size={15} />
                  Find
                </button>
                <span className="toolbar-spacer" />
                <span className="source-chip">
                  {library.source === "supabase" ? <CheckCircle2 size={13} /> : <PanelRightOpen size={13} />}
                  {dataSourceLabel}
                </span>
              </div>

              <div className="editor-scroll" ref={editorRef}>
                <div className="document-shell">
                  <div className="document-titlebar">
                    <div>
                      <span>{formatDate(activeScene?.updatedAt ?? null)}</span>
                      <strong>{activeScene?.title ?? "Нет сцены"}</strong>
                    </div>
                    <span>{activeScene ? countWords(activeScene.plainText) : 0} слов</span>
                  </div>
                  {activeScene ? <RichTextEditor onOpenReference={openTargetById} scene={activeScene} /> : null}
                </div>
              </div>
            </>
          ) : (
            <div className="reference-library-view">
              <header>
                <div>
                  <span>ReferenceLibraryView</span>
                  <strong>Библиотека справочника</strong>
                </div>
                <button onClick={() => setModal({ type: "addReference" })} type="button">
                  <Plus size={15} />
                  Добавить
                </button>
              </header>
              <div className="library-grid">
                {references
                  .filter((target) => !target.isArchivedFromDeletedSession)
                  .map((target) => (
                    <button
                      className={`library-card ${target.type}`}
                      key={target.id}
                      onClick={() => setModal({ type: "reference", target, edit: false })}
                      type="button"
                    >
                      <span>{referenceIcon(target.type)}</span>
                      <strong>{target.title}</strong>
                      <small>{target.text.slice(0, 160) || typeLabel(target.type)}</small>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </section>

        <aside className="inspector-pane">
          <div className="inspector-header">
            <div>
              <span>Inspector</span>
              <strong>Ссылки и материалы</strong>
            </div>
            <div>
              <button onClick={() => setModal({ type: "addReference" })} title="Добавить" type="button">
                <Plus size={15} />
              </button>
              <button onClick={() => setModal({ type: "deleted" })} title="Архив" type="button">
                <Archive size={15} />
              </button>
            </div>
          </div>

          <div className="add-target-block">
            <Link2 size={16} />
            <span>Выделенная ссылка откроет карточку. Новую карточку можно создать из Reference.</span>
          </div>

          <div className="scope-tabs">
            <button className={inspectorScope === "scene" ? "active" : ""} onClick={() => setInspectorScope("scene")} type="button">
              В сцене
            </button>
            <button className={inspectorScope === "shared" ? "active" : ""} onClick={() => setInspectorScope("shared")} type="button">
              Общие
            </button>
            <button className={inspectorScope === "all" ? "active" : ""} onClick={() => setInspectorScope("all")} type="button">
              Все
            </button>
          </div>

          <div className="target-groups">
            {Object.entries(groupedReferences).map(([type, targets]) => (
              <section className="target-group" key={type}>
                <button
                  className="group-heading"
                  onClick={() => setExpandedTypes((current) => ({ ...current, [type]: !current[type] }))}
                  type="button"
                >
                  {expandedTypes[type] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>{typeLabel(type)}</span>
                  <em>{targets.length}</em>
                </button>
                {expandedTypes[type]
                  ? targets.map((target) => (
                      <ReferenceRow
                        active={modal?.type === "reference" && modal.target.id === target.id}
                        key={target.id}
                        onDelete={() => archiveTarget(target)}
                        onEdit={() => setModal({ type: "reference", target, edit: true })}
                        onOpen={() => setModal({ type: "reference", target, edit: false })}
                        onPlayAudio={() => setAudioTitle(target.title)}
                        onShowImage={() => setModal({ type: "image", target })}
                        target={target}
                      />
                    ))
                  : null}
              </section>
            ))}
            {!visibleReferences.length ? (
              <div className="empty-inspector">
                <Scissors size={18} />
                <span>Нет ссылок</span>
              </div>
            ) : null}
          </div>
        </aside>
      </main>

      {audioTitle ? (
        <div className="floating-audio">
          <button type="button">
            <Play size={14} />
          </button>
          <span>{audioTitle}</span>
          <button onClick={() => setAudioTitle(null)} type="button">
            <X size={14} />
          </button>
        </div>
      ) : null}

      <DiceRoller />

      <Modal
        deletedSessions={deletedSessions}
        modal={modal}
        onClose={() => setModal(null)}
        onCreateTarget={(target) => setReferences((current) => [...current, target])}
        onRemoveArchivedTarget={(target) => setReferences((current) => current.filter((item) => item.id !== target.id))}
        onRestoreSession={(session) =>
          setSessions((current) => current.map((item) => (item.id === session.id ? { ...item, isDeleted: false } : item)))
        }
        onRestoreTarget={(target) =>
          setReferences((current) =>
            current.map((item) =>
              item.id === target.id
                ? { ...item, isArchivedFromDeletedSession: false, archivedSessionTitle: null }
                : item
            )
          )
        }
        onSaveTarget={(target) => setReferences((current) => current.map((item) => (item.id === target.id ? target : item)))}
        references={references}
      />
    </div>
  );
}
