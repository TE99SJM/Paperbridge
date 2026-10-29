window.practiceActions = { submit: 0, next: 0, add: 0, decoy: 0, changes: [] };
const form = document.getElementById("workday-practice");
const log = () => { document.getElementById("events").textContent = JSON.stringify(window.practiceActions, null, 2); };
form.addEventListener("submit", event => { event.preventDefault(); window.practiceActions.submit++; log(); });
document.getElementById("next-step").addEventListener("click", () => { window.practiceActions.next++; log(); });
document.getElementById("add-entry").addEventListener("click", () => { window.practiceActions.add++; log(); });
document.getElementById("decoy-listbox").addEventListener("click", () => { window.practiceActions.decoy++; log(); });
form.addEventListener("change", event => { window.practiceActions.changes.push(event.target.id || event.target.name); log(); });
document.getElementById("job1-current").addEventListener("change", event => {
  document.getElementById("job1-end").hidden = event.target.checked;
});
for (const button of document.querySelectorAll("button[data-choices]")) {
  let menu = null;
  const close = () => { menu?.remove(); menu = null; button.setAttribute("aria-expanded", "false"); };
  button.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
  button.addEventListener("click", () => {
    if (menu) { close(); return; }
    menu = document.createElement("div");
    menu.id = button.getAttribute("aria-controls") || button.id + "-portal";
    menu.className = "dropdown-portal";
    menu.setAttribute("role", "listbox");
    for (const label of button.dataset.choices.split("|")) {
      const option = document.createElement("div");
      option.setAttribute("role", "option");
      let target = option;
      if (button.dataset.innerOption) {
        target = document.createElement("span");
        target.setAttribute("data-automation-id", "promptOption");
        option.append(target);
      }
      target.textContent = label;
      target.addEventListener("click", () => {
        button.textContent = label;
        close();
        button.dispatchEvent(new Event("change", { bubbles: true }));
      });
      menu.append(option);
    }
    document.body.append(menu);
    button.setAttribute("aria-expanded", "true");
  });
}
