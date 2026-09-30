import { Schema, model, models, type Model, type ObjectId } from "mongoose";
import { WEBSITE_CATEGORIES, type WebsiteCategory } from "@/lib/websites";

export interface WebsiteDoc {
  _id: ObjectId;
  name: string;
  url: string;
  category: WebsiteCategory;
  sports: string[];
  region: string;
  access: string;
  description: string;
  useCase: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebsiteSchema = new Schema<WebsiteDoc>(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: WEBSITE_CATEGORIES,
      default: "other",
      index: true,
    },
    sports: [{ type: String, trim: true }],
    region: { type: String, trim: true, default: "National" },
    access: { type: String, trim: true, default: "Free" },
    description: { type: String, trim: true },
    useCase: { type: String, trim: true },
    notes: { type: String },
  },
  { timestamps: true }
);

WebsiteSchema.index({ name: 1 });
WebsiteSchema.index({ sports: 1 });

export const Website: Model<WebsiteDoc> =
  (models.Website as Model<WebsiteDoc>) ||
  model<WebsiteDoc>("Website", WebsiteSchema);
