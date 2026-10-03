import type { Profile } from "@dan-town/profile/schema";
import data from "../generated/profile.json";

/** The PUBLIC projection of the canonical profile (twin-only and private data are already stripped). */
export const profile = data as unknown as Profile;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatMonth(ym: string | null | undefined): string {
  if (!ym) return "Present";
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

export const formatRange = (start: string, end: string | null) => `${formatMonth(start)} – ${formatMonth(end)}`;

export const projectsByDate = () => [...profile.projects].sort((a, b) => b.date.localeCompare(a.date));

export const linkById = (id: string) => profile.links.find((l) => l.id === id && l.url);
