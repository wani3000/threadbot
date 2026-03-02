import type { Source } from "./types";

export function isOfficialRecruitSource(source: Pick<Source, "name" | "url">): boolean {
  const v = `${source.name} ${source.url}`.toLowerCase();
  return (
    v.includes("recruiter.co.kr") ||
    v.includes("recruit.") ||
    v.includes("careers.") ||
    v.includes("/careers") ||
    v.includes("/career") ||
    v.includes("koreanair.recruiter.co.kr") ||
    v.includes("flyasiana.recruiter.co.kr") ||
    v.includes("/career/") ||
    v.includes("/recruit") ||
    v.includes("/apply") ||
    v.includes("flight-attendant") ||
    v.includes("cabin-crew") ||
    v.includes("employ")
  );
}
