import profile from "../generated/profile.json";

/** Every place in town that maps to a page. Shared by the town, the Map menu, and the pages. */
export interface Place {
  id: string;
  name: string;
  href: string;
  emoji: string;
  blurb: string;
}

export const PLACES = [
  { id: "town", name: "Town Square", href: "/", emoji: "🏡", blurb: "The middle of town." },
  { id: "home", name: "Home", href: "/about", emoji: "🏠", blurb: "Who I am" },
  { id: "dev", name: "Dev Center", href: "/dev", emoji: "💻", blurb: "Projects, GitHub, and LeetCode" },
  { id: "career", name: "Career Hall", href: "/career", emoji: "💼", blurb: "Experience, education, and honors" },
  { id: "music", name: "Music Room", href: "/music", emoji: "🎧", blurb: "What I've been listening to" },
  { id: "arcade", name: "Arcade", href: "/arcade", emoji: "🕹️", blurb: "Play my Mancala bot" },
  { id: "garden", name: "Interests Garden", href: "/interests", emoji: "🌻", blurb: "Things I love outside of code" },
  { id: "twin", name: "Digital Twin", href: "/twin", emoji: "💬", blurb: "Ask my AI twin anything" },
] as const satisfies readonly Place[];

export type PlaceId = (typeof PLACES)[number]["id"];

export const placeById = (id: string): Place | undefined => PLACES.find((p) => p.id === id);

/** External destinations, from the profile. Links without a URL yet are kept (shown as "coming soon"). */
export interface ExternalLink {
  id: string;
  label: string;
  url: string | null;
}

export const EXTERNAL_LINKS: ExternalLink[] = profile.links;
export const externalLink = (id: string) => EXTERNAL_LINKS.find((l) => l.id === id);
