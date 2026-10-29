const log = document.getElementById("events");
window.practiceSubmitCount = 0;
window.practiceChanges = [];
document.getElementById("practice-form").addEventListener("submit", event => {
  event.preventDefault();
  window.practiceSubmitCount++;
  log.textContent += "\nPractice submit clicked manually. No network request was made.";
});
document.getElementById("practice-form").addEventListener("change", event => {
  window.practiceChanges.push(event.target.name || event.target.id);
  log.textContent = window.practiceChanges.map(name => `Changed: ${name}`).join("\n");
});
