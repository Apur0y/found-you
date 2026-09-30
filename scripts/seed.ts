/**
 * Seed script — loads sample records so the dashboard works immediately.
 * Run with: npm run seed
 *
 * Only factual sample data is seeded (games, leads, contact info, workflow status).
 * No AI content is pre-generated: analysis, research, scoring and outreach are
 * produced live by the Gemini API when the user runs them.
 *
 * Reads MONGODB_URI from .env.local if present, then clears and repopulates
 * games and leads.
 */
import fs from "node:fs";
import path from "node:path";

// Minimal .env.local loader (avoids requiring dotenv at runtime).
function loadEnvFile(file: string) {
  try {
    const content = fs.readFileSync(file, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // no .env.local — rely on real env vars
  }
}
loadEnvFile(path.join(process.cwd(), ".env.local"));

import mongoose from "mongoose";
import { Game } from "../src/models/Game";
import { Lead } from "../src/models/Lead";
import { Outreach } from "../src/models/Outreach";

const MONGODB_URI = process.env.MONGODB_URI?.trim();
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set (add .env.local). Aborting seed.");
  process.exit(1);
}
const MONGO_URL: string = MONGODB_URI;

async function main() {
  await mongoose.connect(MONGO_URL);
  console.log("Connected to MongoDB.");

  await Promise.all([
    Game.deleteMany({}),
    Lead.deleteMany({}),
    Outreach.deleteMany({}),
  ]);
  console.log("Cleared existing data.");

  const daysAgo = (n: number) =>
    new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

  // ------------------------------------------------------------------ games
  const games = await Game.insertMany([
    {
      title: "2027 Girls Soccer — Riverside HS vs Valley Prep",
      sport: "soccer",
      gender: "female",
      date: new Date(daysAgo(6)),
      teamA: "Riverside HS",
      teamB: "Valley Prep",
      graduationYear: 2027,
      url: "https://www.youtube.com/watch?v=full-game-example-1",
      source: "YouTube",
      notes: "Full-game upload from a team channel.",
    },
    {
      title: "2026 Boys Basketball — Lincoln vs Jefferson",
      sport: "basketball",
      gender: "male",
      date: new Date(daysAgo(4)),
      teamA: "Lincoln",
      teamB: "Jefferson",
      graduationYear: 2026,
      url: "https://www.youtube.com/watch?v=full-game-example-2",
      source: "YouTube",
      notes: "League playoff game.",
    },
    {
      title: "2027 Softball — Eastside Showcase",
      sport: "softball",
      gender: "female",
      date: new Date(daysAgo(9)),
      teamA: "Eastside",
      teamB: "Westview",
      graduationYear: 2027,
      url: "https://www.youtube.com/watch?v=full-game-example-3",
      source: "Team livestream",
    },
    {
      title: "2026 Varsity Baseball — Summit County Highlights",
      sport: "baseball",
      gender: "male",
      date: new Date(daysAgo(2)),
      teamA: "Summit",
      teamB: "Napoleon",
      graduationYear: 2026,
      url: "https://www.youtube.com/watch?v=highlights-example-4",
      source: "YouTube",
      notes: "Appears to be a highlights reel, not a full game.",
    },
    {
      title: "2028 Boys Lacrosse — North Star vs Brooksfield",
      sport: "lacrosse",
      gender: "male",
      date: new Date(daysAgo(1)),
      teamA: "North Star",
      teamB: "Brooksfield",
      graduationYear: 2028,
      url: "https://www.youtube.com/watch?v=full-game-example-5",
      source: "YouTube",
      notes: "",
    },
    {
      title: "2027 Volleyball — Catskill Invitational",
      sport: "volleyball",
      gender: "female",
      date: new Date(daysAgo(3)),
      teamA: "Catskill",
      teamB: "Ridgefield",
      graduationYear: 2027,
      url: "https://www.youtube.com/watch?v=full-game-example-6",
      source: "Facebook live",
      notes: "Scheduled tournament match.",
    },
  ]);
  console.log(`Seeded ${games.length} games.`);

  const g = (t: string) => games.find((x) => x.title.includes(t))?._id ?? null;

  // ------------------------------------------------------------------ leads
  const leadDocs = [
    {
      name: "Megan Torres",
      playerName: "Alina Torres",
      contactType: "parent",
      sport: "soccer",
      position: "forward",
      team: "Riverside HS",
      graduationYear: 2027,
      email: "megantorres@example.com",
      socialUrl: "https://facebook.com/megan.torres.example",
      profileUrl: "",
      gameId: g("Riverside"),
      status: "new",
      source: "YouTube comment",
      notes: "Full-game footage posted; no highlight video found in search.",
    },
    {
      name: "Coach Derrick Whitfield",
      playerName: "Malik Brooks",
      contactType: "coach",
      sport: "basketball",
      position: "guard",
      team: "Lincoln",
      graduationYear: 2026,
      email: "coach.whitfield@example.com",
      socialUrl: "",
      profileUrl: "https://example.com/prep-recruits/malik-brooks",
      gameId: g("Lincoln"),
      status: "new",
      source: "Roster link",
      notes: "Malik is listed on a public prep recruiting profile.",
    },
    {
      name: "Hannah Reyes",
      playerName: "Hannah Reyes",
      contactType: "athlete",
      sport: "softball",
      position: "pitcher",
      team: "Eastside",
      graduationYear: 2027,
      email: "",
      socialUrl: "https://facebook.com/hannah.reyes.example",
      profileUrl: "",
      gameId: g("Eastside"),
      status: "new",
      source: "Facebook group",
      notes: "Public FB post about the showcase; pitcher for Eastside.",
    },
    {
      name: "Baseball scouts' inbox",
      playerName: "Elias Vance",
      contactType: "unknown",
      sport: "baseball",
      position: "shortstop",
      team: "Summit",
      graduationYear: 2026,
      email: "",
      socialUrl: "",
      profileUrl: "https://example.com/recruiting/elias-vance",
      gameId: g("Summit"),
      status: "new",
      source: "Web search",
      notes: "Only highlights reel exists; no full-game footage identified.",
    },
    {
      name: "Liam Park",
      playerName: "Liam Park",
      contactType: "athlete",
      sport: "lacrosse",
      position: "attack",
      team: "North Star",
      graduationYear: 2028,
      email: "liampark@example.com",
      socialUrl: "",
      profileUrl: "",
      gameId: g("North Star"),
      status: "new",
      source: "Manual",
      notes: "Freshly added; not yet scored.",
    },
    {
      name: "Ridgefield Volleyball Parents",
      playerName: "Sofia Marchetti",
      contactType: "parent",
      sport: "volleyball",
      position: "setter",
      team: "Catskill",
      graduationYear: 2027,
      email: "sofiamarchetti.fan@gmail.com",
      socialUrl: "",
      profileUrl: "",
      gameId: g("Catskill"),
      status: "contacted",
      source: "Team post",
      notes: "Contacted candidate; awaiting reply.",
    },
    {
      name: "Westview Athletics Office",
      playerName: "Westview Softball",
      contactType: "team",
      sport: "softball",
      team: "Westview",
      graduationYear: 2027,
      email: "athletics@westview.example.com",
      socialUrl: "",
      profileUrl: "",
      gameId: g("Eastside"),
      status: "replied",
      source: "Website form",
      notes: "Team-level contact — replied, mentioned budget review.",
    },
    {
      name: "Do Not Contact Example",
      playerName: "Trent Cooper",
      contactType: "athlete",
      sport: "football",
      position: "linebacker",
      team: "Napoleon",
      graduationYear: 2026,
      email: "",
      socialUrl: "",
      profileUrl: "",
      gameId: null,
      status: "do_not_contact",
      source: "Manual",
      notes: "Asked not to be contacted.",
    },
    {
      name: "Converted Customer",
      playerName: "Kenji Sato",
      contactType: "parent",
      sport: "hockey",
      team: "Ice Ridge",
      graduationYear: 2026,
      email: "kenjisato@example.com",
      socialUrl: "",
      profileUrl: "",
      gameId: null,
      status: "converted",
      source: "Manual",
      notes: "Completed a highlight reel for Kenji.",
    },
  ];

  const leads = await Lead.insertMany(leadDocs as never);
  console.log(`Seeded ${leads.length} leads.`);

  await mongoose.disconnect();
  console.log("Done. Run `npm run dev` and open http://localhost:3000");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});