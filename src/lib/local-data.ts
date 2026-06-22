import rawData from "@/data/dm-script.json";
import type { DmLibrary } from "@/types/dm";

type RawLibrary = Omit<DmLibrary, "source"> & {
  exportedAt?: string;
};

const data = rawData as RawLibrary;

export function getLocalLibrary(): DmLibrary {
  return {
    sessions: data.sessions,
    scenes: data.scenes,
    references: data.references,
    textReferences: data.textReferences,
    source: "local"
  };
}
