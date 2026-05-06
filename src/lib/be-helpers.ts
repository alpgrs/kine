// Belgian-specific input helpers and validators

export type ProfessionKey =
  | "medecin"
  | "dentiste"
  | "kine"
  | "logo"
  | "sage_femme"
  | "ergo"
  | "podologue"
  | "dietetic"
  | "psy_clinicien"
  | "osteo"
  | "chiro";

export interface ProfessionDef {
  key: ProfessionKey;
  labels: { fr: string; nl: string; en: string };
  inamiRequired: boolean;
  vatExempt: boolean; // default
}

export const PROFESSIONS: ProfessionDef[] = [
  { key: "medecin", labels: { fr: "Médecin", nl: "Arts", en: "Doctor" }, inamiRequired: true, vatExempt: true },
  { key: "dentiste", labels: { fr: "Dentiste", nl: "Tandarts", en: "Dentist" }, inamiRequired: true, vatExempt: true },
  { key: "kine", labels: { fr: "Kinésithérapeute", nl: "Kinesist", en: "Physiotherapist" }, inamiRequired: true, vatExempt: true },
  { key: "logo", labels: { fr: "Logopède", nl: "Logopedist", en: "Speech therapist" }, inamiRequired: true, vatExempt: true },
  { key: "sage_femme", labels: { fr: "Sage-femme", nl: "Vroedvrouw", en: "Midwife" }, inamiRequired: true, vatExempt: true },
  { key: "ergo", labels: { fr: "Ergothérapeute", nl: "Ergotherapeut", en: "Occupational therapist" }, inamiRequired: true, vatExempt: true },
  { key: "podologue", labels: { fr: "Podologue", nl: "Podoloog", en: "Podiatrist" }, inamiRequired: false, vatExempt: true },
  { key: "dietetic", labels: { fr: "Diététicien", nl: "Diëtist", en: "Dietitian" }, inamiRequired: false, vatExempt: true },
  { key: "psy_clinicien", labels: { fr: "Psychologue clinicien", nl: "Klinisch psycholoog", en: "Clinical psychologist" }, inamiRequired: false, vatExempt: true },
  { key: "osteo", labels: { fr: "Ostéopathe", nl: "Osteopaat", en: "Osteopath" }, inamiRequired: false, vatExempt: true },
  { key: "chiro", labels: { fr: "Chiropracteur", nl: "Chiropractor", en: "Chiropractor" }, inamiRequired: false, vatExempt: true },
];

export const getProfession = (key: string): ProfessionDef | undefined =>
  PROFESSIONS.find((p) => p.key === key);

/** Convert "50", "50.50", "50,50" → cents (integer). Returns 0 if invalid. */
export function parsePriceToCents(input: string | number): number {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : 0;
  }
  const cleaned = String(input).trim().replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return 0;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * 100);
}

/** Strip spaces/dots/dashes/parens from phone */
export function sanitizePhone(input: string): string {
  return (input ?? "").replace(/[\s.\-()]/g, "");
}

/** Belgian mobile/landline: 04xxxxxxxx, +32xxxxxxxxx, 0032xxxxxxxxx */
export function isValidBePhone(input: string): boolean {
  const p = sanitizePhone(input);
  if (!p) return false;
  return /^(?:0[1-9]\d{7,8}|\+32[1-9]\d{7,8}|0032[1-9]\d{7,8})$/.test(p);
}

/** Sanitize INAMI: keep digits only */
export function sanitizeInami(input: string): string {
  return (input ?? "").replace(/[^0-9]/g, "");
}

/** Belgian INAMI: typically 11 digits (sometimes 8). Returns true if plausible. */
export function isValidInami(input: string): boolean {
  const s = sanitizeInami(input);
  return s.length === 8 || s.length === 11;
}

/** Sanitize VAT: uppercase, remove spaces/dots/dashes/slashes */
export function sanitizeVat(input: string): string {
  return (input ?? "").toUpperCase().replace(/[\s.\-/]/g, "");
}

/** Belgian VAT: BE0XXXXXXXXX (BE0 + 9 digits) */
export function isValidBeVat(input: string): boolean {
  const v = sanitizeVat(input);
  return /^BE0\d{9}$/.test(v);
}
