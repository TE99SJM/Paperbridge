let submissions = 0;
document.getElementById("safety-form").addEventListener("submit", event => {
  event.preventDefault(); document.getElementById("actions").textContent = String(++submissions);
});
const root = document.getElementById("shadow-host").attachShadow({ mode: "open" });
const label = document.createElement("label");
label.textContent = "Shadow note";
const input = document.createElement("input");
input.id = "shadow-note"; label.append(input); root.append(label);
const button = document.getElementById("category");
let list = null;
function close() { list?.remove(); list = null; button.setAttribute("aria-expanded", "false"); }
button.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
button.addEventListener("click", () => {
  if (list) { close(); return; }
  list = document.createElement("div"); list.id = "category-list"; list.setAttribute("role", "listbox");
  for (const text of ["Medical history", "Other"]) {
    const row = document.createElement("div"); row.setAttribute("role", "option"); row.textContent = text;
    row.addEventListener("click", () => { button.textContent = text; close(); });
    list.append(row);
  }
  document.body.append(list); button.setAttribute("aria-expanded", "true");
});
