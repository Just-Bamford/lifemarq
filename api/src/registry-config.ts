// Registry Configuration for Lifemarq Federation
// Maps country codes to Soroban registry contract addresses

export const REGISTRY_CONTRACTS: Record<string, string> = {
  KE: process.env.REGISTRY_KE || "",
  NG: process.env.REGISTRY_NG || "",
  SN: process.env.REGISTRY_SN || "",
  DRC: process.env.REGISTRY_DRC || "",
  GH: process.env.REGISTRY_GH || "",
  TZ: process.env.REGISTRY_TZ || "",
  UG: process.env.REGISTRY_UG || "",
  RW: process.env.REGISTRY_RW || "",
  ET: process.env.REGISTRY_ET || "",
  ZA: process.env.REGISTRY_ZA || "",
};

export const LOCAL_COUNTRY_CODE = process.env.LOCAL_COUNTRY || "KE";
export const LOCAL_REGISTRY_CONTRACT = process.env.LOCAL_REGISTRY || "";

export function getRegistryForCountry(countryCode: string): string {
  const contract = REGISTRY_CONTRACTS[countryCode];
  if (!contract || contract === "") {
    throw new Error(`No registry configured for country: ${countryCode}`);
  }
  return contract;
}

export function getLocalRegistry(): string {
  if (!LOCAL_REGISTRY_CONTRACT) {
    throw new Error("Local registry not configured");
  }
  return LOCAL_REGISTRY_CONTRACT;
}

export function isCountryConfigured(countryCode: string): boolean {
  const contract = REGISTRY_CONTRACTS[countryCode];
  return contract !== undefined && contract !== "";
}

export function getConfiguredCountries(): string[] {
  return Object.entries(REGISTRY_CONTRACTS)
    .filter(([_, contract]) => contract !== "")
    .map(([country, _]) => country);
}
