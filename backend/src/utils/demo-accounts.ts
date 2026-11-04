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

/** Sample plans are hosted by non-loginable seed accounts; only test accounts can see or join them. */
export function isSimulatedHost(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase().endsWith(DEMO_EMAIL_SUFFIX);
}
/** Real members and test accounts live in separate worlds: neither sees the other's plans. */
export function sameDemoAudience(viewerEmail: string | null | undefined, hostEmail: string | null | undefined): boolean {
  return isDemoAccount(viewerEmail) === isDemoAccount(hostEmail);
}
