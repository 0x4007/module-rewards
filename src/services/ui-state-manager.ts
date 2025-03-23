/**
 * UI State Manager - Manages UI elements state and loading states
 */

interface UIComponent {
  element: HTMLElement;
  show(): void;
  hide(): void;
  remove(): void;
}

class UIStateManager {
  private containers: Record<string, HTMLElement | null> = {};
  private loadingContainers: Record<string, HTMLElement | null> = {};
  private loadingElements: Record<string, HTMLElement | null> = {};
  private noContentElements: Record<string, HTMLElement | null> = {};
  private activeNotifications: HTMLElement[] = [];

  /**
   * Register a container for a section
   * @param section The section name (pr or issue)
   * @param element The container element
   */
  private createLoadingSpinner(text: string = "Loading..."): UIComponent {
    const spinner = this.createComponent({
      type: "loading",
      className: "loading-spinner"
    });

    spinner.element.innerHTML = `
      <div class="spinner"></div>
      <div class="loading-text">${text}</div>
    `;

    return spinner;
  }

  private createNoContent(message: string = "No content"): UIComponent {
    return this.createComponent({
      type: "no-content",
      className: "no-content",
      text: message
    });
  }

  private createError(message: string): UIComponent {
    return this.createComponent({
      type: "error",
      className: "error-message",
      text: message
    });
  }

  public registerContainer(section: string, element: HTMLElement | null): void {
    if (!element) return;

    this.containers[section] = element;

    // Create loading container if it doesn't exist
    if (!this.loadingContainers[section]) {
      const loadingContainer = this.createComponent({
        type: "loading-container",
        className: "loading-container"
      });
      loadingContainer.element.style.display = "none";
      element.appendChild(loadingContainer.element);
      this.loadingContainers[section] = loadingContainer.element;
    }

    // Create loading spinner if it doesn't exist
    if (!this.loadingElements[section]) {
      const loadingElement = this.createLoadingSpinner("Loading comments...");
      this.loadingContainers[section]?.appendChild(loadingElement.element);
      this.loadingElements[section] = loadingElement.element;
    }

    // Create no content element if it doesn't exist
    if (!this.noContentElements[section]) {
      const noContentElement = this.createNoContent("No comments yet");
      noContentElement.element.style.display = "none";
      element.appendChild(noContentElement.element);
      this.noContentElements[section] = noContentElement.element;
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

  private globalErrorContainer: HTMLElement | null = null;

  /**
   * Register the global error container
   */
  public registerErrorContainer(element: HTMLElement): void {
    this.globalErrorContainer = element;
  }

  /**
   * Set error state for a section or show global error
   * @param errorMessage The error message to display
   * @param section Optional section name (pr or issue)
   */
  public setError(errorMessage: string, section?: string): void {
    if (section) {
      this.stopLoading(section);

      if (this.containers[section]) {
        const existingError = this.containers[section]!.querySelector(".error-message");
        if (existingError) {
          existingError.textContent = errorMessage;
          (existingError as HTMLElement).style.display = "block";
        } else {
          const errorElement = this.createError(errorMessage);
          this.containers[section]!.appendChild(errorElement.element);
        }
      }
    } else if (this.globalErrorContainer) {
      // Handle global error
      const errorElement = this.createError(errorMessage);
      errorElement.element.classList.add("error-message-overlay");

      // Clear existing errors
      while (this.globalErrorContainer.firstChild) {
        this.globalErrorContainer.firstChild.remove();
      }

      this.globalErrorContainer.appendChild(errorElement.element);
      errorElement.show();

      // Auto-hide after 5 seconds
      setTimeout(() => {
        errorElement.hide();
        setTimeout(() => errorElement.remove(), 300);
      }, 5000);
    }
  }

  /**
   * Clear error state
   * @param section Optional section name (pr or issue)
   */
  public clearError(section?: string): void {
    if (section && this.containers[section]) {
      const error = this.containers[section]!.querySelector(".error-message");
      if (error) {
        error.remove();
      }
    } else if (this.globalErrorContainer) {
      while (this.globalErrorContainer.firstChild) {
        this.globalErrorContainer.firstChild.remove();
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
  /**
   * UI Component Factory Methods
   */
  private createComponent(options: {
    type: string;
    className: string;
    text?: string;
  }): UIComponent {
    const element = document.createElement("div");
    element.className = options.className;
    if (options.text) {
      element.textContent = options.text;
    }

    return {
      element,
      show: () => {
        element.style.opacity = "1";
      },
      hide: () => {
        element.style.opacity = "0";
      },
      remove: () => {
        element.remove();
      }
    };
  }

  private createNotification(message: string): UIComponent {
    const notification = this.createComponent({
      type: "notification",
      className: "update-notification",
      text: message
    });

    document.body.appendChild(notification.element);
    this.activeNotifications.push(notification.element);

    // Clean up old notifications if there are too many
    while (this.activeNotifications.length > 3) {
      const oldNotification = this.activeNotifications.shift();
      oldNotification?.remove();
    }

    return notification;
  }

  /**
   * Show a notification when content is updated
   */
  public notifyContentUpdated(): void {
    const notification = this.createNotification("Content updated with latest data");

    // Fade in
    setTimeout(() => notification.show(), 0);

    // Fade out and remove after 3 seconds
    setTimeout(() => {
      notification.hide();
      setTimeout(() => {
        notification.remove();
        const index = this.activeNotifications.indexOf(notification.element);
        if (index > -1) {
          this.activeNotifications.splice(index, 1);
        }
      }, 300);
    }, 3000);
  }
}

export const uiStateManager = new UIStateManager();
