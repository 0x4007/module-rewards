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
  private activeNotifications: UIComponent[] = [];
  private readonly MAX_NOTIFICATIONS = 3;
  private readonly NOTIFICATION_DURATION = 3000;
  private readonly FADE_DURATION = 300;

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

  private notificationContainer: HTMLElement | null = null;

  private ensureNotificationContainer(): void {
    if (!this.notificationContainer) {
      const container = document.createElement("div");
      container.className = "notification-container";
      document.body.appendChild(container);
      this.notificationContainer = container;
    }
  }

  private createNotification(message: string, type: "info" | "success" = "info"): UIComponent {
    this.ensureNotificationContainer();

    const notification = this.createComponent({
      type: "notification",
      className: `update-notification ${type}`,
      text: message
    });

    notification.element.classList.add("new");

    // Add to active notifications and handle cleanup
    this.activeNotifications.push(notification);
    while (this.activeNotifications.length > this.MAX_NOTIFICATIONS) {
      const oldNotification = this.activeNotifications.shift();
      oldNotification?.element.remove();
    }

    return notification;
  }

  /**
   * Show a notification with optional type and duration
   */
  public notify(message: string, options?: { type?: "info" | "success"; duration?: number }): void {
    const notification = this.createNotification(message, options?.type);
    const duration = options?.duration || this.NOTIFICATION_DURATION;

    // Add to DOM and show
    this.notificationContainer?.appendChild(notification.element);
    requestAnimationFrame(() => notification.show());

    // Schedule removal
    setTimeout(() => {
      notification.hide();
      setTimeout(() => {
        notification.remove();
        const index = this.activeNotifications.indexOf(notification);
        if (index > -1) {
          this.activeNotifications.splice(index, 1);
        }
      }, this.FADE_DURATION);
    }, duration);
  }

  /**
   * Show a notification when content is updated
   */
  public notifyContentUpdated(): void {
    this.notify("Content updated with latest data", { type: "success" });
  }
}

export const uiStateManager = new UIStateManager();
