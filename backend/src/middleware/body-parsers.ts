import express, { type Express } from "express";

/** Signed webhooks must see the exact bytes, before the general JSON parser. */
export function installBodyParsers(app: Express) {
  app.use("/webhooks", express.raw({ type: () => true, limit: "1mb" }));
  app.use(express.json({ limit: "1mb", strict: true }));
}
