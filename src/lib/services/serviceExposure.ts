/**
 * Embedded-service model exposure gate.
 *
 * Centralizes the decision of whether an embedded service's synced models
 * should be advertised in /v1/models and the combo builder.
 *
 * Gating (all must hold):
 *  1. providerExpose flag is true (set via the 9Router Exposure card on the
 *     services tab — stored in version_manager.providerExpose).
 *  2. The service supervisor reports state === "running" — never advertise
 *     models for a dead/stopped service (prevents "exposed forever" lying
 *     listings when the embedded service is down).
 *  3. The provider is NOT in settings.blockedProviders — the existing Security
 *     tab "Blocked Providers" chip is the user-facing kill-switch for exposure.
 *
 * This is the single source of truth consumed by catalog.ts and
 * builderOptions.ts so the two surfaces stay consistent.
 */

import { getDbInstance } from "@/lib/db/core";
import { getSupervisor } from "@/lib/services/registry";

export function isServiceExposed(
  tool: string,
  settings: { blockedProviders?: unknown } | null | undefined
): boolean {
  const settingsRecord = settings as Record<string, unknown> | null;
  if (Array.isArray(settingsRecord?.blockedProviders) && settingsRecord!.blockedProviders.includes(tool)) {
    return false;
  }

  const supervisor = getSupervisor(tool);
  if (!supervisor || supervisor.getStatus().state !== "running") return false;

  return readProviderExpose(tool);
}

function readProviderExpose(tool: string): boolean {
  try {
    const row = getDbInstance()
      .prepare("SELECT provider_expose FROM version_manager WHERE tool = ?")
      .get(tool) as { provider_expose?: number } | undefined;
    return row?.provider_expose === 1;
  } catch {
    return false;
  }
}
