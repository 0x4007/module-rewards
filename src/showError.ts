import { loadingIndicator, errorMessage } from "./main";

// Display error
export function showError(message: string): void {
  loadingIndicator.classList.add("hidden");
  errorMessage.classList.remove("hidden");
  errorMessage.textContent = message;
}
