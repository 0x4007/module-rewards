import { issueConversation, prConversation, title, meta } from "./main";

// Clear previous results
export function clearResults(): void {
  if (issueConversation) issueConversation.innerHTML = "";
  if (prConversation) prConversation.innerHTML = "";
  if (title) title.textContent = "Loading...";
  if (meta) meta.textContent = "";
  // Remove existing summary if present
  const existingSummary = document.querySelector(".contributor-summary");
  if (existingSummary) {
    existingSummary.remove();
  }
}
