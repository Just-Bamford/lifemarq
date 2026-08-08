/**
 * Registry Configuration for Lifemarq Federation
 *
 * Maps country codes to their Soroban registry contract addresses.
 * Enables cross-border queries across multiple African registries.
 */

import { Address } from "@stellar/js-stellar-sdk";

/**
 * Registry contract addresses by country code (ISO 3166-1 alpha-2)
 *
 * Environment variables should be set as:
 * - REGISTRY_KE = Kenya registry contract ID
 * - REGISTRY_NG = Nigeria registry contract ID
 * - etc.
 */
export const REGISTRY_CONTRACTS: Record<string, string> = {
  KE: process.env.REGISTRY_KE || "", // Kenya
  NG: process.env.REGISTRY_NG || "", // Nigeria
  SN: process.env.REGISTRY_SN || "", // Senegal
  DRC: process.env.REGISTRY_DRC || "", // Democratic Republic of Congo
  GH: process.env.REGISTRY_GH || "", // Ghana
  TZ: process.env.REGISTRY_TZ || "", // Tanzania
  UG: process.env.REGISTRY_UG || "", // Uganda
  RW: process.env.REGISTRY_RW || "", // Rwanda
  ET: process.env.REGISTRY_ET || "", // Ethiopia
  ZA: process.env.REGISTRY_ZA || "", // South Africa
};

/**
 * Local registry configuration
 * Set to the country where THIS API instance is deployed
 */
export const LOCAL_COUNTRY_CODE = process.env.LOCAL_COUNTRY || "KE";
export const LOCAL_REGISTRY_CONTRACT = process.env.LOCAL_REGISTRY || "";

/**
 * Get registry contract address for a country
 *
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns Contract address string
 * @throws Error if country not configured
 */
export function getRegistryForCountry(countryCode: string): string {
  const contract = REGISTRY_CONTRACTS[countryCode];
  if (!contract || contract === "") {
    throw new Error(
      `No registry configured for country: ${countryCode}. ` +
        `Set REGISTRY_${countryCode} environment variable.`,
    );
  }
  return contract;
}

/**
 * Get local registry contract address
 *
 * @returns Local registry contract address
 * @throws Error if not configured
 */
export function getLocalRegistry(): string {
  if (!LOCAL_REGISTRY_CONTRACT || LOCAL_REGISTRY_CONTRACT === "") {
    throw new Error(
      `Local registry not configured. Set LOCAL_REGISTRY environment variable.`,
    );
  }
  return LOCAL_REGISTRY_CONTRACT;
}

/**
 * Validate country code
 *
 * @param countryCode - Country code to validate
 * @returns true if registry exists for this country
 */
export function isCountryConfigured(countryCode: string): boolean {
  const contract = REGISTRY_CONTRACTS[countryCode];
  return contract !== undefined && contract !== "";
}

/**
 * Get list of all configured countries
 *
 * @returns Array of country codes that have registries configured
 */
export function getConfiguredCountries(): string[] {
  return Object.entries(REGISTRY_CONTRACTS)
    .filter(([_, contract]) => contract !== "")
    .map(([country, _]) => country);
}

/**
 * Convert country code to human-readable name
 */
const COUNTRY_NAMES: Record<string, string> = {
  KE: "Kenya",
  NG: "Nigeria",
  SN: "Senegal",
  DRC: "Democratic Republic of Congo",
  GH: "Ghana",
  TZ: "Tanzania",
  UG: "Uganda",
  RW: "Rwanda",
  ET: "Ethiopia",
  ZA: "South Africa",
};

export function getCountryName(countryCode: string): string {
  return COUNTRY_NAMES[countryCode] || countryCode;
}

/**
 * Validate contract address format
 */
export function isValidContractAddress(address: string): boolean {
  // Soroban contract addresses start with 'C' and are 56 characters
  return /^C[A-Z2-7]{55}$/.test(address);
}

/**
 * Initialize and validate registry configuration
 * Called at startup to ensure all registries are properly configured
 */
export function validateConfiguration(): string[] {
  const errors: string[] = [];

  // Check local registry
  if (!LOCAL_REGISTRY_CONTRACT || LOCAL_REGISTRY_CONTRACT === "") {
    errors.push("LOCAL_REGISTRY not configured");
  } else if (!isValidContractAddress(LOCAL_REGISTRY_CONTRACT)) {
    errors.push(`Invalid LOCAL_REGISTRY address: ${LOCAL_REGISTRY_CONTRACT}`);
  }

  // Check configured registries
  const configured = getConfiguredCountries();
  if (configured.length === 0) {
    errors.push(
      "No registries configured. Set at least one REGISTRY_XX environment variable.",
    );
  }

  // Validate all addresses
  for (const [country, contract] of Object.entries(REGISTRY_CONTRACTS)) {
    if (contract === "") continue;
    if (!isValidContractAddress(contract)) {
      errors.push(`Invalid contract address for ${country}: ${contract}`);
    }
  }

  return errors;
}

/**
 * Log registry configuration (for debugging)
 */
export function logConfiguration(): void {
  console.log("=== Registry Configuration ===");
  console.log(`Local Country: ${LOCAL_COUNTRY_CODE}`);
  console.log(`Local Registry: ${LOCAL_REGISTRY_CONTRACT}`);
  console.log("\nConfigured Registries:");

  for (const country of getConfiguredCountries()) {
    console.log(
      `  ${country} (${getCountryName(country)}): ${REGISTRY_CONTRACTS[country]}`,
    );
  }

  console.log(
    `\nTotal: ${getConfiguredCountries().length} registries configured`,
  );
}
