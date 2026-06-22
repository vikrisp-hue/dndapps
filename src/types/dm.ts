export type ReferenceType = "npc" | "faction" | "other" | string;

export type DmSession = {
  id: string;
  title: string;
  sortIndex: number;
  isDeleted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DmScene = {
  id: string;
  sessionId: string;
  title: string;
  sortIndex: number;
  plainText: string;
  richTextHtml: string | null;
  masterNotes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DmReferenceTarget = {
  id: string;
  title: string;
  type: ReferenceType;
  npcFirstName: string | null;
  npcLastName: string | null;
  text: string;
  externalUrl: string | null;
  imagePath: string | null;
  audioPath: string | null;
  externalFilePath: string | null;
  sharedSessionIds: string[];
  isSharedAcrossAllSessions: boolean;
  isArchivedFromDeletedSession: boolean;
  archivedSessionTitle: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DmTextReference = {
  id: string;
  sceneId: string;
  targetId: string;
  action: string | null;
  displayedText: string | null;
  rangeStart: number | null;
  rangeLength: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DmLibrary = {
  sessions: DmSession[];
  scenes: DmScene[];
  references: DmReferenceTarget[];
  textReferences: DmTextReference[];
  source: "supabase" | "local";
};
