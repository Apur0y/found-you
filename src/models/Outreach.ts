import { Schema, model, models, type Model, type ObjectId } from "mongoose";

export interface OutreachDoc {
  _id: ObjectId;
  leadId: ObjectId;
  message: string;
  channel?: "email" | "facebook" | "instagram" | "other";
  status: "draft" | "approved" | "sent" | "replied";
  sentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const OutreachSchema = new Schema<OutreachDoc>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    message: { type: String, required: true },
    channel: {
      type: String,
      enum: ["email", "facebook", "instagram", "other"],
      default: "other",
    },
    status: {
      type: String,
      enum: ["draft", "approved", "sent", "replied"],
      default: "draft",
    },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Outreach: Model<OutreachDoc> =
  (models.Outreach as Model<OutreachDoc>) ||
  model<OutreachDoc>("Outreach", OutreachSchema);
