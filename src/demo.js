import { newVault } from "./core.js";
import { userAnswerKind } from "./answers.js";
export function demoVault() {
  const vault = newVault();
  vault.settings.mode = "manual";
  vault.documents.push({
    id: "sample-resume", name: "Jordan_Avery_Resume.txt", include: true, hash: "fictional",
    importedAt: "2026-10-29T12:00:00.000Z", warnings: [],
    text: `FICTIONAL SAMPLE. Not a real person's resume.

Jordan Avery
jordan.avery@example.com
608-555-0148
Madison, Wisconsin

Operations Coordinator
Northline Workshop, January 2022 to present
Coordinated purchase orders, maintained inventory records, and scheduled a team of eight.
Created clear onboarding checklists and maintained equipment safety records.

Education
Associate of Applied Science in Business, Lakeside Technical College, 2021.

Skills
Inventory tracking, Excel, purchasing, team scheduling, written communication.

Personal preference
Seeking an Operations Coordinator position with a collaborative, hands-on team.`
  });
  return vault;
}
export function demoScan() {
  const scanId = "demo-" + crypto.randomUUID();
  const specs = [
    ["Full name", "text", "text", ""], ["Email address", "email", "text", ""],
    ["Phone number", "tel", "text", ""], ["City and state", "text", "text", ""],
    ["Position of interest", "select", "select", ""],
    ["Describe your relevant experience", "textarea", "text", ""],
    ["Desired annual salary", "number", "text", ""],
    ["Employer", "text", "text", "", "Work experience 1"],
    ["Job title", "text", "text", "", "Work experience 1"],
    ["School or university", "text", "text", "", "Education 1"],
    ["Degree", "button", "custom-select", "", "Education 1"],
    ["Are you 18 years of age or older?", "button", "custom-select", "", "Application questions"],
    ["Are you legally authorized to work in the United States?", "button", "custom-select", "", "Application questions"],
    ["Do you now have or will you in the future require sponsorship for authorization to work in the United States?", "button", "custom-select", "", "Application questions"],
    ["May we contact this employer?", "select", "select", "", "Work experience 1"],
    ["Have you previously worked for Northline Workshop?", "select", "select", "", "Application questions"],
    ["I certify this application is accurate", "checkbox", "checkbox", "Sensitive declaration. Complete this manually."]
  ];
  return {
    scanId, title: "Operations Coordinator | Northline Careers",
    origin: "https://careers.example.com", path: "/apply", scannedAt: new Date().toISOString(),
    inaccessibleFrames: 0, truncated: false,
    fields: specs.map(([label, type, kind, blockedReason, section], i) => ({
      id: `${scanId}:${i + 1}`, label, type, kind, section: section || (i < 4 ? "Contact details" : "Your application"),
      required: i !== 6, maxLength: type === "textarea" ? 2000 : 0, filled: false, blockedReason,
      userAnswerOnly: !!userAnswerKind(label), userAnswerKind: userAnswerKind(label),
      options: label === "Position of interest" ? [{ value: "operations", label: "Operations Coordinator" }, { value: "sales", label: "Sales Associate" }] :
        label === "Degree" ? [{ value: "Associate of Applied Science", label: "Associate of Applied Science" }, { value: "Bachelor of Science", label: "Bachelor of Science" }] :
        ["select", "custom-select"].includes(kind) ? [{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }] : []
    }))
  };
}
export function demoAnswer(scan) {
  const values = {
    "Full name": ["Jordan Avery", "Jordan Avery"],
    "Email address": ["jordan.avery@example.com", "jordan.avery@example.com"],
    "Phone number": ["608-555-0148", "608-555-0148"],
    "City and state": ["Madison, Wisconsin", "Madison, Wisconsin"],
    "Position of interest": ["operations", "Seeking an Operations Coordinator position"],
    "Describe your relevant experience": ["I coordinate purchase orders, maintain inventory records, and schedule a team of eight. I also create onboarding checklists and maintain equipment safety records.", "Coordinated purchase orders, maintained inventory records, and scheduled a team of eight.\nCreated clear onboarding checklists and maintained equipment safety records."],
    "Employer": ["Northline Workshop", "Northline Workshop"],
    "Job title": ["Operations Coordinator", "Operations Coordinator"],
    "School or university": ["Lakeside Technical College", "Lakeside Technical College"],
    "Degree": ["Associate of Applied Science", "Associate of Applied Science in Business"]
  };
  return { scanId: scan.scanId, answers: scan.fields.filter(f => !f.blockedReason && !f.userAnswerOnly).map(f => ({
    fieldId: f.id, value: values[f.label]?.[0] ?? null,
    source_id: values[f.label] ? "sample-resume" : "", quote: values[f.label]?.[1] || "",
    reason: values[f.label] ? "Drafted from the fictional resume. Review before filling." : "The resume does not state a salary expectation. Enter your own answer if appropriate."
  })) };
}
