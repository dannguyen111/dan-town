import profile from "../generated/profile.json";

/** Every place in town that maps to a page. Shared by the town, the Map menu, and the pages. */
export interface Place {
  id: string;
  name: string;
  href: string;
  emoji: string;
  blurb: string;
  /** For a place inside a building (LeBronette's desk): the room it opens beside. */
  room?: string;
}

export const PLACES = [
  { id: "town", name: "Town Square", href: "/", emoji: "🏡", blurb: "The middle of town." },
  { id: "home", name: "Home", href: "/about", emoji: "🏠", blurb: "Who I am" },
  { id: "dev", name: "Dev Center", href: "/dev", emoji: "💻", blurb: "Projects, experience, and credentials" },
  { id: "lab", name: "Research Lab", href: "/lab", emoji: "🔬", blurb: "Research, methods, and what I want to study next" },
  { id: "music", name: "Music Room", href: "/music", emoji: "🎧", blurb: "What I've been listening to" },
  { id: "arcade", name: "Arcade", href: "/arcade", emoji: "🕹️", blurb: "Play my Mancala bot" },
  { id: "garden", name: "Interests Garden", href: "/interests", emoji: "🌻", blurb: "Things I love outside of code" },
  { id: "twin", name: "Digital Twin", href: "/twin", emoji: "💬", blurb: "Ask my AI twin anything" },
  { id: "reception", name: "Front Desk", href: "/reception", emoji: "🎧", blurb: "LeBronette, at the Dev Center, tells you about me", room: "dev" },
] as const satisfies readonly Place[];

export type PlaceId = (typeof PLACES)[number]["id"];

export const placeById = (id: string): Place | undefined => PLACES.find((p) => p.id === id);

/** Places inside a building, by the room they open beside, e.g. { reception: "dev" }. */
export const PLACE_ROOMS: Record<string, string> = Object.fromEntries(
  (PLACES as readonly Place[]).flatMap((p) => (p.room ? [[p.id, p.room]] : [])),
);

/** External destinations, from the profile. Links without a URL yet are kept (shown as "coming soon"). */
export interface ExternalLink {
  id: string;
  label: string;
  url: string | null;
}

export const EXTERNAL_LINKS: ExternalLink[] = profile.links;
export const externalLink = (id: string) => EXTERNAL_LINKS.find((l) => l.id === id);
