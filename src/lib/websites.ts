export const WEBSITE_CATEGORIES = [
  "video_footage",
  "rosters_stats",
  "recruiting",
  "news_schedules",
  "directory",
  "other",
] as const;

export type WebsiteCategory = (typeof WEBSITE_CATEGORIES)[number];

export const WEBSITE_CATEGORY_LABELS: Record<WebsiteCategory, string> = {
  video_footage: "Video & footage",
  rosters_stats: "Rosters & stats",
  recruiting: "Recruiting",
  news_schedules: "News & schedules",
  directory: "Directory",
  other: "Other",
};
