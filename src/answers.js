export const QUESTION_TEMPLATES = [
  { name: "Age eligibility", question: "Are you 18 years of age or older?" },
  { name: "U.S. work authorization", question: "Are you legally authorized to work in the United States?" },
  { name: "U.S. sponsorship", question: "Do you now have or will you in the future require sponsorship for authorization to work in the United States?" },
  { name: "Former employer", question: "Have you previously worked for [replace with the employer's name]?" },
  { name: "Employer contact", question: "May we contact this employer?" }
];

export function normalizeQuestion(value) {
  return String(value || "").normalize("NFKC").toLowerCase()
    .replace(/[’‘]/g, "'").replace(/^\s*\d+[.)]\s*/, "")
    .replace(/[*:?!.,]+/g, " ").replace(/\s+/g, " ").trim();
}

export function userAnswerKind(label) {
  const q = normalizeQuestion(label);
  if (/\b(?:are you|at least|over)\b/.test(q) && /\b(?:16|18|21)\b/.test(q) && /\b(?:age|older|years)\b/.test(q)) return "age-eligibility";
  if (/\b(?:sponsorship|sponsor)\b/.test(q) && /\b(?:work|employment|immigration|authorization|authorisation)\b/.test(q)) return "sponsorship";
  if (/\b(?:authorized|authorised|eligible|eligibility|permission)\b/.test(q) && /\b(?:work|employment)\b/.test(q)) return "work-authorization";
  if (/\b(?:have you|were you|are you|did you)\b/.test(q) && /\b(?:previously|ever|prior|former)\b/.test(q) && /\b(?:employed|worked|employee|employment)\b/.test(q)) return "previous-employer";
  if (/\b(?:may|can|permission|allow|permit|okay|ok)\b/.test(q) && /\bcontact\b/.test(q) && /\b(?:employer|supervisor|manager|reference)\b/.test(q)) return "employer-contact";
  if (/^contact\b/.test(q) && /\b(?:this|your|current|previous|former)\s+(?:employer|supervisor|manager|reference)\b/.test(q)) return "employer-contact";
  return "";
}

export function matchingSavedAnswer(field, savedAnswers, origin) {
  const key = normalizeQuestion(field.label);
  const candidates = (savedAnswers || []).filter(a =>
    typeof a.answer === "string" && a.answer.trim() &&
    normalizeQuestion(a.question) === key &&
    (!a.origin || a.origin === origin) &&
    (!a.section || normalizeQuestion(a.section) === normalizeQuestion(field.section))
  ).map(a => ({ ...a, specificity: (a.origin ? 2 : 0) + (a.section ? 1 : 0) }));
  if (!candidates.length) return null;
  const max = Math.max(...candidates.map(a => a.specificity));
  const best = candidates.filter(a => a.specificity === max);
  if (new Set(best.map(a => a.answer.trim())).size > 1) return { conflict: true };
  return best[0];
}
