import { Schema, model, models, type Model, type ObjectId } from "mongoose";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/statuses";
import type { EvidenceKind } from "@/types";

export interface EvidenceDoc {
  text: string;
  kind: EvidenceKind;
  source?: string;
}

export interface LeadDoc {
  _id: ObjectId;
  name: string;
  playerName?: string;
  contactType?: "parent" | "athlete" | "coach" | "team" | "agency" | "unknown";
  sport?: string;
  position?: string;
  team?: string;
  graduationYear?: number;
  email?: string;
  socialUrl?: string;
  profileUrl?: string;
  gameId?: ObjectId | null;
  score?: number;
  scoreReasons?: string[];
  confidence?: string;
  recommendedAction?: string;
  status: LeadStatus;
  source?: string;
  verifiedInformation?: string[];
  inferredInformation?: string[];
  missingInformation?: string[];
  evidence?: EvidenceDoc[];
  research?: {
    knownInformation: string[];
    possibleSignals: string[];
    missingInformation: string[];
    whyThisLead: string;
    suggestedAngle: string;
  };
  outreachMessage?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<LeadDoc>(
  {
    name: { type: String, required: true, trim: true },
    playerName: { type: String, trim: true },
    contactType: {
      type: String,
      enum: ["parent", "athlete", "coach", "team", "agency", "unknown"],
      default: "unknown",
    },
    sport: { type: String, trim: true },
    position: { type: String, trim: true },
    team: { type: String, trim: true },
    graduationYear: { type: Number },
    email: { type: String, trim: true },
    socialUrl: { type: String, trim: true },
    profileUrl: { type: String, trim: true },
    gameId: { type: Schema.Types.ObjectId, ref: "Game", default: null },
    score: { type: Number, min: 0, max: 100 },
    scoreReasons: [{ type: String }],
    confidence: { type: String },
    recommendedAction: { type: String },
    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: "new",
      index: true,
    },
    source: { type: String, trim: true },
    verifiedInformation: [{ type: String }],
    inferredInformation: [{ type: String }],
    missingInformation: [{ type: String }],
    evidence: [
      {
        _id: false,
        text: { type: String, required: true },
        kind: {
          type: String,
          enum: ["verified", "ai_inferred", "user_entered"],
          required: true,
        },
        source: { type: String },
      },
    ],
    research: {
      _id: false,
      knownInformation: [{ type: String }],
      possibleSignals: [{ type: String }],
      missingInformation: [{ type: String }],
      whyThisLead: { type: String },
      suggestedAngle: { type: String },
    },
    outreachMessage: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

LeadSchema.index({ sport: 1 });
LeadSchema.index({ team: 1 });
LeadSchema.index({ score: -1 });
LeadSchema.index({ name: "text", playerName: "text", team: "text" });

export const Lead: Model<LeadDoc> =
  (models.Lead as Model<LeadDoc>) || model<LeadDoc>("Lead", LeadSchema);
