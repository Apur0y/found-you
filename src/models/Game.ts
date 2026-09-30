import { Schema, model, models, type Model, type ObjectId } from "mongoose";

export interface GameDoc {
  _id: ObjectId;
  title: string;
  sport?: string;
  date?: Date | null;
  teamA?: string;
  teamB?: string;
  gender?: string;
  graduationYear?: number;
  url?: string;
  source?: string;
  notes?: string;
  analysis?: {
    recruitingRelevant?: boolean;
    sport?: string;
    gender?: string;
    gameType?: string;
    summary?: string;
    confidence?: string;
    reason?: string;
    analyzedAt?: Date;
    analysisBasis?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const GameSchema = new Schema<GameDoc>(
  {
    title: { type: String, required: true, trim: true },
    sport: { type: String, trim: true },
    date: { type: Date, default: null },
    teamA: { type: String, trim: true },
    teamB: { type: String, trim: true },
    gender: { type: String, trim: true },
    graduationYear: { type: Number },
    url: { type: String, trim: true },
    source: { type: String, trim: true },
    notes: { type: String },
    analysis: {
      recruitingRelevant: { type: Boolean },
      gameType: { type: String },
      summary: { type: String },
      confidence: { type: String },
      gender: { type: String },
      reason: { type: String },
      analyzedAt: { type: Date },
      analysisBasis: { type: String },
    },
  },
  { timestamps: true }
);

GameSchema.index({ createdAt: -1 });

export const Game: Model<GameDoc> =
  (models.Game as Model<GameDoc>) || model<GameDoc>("Game", GameSchema);
