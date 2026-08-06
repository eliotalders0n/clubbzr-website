import {HttpsError} from "firebase-functions/v2/https";

import {db} from "./firebase";

export interface EconomySettings {
  economyEnabled: boolean;
  maintenanceMode: boolean;
  transfersEnabled: boolean;
  pointPurchasesEnabled: boolean;
  tradingEnabled: boolean;
  pointsPerZmw: number | null;
  minPurchaseNgwee: number | null;
  maxPurchaseNgwee: number | null;
  maxTransferPoints: number | null;
  dailyTransferLimitPoints: number | null;
  tradeFeeBasisPoints: number;
  rewardMultiplierBasisPoints: number;
  escrowTimeoutHours: number;
  version: number;
}

export const DISABLED_ECONOMY_SETTINGS: EconomySettings = {
  economyEnabled: false,
  maintenanceMode: true,
  transfersEnabled: false,
  pointPurchasesEnabled: false,
  tradingEnabled: false,
  pointsPerZmw: null,
  minPurchaseNgwee: null,
  maxPurchaseNgwee: null,
  maxTransferPoints: null,
  dailyTransferLimitPoints: null,
  tradeFeeBasisPoints: 500,
  rewardMultiplierBasisPoints: 10000,
  escrowTimeoutHours: 168,
  version: 1,
};

export async function getEconomySettings(): Promise<EconomySettings> {
  const snapshot = await db.collection("settings").doc("economy").get();
  if (!snapshot.exists) return DISABLED_ECONOMY_SETTINGS;
  return {...DISABLED_ECONOMY_SETTINGS, ...snapshot.data()};
}

export function requireEconomyEnabled(
  settings: EconomySettings,
  capability: "transfers" | "purchases" | "trading"
): void {
  const enabled = capability === "transfers" ? settings.transfersEnabled :
    capability === "purchases" ? settings.pointPurchasesEnabled :
      settings.tradingEnabled;

  if (!settings.economyEnabled || settings.maintenanceMode || !enabled) {
    throw new HttpsError(
      "failed-precondition",
      "This economy feature is currently unavailable."
    );
  }
}
