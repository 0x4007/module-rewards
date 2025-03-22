import { CommentDisplayOptions, ErrorDisplayOptions } from "./types";

/**
 * Append a comment to the DOM with specified options
 */
export function appendCommentToDOM(
  comment: {
    id: string | number;
    body: string;
    user?: {
      login: string;
      html_url?: string;
      avatar_url?: string
    };
    created_at?: string;
  },
  options: CommentDisplayOptions
): void {
  const { containerSelector, idPrefix = "comment", className = "comment" } = options;
  const container = document.querySelector(containerSelector);

  if (!container) {
    console.error(`Container not found: ${containerSelector}`);
    return;
  }

  // Create the comment container
  const commentElement = document.createElement("div");
  commentElement.id = `${idPrefix}-${comment.id}`;
  commentElement.className = className;

  // Create header with avatar and user info if available
  if (comment.user) {
    const headerElement = document.createElement("div");
    headerElement.className = "comment-header";

    // Add avatar if available
    if (comment.user.avatar_url) {
      const avatarElement = document.createElement("img");
      avatarElement.className = "avatar";
      avatarElement.src = comment.user.avatar_url;
      avatarElement.alt = comment.user.login;
      headerElement.appendChild(avatarElement);
    }

    // Add user info and timestamp
    const userInfoElement = document.createElement("div");
    userInfoElement.className = "user-info";

    const usernameElement = document.createElement("a");
    usernameElement.href = comment.user.html_url || "#";
    usernameElement.className = "username";
    usernameElement.textContent = comment.user.login;
    userInfoElement.appendChild(usernameElement);

    if (comment.created_at) {
      const timestampElement = document.createElement("span");
      timestampElement.className = "timestamp";
      const dateObject = new Date(comment.created_at);
      timestampElement.textContent = dateObject.toLocaleString();
      userInfoElement.appendChild(timestampElement);
    }

    headerElement.appendChild(userInfoElement);
    commentElement.appendChild(headerElement);
  }

  // Create comment body with markdown rendering
  const bodyElement = document.createElement("div");
  bodyElement.className = "comment-body";

  // Use marked to render markdown if available
  try {
    if (window.marked) {
      bodyElement.innerHTML = window.marked.parse(comment.body);
    } else {
      bodyElement.innerHTML = comment.body;
    }
  } catch (e) {
    console.error("Error rendering markdown:", e);
    bodyElement.innerHTML = comment.body;
  }

  commentElement.appendChild(bodyElement);
  container.appendChild(commentElement);
}

/**
 * Clear any existing results from the DOM
 */
export function clearResults(containerSelector: string): void {
  const container = document.querySelector(containerSelector);
  if (container) {
    // Keep the structure (title, meta) but clear the content
    const title = container.querySelector(".title");
    const meta = container.querySelector(".meta");

    // Clear the container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Add back the title and meta if they existed
    if (title) {
      title.textContent = "";
      container.appendChild(title);
    }

    if (meta) {
      meta.textContent = "";
      container.appendChild(meta);
    }
  }

  // Also clear conversation containers
  ["#issue-conversation", "#pr-conversation"].forEach(selector => {
    const convoContainer = document.querySelector(selector);
    if (convoContainer) {
      convoContainer.innerHTML = "";
    }
  });
}

/**
 * Show an error message to the user
 */
export function showError(message: string, options: ErrorDisplayOptions = {}): void {
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
    transition: "opacity 0.3s ease-in-out",
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
