import type { Prisma } from "@prisma/client";
export const DEMO_EMAIL_SUFFIX = "@simp-seed.demo";
export function isDemoAccount(email: string | null | undefined): boolean {
  const value = (email ?? "").trim().toLowerCase();
  return value.endsWith(DEMO_EMAIL_SUFFIX) || value === "review@sim-p.app";
}
/** Only reserved, authenticated test accounts can discover the synthetic pool. */
export function discoveryAudience(email: string): Prisma.UserWhereInput {
  const demo: Prisma.UserWhereInput = {
    OR: [
      { email: { endsWith: DEMO_EMAIL_SUFFIX, mode: "insensitive" } },
      { email: { equals: "review@sim-p.app", mode: "insensitive" } },
    ],
  };
  return isDemoAccount(email) ? demo : { NOT: demo };
}
