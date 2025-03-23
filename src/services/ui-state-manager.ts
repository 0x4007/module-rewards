/**
 * UI State Manager - Manages UI elements state and loading states
 */

class UIStateManager {
  private containers: Record<string, HTMLElement | null> = {};
  private loadingContainers: Record<string, HTMLElement | null> = {};
  private loadingElements: Record<string, HTMLElement | null> = {};
  private noContentElements: Record<string, HTMLElement | null> = {};

  /**
   * Register a container for a section
   * @param section The section name (pr or issue)
   * @param element The container element
   */
  public registerContainer(section: string, element: HTMLElement | null): void {
    if (!element) return;

    this.containers[section] = element;

    // Create loading container if it doesn't exist
    if (!this.loadingContainers[section]) {
      const loadingContainer = document.createElement('div');
      loadingContainer.classList.add('loading-container');
      loadingContainer.style.display = 'none';
      element.appendChild(loadingContainer);
      this.loadingContainers[section] = loadingContainer;
    }

    // Create loading spinner if it doesn't exist
    if (!this.loadingElements[section]) {
      const loadingElement = document.createElement('div');
      loadingElement.classList.add('loading-spinner');
      loadingElement.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-text">Loading comments...</div>
      `;
      this.loadingContainers[section]?.appendChild(loadingElement);
      this.loadingElements[section] = loadingElement;
    }

    // Create no content element if it doesn't exist
    if (!this.noContentElements[section]) {
      const noContentElement = document.createElement('div');
      noContentElement.classList.add('no-content');
      noContentElement.textContent = 'No comments yet';
      noContentElement.style.display = 'none';
      element.appendChild(noContentElement);
      this.noContentElements[section] = noContentElement;
    }
  }

  /**
   * Start loading state for a section
   * @param section The section name (pr or issue)
   */
  public startLoading(section: string): void {
    // Hide the no content element
    if (this.noContentElements[section]) {
      this.noContentElements[section]!.style.display = 'none';
    }

    // Show the loading container
    if (this.loadingContainers[section]) {
      this.loadingContainers[section]!.style.display = 'flex';
    }
  }

  /**
   * Stop loading state for a section
   * @param section The section name (pr or issue)
   */
  public stopLoading(section: string): void {
    // Hide the loading container
    if (this.loadingContainers[section]) {
      this.loadingContainers[section]!.style.display = 'none';
    }
  }

  /**
   * Set content loaded state for a section
   * @param section The section name (pr or issue)
   * @param hasContent Whether there is content to display
   */
  public setContentLoaded(section: string, hasContent: boolean): void {
    this.stopLoading(section);

    // Show or hide the no content element
    if (this.noContentElements[section]) {
      this.noContentElements[section]!.style.display = hasContent ? 'none' : 'block';
    }
  }

  /**
   * Set error state for a section
   * @param section The section name (pr or issue)
   * @param errorMessage The error message to display
   */
  public setError(section: string, errorMessage: string): void {
    this.stopLoading(section);

    // Create or update the error element
    if (this.containers[section]) {
      const existingError = this.containers[section]!.querySelector('.error-message');
      if (existingError) {
        existingError.textContent = errorMessage;
        (existingError as HTMLElement).style.display = 'block';
      } else {
        const errorElement = document.createElement('div');
        errorElement.classList.add('error-message');
        errorElement.textContent = errorMessage;
        this.containers[section]!.appendChild(errorElement);
      }
    }
  }

  /**
   * Clear a section
   * @param section The section name (pr or issue)
   */
  public clearSection(section: string): void {
    if (this.containers[section]) {
      // Preserve the loading and no content elements
      const loadingContainer = this.loadingContainers[section];
      const noContentElement = this.noContentElements[section];

      // Clear the container
      while (this.containers[section]!.firstChild) {
        this.containers[section]!.removeChild(this.containers[section]!.firstChild);
      }

      // Re-add the loading and no content elements
      if (loadingContainer) {
        this.containers[section]!.appendChild(loadingContainer);
      }
      if (noContentElement) {
        this.containers[section]!.appendChild(noContentElement);
      }

      // Recreate loading container if needed
      if (!loadingContainer) {
        this.registerContainer(section, this.containers[section]);
      }
    }
  }

  /**
   * Show a notification when content is updated
   */
  public notifyContentUpdated(): void {
    const notification = document.createElement("div");
    notification.className = "update-notification";
    notification.textContent = "Content updated with latest data";
    document.body.appendChild(notification);

    // Fade in
    setTimeout(() => (notification.style.opacity = "1"), 0);

    // Fade out and remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

export const uiStateManager = new UIStateManager();
