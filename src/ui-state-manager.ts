// UI State Manager to handle consistent loading states and content rendering
// This prevents premature "no content" messages and provides a unified approach

type ContentSection = "pr" | "issue";

interface ContentState {
  isLoading: boolean;
  hasContent: boolean;
  error?: string;
}

class UIStateManager {
  private states: Record<ContentSection, ContentState> = {
    pr: { isLoading: false, hasContent: false },
    issue: { isLoading: false, hasContent: false },
  };

  private loadingElements: Partial<Record<ContentSection, HTMLElement>> = {};
  private containers: Partial<Record<ContentSection, HTMLElement>> = {};

  // Set up containers and loading elements
  public registerContainer(section: ContentSection, container: HTMLElement): void {
    this.containers[section] = container;

    // Clear existing content first
    container.innerHTML = "";

    // Create a loading element if it doesn't exist
    if (!this.loadingElements[section]) {
      const loadingEl = document.createElement("div");
      loadingEl.className = "section-loading-indicator";
      loadingEl.innerHTML = '<div class="spinner"></div>';
      loadingEl.classList.add("display-none");
      container.appendChild(loadingEl);
      this.loadingElements[section] = loadingEl;
    }
  }

  // Start loading state for a section
  public startLoading(section: ContentSection): void {
    this.states[section].isLoading = true;
    this.states[section].hasContent = false;
    this.states[section].error = undefined;
    this.updateUI(section);
  }

  // Set content loaded for a section
  public setContentLoaded(section: ContentSection, hasContent: boolean): void {
    this.states[section].isLoading = false;
    this.states[section].hasContent = hasContent;
    this.updateUI(section);
  }

  // Set error for a section
  public setError(section: ContentSection, error: string): void {
    this.states[section].isLoading = false;
    this.states[section].error = error;
    this.updateUI(section);
  }

  // Clear a section
  public clearSection(section: ContentSection): void {
    if (this.containers[section]) {
      // Preserve only the loading indicator
      const loadingEl = this.loadingElements[section];
      this.containers[section]!.innerHTML = "";

      if (loadingEl) {
        this.containers[section]!.appendChild(loadingEl);
      }
    }

    this.states[section] = {
      isLoading: false,
      hasContent: false,
      error: undefined,
    };
  }

  // Update the UI to reflect current state
  private updateUI(section: ContentSection): void {
    const loadingEl = this.loadingElements[section];
    const container = this.containers[section];

    if (!loadingEl || !container) {
      return;
    }

    const state = this.states[section];

    // Show loading indicator only when loading and no content yet
    loadingEl.classList.toggle("display-none", !state.isLoading);
    loadingEl.classList.toggle("display-block", state.isLoading);

    // If there's an error, show it
    if (state.error && !state.hasContent) {
      this.showError(section, state.error);
    }
  }

  // Show error message in a section
  private showError(section: ContentSection, message: string): void {
    const container = this.containers[section];
    if (!container) return;

    const errorEl = document.createElement("div");
    errorEl.className = "section-error-message";
    errorEl.innerHTML = `<p>${message}</p>`;

    // Add error after loading indicator
    container.appendChild(errorEl);
  }

  // Check if section has content
  public hasContent(section: ContentSection): boolean {
    return this.states[section].hasContent;
  }

  // Check if section is loading
  public isLoading(section: ContentSection): boolean {
    return this.states[section].isLoading;
  }
}

// Export singleton instance
export const uiStateManager = new UIStateManager();
