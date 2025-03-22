import { CommentDisplayOptions, ErrorDisplayOptions } from "./types";

/**
 * Append a comment to the DOM with specified options
 */
export function appendCommentToDOM(
  comment: { id: string | number; body: string },
  options: CommentDisplayOptions
): void {
  const { containerSelector, idPrefix = "comment", className = "comment" } = options;
  const container = document.querySelector(containerSelector);

  if (!container) {
    console.error(`Container not found: ${containerSelector}`);
    return;
  }

  const commentElement = document.createElement("div");
  commentElement.id = `${idPrefix}-${comment.id}`;
  commentElement.className = className;
  commentElement.innerHTML = comment.body;

  container.appendChild(commentElement);
}

/**
 * Clear any existing results from the DOM
 */
export function clearResults(containerSelector: string): void {
  const container = document.querySelector(containerSelector);
  if (container) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }
}

/**
 * Show an error message to the user
 */
export function showError(
  message: string,
  options: ErrorDisplayOptions = {}
): void {
  const { duration = 5000, className = "error-message" } = options;

  const errorDiv = document.createElement("div");
  errorDiv.className = className;
  errorDiv.textContent = message;

  document.body.appendChild(errorDiv);

  // Position the error message
  Object.assign(errorDiv.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    padding: "15px",
    backgroundColor: "#ff4444",
    color: "white",
    borderRadius: "4px",
    boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
    zIndex: "1000",
    opacity: "1",
    transition: "opacity 0.3s ease-in-out"
  });

  // Remove the error message after the specified duration
  setTimeout(() => {
    errorDiv.style.opacity = "0";
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 300);
  }, duration);
}
