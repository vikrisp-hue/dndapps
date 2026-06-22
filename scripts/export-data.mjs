import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const dbPath = resolve(process.argv[2] ?? "DM Script.store");
const outputPath = resolve(process.argv[3] ?? "src/data/dm-script.json");
const appleEpochOffset = 978307200;

function query(sql) {
  const result = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 80
  });

  return JSON.parse(result || "[]");
}

function fromAppleDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return null;
  return new Date((seconds + appleEpochOffset) * 1000).toISOString();
}

function blobId(value) {
  return value || "";
}

function text(value) {
  return value ?? "";
}

function nullable(value) {
  return value === undefined || value === "" ? null : value;
}

function splitSharedIds(value) {
  if (!value) return [];
  return String(value)
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function scopeCss(css) {
  return css.replace(/(^|\n)(\s*)([^@\n{}][^{]+)\{/g, (match, lineStart, whitespace, selector) => {
    const scopedSelector = selector
      .split(",")
      .map((part) => `.rtf-document ${part.trim()}`)
      .join(", ");
    return `${lineStart}${whitespace}${scopedSelector} {`;
  });
}

function htmlFragmentFromCocoaHtml(html) {
  const style = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] ?? "";
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";
  if (!body.trim()) return null;

  return `<style>${scopeCss(style)}</style><div class="rtf-document">${body.trim()}</div>`;
}

const tempDir = mkdtempSync(join(tmpdir(), "dm-script-export-"));

function richTextHtmlForScene(sceneId) {
  const rtfPath = join(tempDir, `${sceneId}.rtf`);
  const bytes = execFileSync(
    "sqlite3",
    [
      dbPath,
      `SELECT writefile('${rtfPath.replaceAll("'", "''")}', ZRICHTEXTDATA) FROM ZSCENEDOCUMENT WHERE lower(hex(ZID))='${sceneId}';`
    ],
    { encoding: "utf8" }
  ).trim();

  if (!bytes || bytes === "0") return null;

  try {
    const html = execFileSync("textutil", ["-convert", "html", "-stdout", rtfPath], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 80
    });
    return htmlFragmentFromCocoaHtml(html);
  } catch {
    return null;
  }
}

const sessions = query(`
  SELECT
    lower(hex(ZID)) AS id,
    ZTITLE AS title,
    ZSORTINDEX AS sortIndex,
    ZISDELETED AS isDeleted,
    ZCREATEDAT AS createdAt,
    ZUPDATEDAT AS updatedAt
  FROM ZSESSIONDOCUMENT
  ORDER BY ZSORTINDEX, Z_PK
`).map((row) => ({
  id: blobId(row.id),
  title: text(row.title) || "Без названия",
  sortIndex: Number(row.sortIndex ?? 0),
  isDeleted: Boolean(row.isDeleted),
  createdAt: fromAppleDate(row.createdAt),
  updatedAt: fromAppleDate(row.updatedAt)
}));

const scenes = query(`
  SELECT
    lower(hex(ZID)) AS id,
    lower(hex(ZSESSIONID)) AS sessionId,
    ZTITLE AS title,
    ZSORTINDEX AS sortIndex,
    ZPLAINTEXTCACHE AS plainText,
    length(ZRICHTEXTDATA) AS richTextLength,
    ZMASTERNOTES AS masterNotes,
    ZCREATEDAT AS createdAt,
    ZUPDATEDAT AS updatedAt
  FROM ZSCENEDOCUMENT
  ORDER BY ZSORTINDEX, Z_PK
`).map((row) => ({
  id: blobId(row.id),
  sessionId: blobId(row.sessionId),
  title: text(row.title) || "Без названия",
  sortIndex: Number(row.sortIndex ?? 0),
  plainText: text(row.plainText),
  richTextHtml: Number(row.richTextLength ?? 0) > 0 ? richTextHtmlForScene(blobId(row.id)) : null,
  masterNotes: nullable(row.masterNotes),
  createdAt: fromAppleDate(row.createdAt),
  updatedAt: fromAppleDate(row.updatedAt)
}));

const references = query(`
  SELECT
    lower(hex(ZID)) AS id,
    ZTITLE AS title,
    ZTYPERAWVALUE AS type,
    ZNPCFIRSTNAME AS npcFirstName,
    ZNPCLASTNAME AS npcLastName,
    ZTEXT AS body,
    ZEXTERNALURL AS externalUrl,
    ZIMAGEPATH AS imagePath,
    ZAUDIOPATH AS audioPath,
    ZEXTERNALFILEPATH AS externalFilePath,
    ZSHAREDSESSIONIDS AS sharedSessionIds,
    ZISSHAREDACROSSALLSESSIONS AS isSharedAcrossAllSessions,
    ZISARCHIVEDFROMDELETEDSESSION AS isArchivedFromDeletedSession,
    ZARCHIVEDSESSIONTITLE AS archivedSessionTitle,
    ZCREATEDAT AS createdAt,
    ZUPDATEDAT AS updatedAt
  FROM ZREFERENCETARGET
  ORDER BY Z_PK
`).map((row) => ({
  id: blobId(row.id),
  title: text(row.title) || "Без названия",
  type: text(row.type) || "other",
  npcFirstName: nullable(row.npcFirstName),
  npcLastName: nullable(row.npcLastName),
  text: text(row.body),
  externalUrl: nullable(row.externalUrl),
  imagePath: nullable(row.imagePath),
  audioPath: nullable(row.audioPath),
  externalFilePath: nullable(row.externalFilePath),
  sharedSessionIds: splitSharedIds(row.sharedSessionIds),
  isSharedAcrossAllSessions: Boolean(row.isSharedAcrossAllSessions),
  isArchivedFromDeletedSession: Boolean(row.isArchivedFromDeletedSession),
  archivedSessionTitle: nullable(row.archivedSessionTitle),
  createdAt: fromAppleDate(row.createdAt),
  updatedAt: fromAppleDate(row.updatedAt)
}));

const textReferences = query(`
  SELECT
    lower(hex(ZID)) AS id,
    lower(hex(ZSCENEID)) AS sceneId,
    lower(hex(ZTARGETID)) AS targetId,
    ZACTIONRAWVALUE AS action,
    ZDISPLAYEDTEXT AS displayedText,
    ZRANGESTART AS rangeStart,
    ZRANGELENGTH AS rangeLength,
    ZCREATEDAT AS createdAt,
    ZUPDATEDAT AS updatedAt
  FROM ZTEXTREFERENCE
  ORDER BY Z_PK
`).map((row) => ({
  id: blobId(row.id),
  sceneId: blobId(row.sceneId),
  targetId: blobId(row.targetId),
  action: nullable(row.action),
  displayedText: nullable(row.displayedText),
  rangeStart: row.rangeStart === null || row.rangeStart === undefined ? null : Number(row.rangeStart),
  rangeLength: row.rangeLength === null || row.rangeLength === undefined ? null : Number(row.rangeLength),
  createdAt: fromAppleDate(row.createdAt),
  updatedAt: fromAppleDate(row.updatedAt)
}));

const library = {
  exportedAt: new Date().toISOString(),
  sessions,
  scenes,
  references,
  textReferences
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(library, null, 2)}\n`, "utf8");
rmSync(tempDir, { recursive: true, force: true });

console.log(`Exported ${sessions.length} sessions, ${scenes.length} scenes, ${references.length} references, ${textReferences.length} links.`);
