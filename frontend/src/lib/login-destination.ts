/** Only return to app-owned routes, never a protocol-relative or external URL. */
export function loginDestination(
  from: unknown,
  onboardingComplete: boolean,
  verified: boolean,
): string {
  if (!verified) return "/verify-email-pending";
  if (!onboardingComplete) return "/profile-setup";
  if (
    typeof from === "string" &&
    /^\/(?:home|discover|explore|matches|messages|live|profile|settings|notifications|experiences|verify|licenses|admin)(?:[/?#]|$)/.test(
      from,
    ) &&
    !from.includes("\\")
  )
    return from;
  return "/experiences";
}
