// i18n configuration for Lifemarq
// Supports English, Swahili, and French

export type Locale = "en" | "sw" | "fr";

export const locales: Locale[] = ["en", "sw", "fr"];
export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  sw: "Swahili (Kiswahili)",
  fr: "Français (French)",
};

// Messages for each locale
export const messages: Record<Locale, Record<string, string>> = {
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.donor": "Donor Registration",
    "nav.hospital": "Hospital Query",
    "nav.about": "About",

    // Donor Portal
    "donor.title": "Donor Registration Portal",
    "donor.description":
      "Register your organ donation preferences securely on the Stellar blockchain.",
    "donor.nationalId": "National ID",
    "donor.nationalId.placeholder": "Enter your national ID",
    "donor.nationalId.hint":
      "Your ID is hashed with SHA-256 in your browser before anything is sent.",
    "donor.organs": "Select Organs to Donate",
    "donor.kidney": "Kidney",
    "donor.liver": "Liver",
    "donor.heart": "Heart",
    "donor.lungs": "Lungs",
    "donor.pancreas": "Pancreas",
    "donor.corneas": "Corneas",
    "donor.register": "Register & Sign with Freighter",
    "donor.registering": "Building transaction...",
    "donor.success": "✓ Registration successful! Your consent is now on-chain.",
    "donor.error": "Registration failed",

    // Hospital Portal
    "hospital.title": "Hospital Consent Query",
    "hospital.description":
      "Query a patient's organ donation consent status before surgery.",
    "hospital.patientId": "Patient ID Hash (SHA-256)",
    "hospital.patientId.placeholder": "Enter hashed patient ID (64-char hex)",
    "hospital.query": "Query Consent Status",
    "hospital.querying": "Querying...",
    "hospital.consentActive": "✓ Consent Active",
    "hospital.noConsent": "No Active Consent Found",

    // General
    "button.connect": "Connect Freighter Wallet",
    "button.register": "Register",
    "button.query": "Query",
    "button.clear": "Clear",
    "status.connecting": "Connecting...",
    "status.loading": "Loading...",
    privacy: "Privacy & Security",
    security: "Security",
  },
  sw: {
    // Navigation
    "nav.home": "Nyumbani",
    "nav.donor": "Usajili wa Mtoaji",
    "nav.hospital": "Hospitali Ombi",
    "nav.about": "Kuhusu",

    // Donor Portal
    "donor.title": "Kituo cha Usajili wa Mtoaji Wa Viungo",
    "donor.description":
      "Sajili mapenzi yako ya kuchangia viungo kwa usalama kwenye blockchain ya Stellar.",
    "donor.nationalId": "Kitambulisho cha Kitaifa",
    "donor.nationalId.placeholder": "Ingiza kitambulisho chako cha kitaifa",
    "donor.nationalId.hint":
      "Kitambulisho chako kitatanganishwa kwa SHA-256 kwenye brauza yako kabla jambo lolote kilitumwe.",
    "donor.organs": "Chagua Viungo vya Kuchangia",
    "donor.kidney": "Ini",
    "donor.liver": "Ini ya Kuku",
    "donor.heart": "Moyo",
    "donor.lungs": "Mapafu",
    "donor.pancreas": "Pancreas",
    "donor.corneas": "Kila",
    "donor.register": "Sajili & Tia Sahihi na Freighter",
    "donor.registering": "Kujenga muamala...",
    "donor.success":
      "✓ Usajili umefanikiwa! Ridhaa yako sasa iko kwenye blockchain.",
    "donor.error": "Usajili halikufanikiwa",

    // Hospital Portal
    "hospital.title": "Ombi la Hospitali Kuhusu Ridhaa",
    "hospital.description":
      "Ombi juu ya hali ya ridhaa ya changia viungo vya mgonjwa kabla ya operesheni.",
    "hospital.patientId": "Hash ya Kitambulisho cha Mgonjwa (SHA-256)",
    "hospital.patientId.placeholder":
      "Ingiza hash iliyotanganishwa ya kitambulisho cha mgonjwa (64-char hex)",
    "hospital.query": "Ombi Hali ya Ridhaa",
    "hospital.querying": "Ombi inayofanya...",
    "hospital.consentActive": "✓ Ridhaa Hai",
    "hospital.noConsent": "Ridhaa Hai Haipo",

    // General
    "button.connect": "Unganisha Pochi ya Freighter",
    "button.register": "Sajili",
    "button.query": "Ombi",
    "button.clear": "Safisha",
    "status.connecting": "Kuunganisha...",
    "status.loading": "Kupakia...",
    privacy: "Faragha & Usalama",
    security: "Usalama",
  },
  fr: {
    // Navigation
    "nav.home": "Accueil",
    "nav.donor": "Inscription des Donneurs",
    "nav.hospital": "Requête Hôpital",
    "nav.about": "À propos",

    // Donor Portal
    "donor.title": "Portail d'Inscription des Donneurs",
    "donor.description":
      "Enregistrez vos préférences de don d'organes en toute sécurité sur la blockchain Stellar.",
    "donor.nationalId": "Pièce d'Identité Nationale",
    "donor.nationalId.placeholder":
      "Entrez votre numéro d'identification nationale",
    "donor.nationalId.hint":
      "Votre identifiant sera haché avec SHA-256 dans votre navigateur avant d'être envoyé.",
    "donor.organs": "Sélectionnez les Organes à Donner",
    "donor.kidney": "Rein",
    "donor.liver": "Foie",
    "donor.heart": "Cœur",
    "donor.lungs": "Poumons",
    "donor.pancreas": "Pancréas",
    "donor.corneas": "Cornées",
    "donor.register": "Enregistrer et Signer avec Freighter",
    "donor.registering": "Construction de la transaction...",
    "donor.success":
      "✓ Inscription réussie ! Votre consentement est maintenant enregistré sur la blockchain.",
    "donor.error": "L'inscription a échoué",

    // Hospital Portal
    "hospital.title": "Requête de Consentement d'Hôpital",
    "hospital.description":
      "Demander le statut de consentement de don d'organes d'un patient avant une intervention chirurgicale.",
    "hospital.patientId": "Hash d'Identification du Patient (SHA-256)",
    "hospital.patientId.placeholder":
      "Entrez le hash d'identification du patient (64 caractères hex)",
    "hospital.query": "Demander le Statut du Consentement",
    "hospital.querying": "Interrogation en cours...",
    "hospital.consentActive": "✓ Consentement Actif",
    "hospital.noConsent": "Aucun Consentement Actif Trouvé",

    // General
    "button.connect": "Connecter Portefeuille Freighter",
    "button.register": "Enregistrer",
    "button.query": "Demander",
    "button.clear": "Effacer",
    "status.connecting": "Connexion...",
    "status.loading": "Chargement...",
    privacy: "Confidentialité et Sécurité",
    security: "Sécurité",
  },
};

/**
 * Get message for locale and key
 * Falls back to English if translation not found
 */
export function t(locale: Locale, key: string, defaultValue?: string): string {
  return (
    messages[locale]?.[key] || messages["en"]?.[key] || defaultValue || key
  );
}
