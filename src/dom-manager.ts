/**
 * DOM Manager - Central point for all DOM element references
 * Eliminates redundant element selection across files
 */

// DOM elements cache
interface DOMElements {
  urlInput: HTMLInputElement;
  analyzeBtn: HTMLButtonElement;
  analyzeForm: HTMLFormElement;
  loadingIndicator: HTMLElement;
  errorMessage: HTMLElement;
  detailsElement: HTMLElement;
  title: HTMLElement;
  meta: HTMLElement;
  scoreSummary: HTMLElement;
  scoreSummaryContent: HTMLElement;
  issueConversation: HTMLElement;
  prConversation: HTMLElement;
  contentColumns: HTMLElement;
}

class DOMManager {
  private elements: Partial<DOMElements> = {};
  private initialized = false;

  /**
   * Initialize all DOM element references
   * @returns {boolean} Whether initialization was successful
   */
  public initialize(): boolean {
    try {
      this.elements = {
        urlInput: document.getElementById("url-input") as HTMLInputElement,
        analyzeBtn: document.getElementById("analyze-btn") as HTMLButtonElement,
        analyzeForm: document.getElementById("analyze-form") as HTMLFormElement,
        loadingIndicator: document.getElementById("loading-indicator") as HTMLElement,
        errorMessage: document.getElementById("error-message") as HTMLElement,
        detailsElement: document.getElementById("details") as HTMLElement,
        title: document.querySelector("#details .title") as HTMLElement,
        meta: document.querySelector("#details .meta") as HTMLElement,
        scoreSummary: document.getElementById("score-summary") as HTMLElement,
        scoreSummaryContent: document.getElementById("score-summary-content") as HTMLElement,
        issueConversation: document.getElementById("issue-conversation") as HTMLElement,
        prConversation: document.getElementById("pr-conversation") as HTMLElement,
        contentColumns: document.getElementById("content-columns") as HTMLElement,
      };

      // Verify all elements were found
      const missingElements = Object.entries(this.elements)
        .filter(([_, element]) => !element)
        .map(([key]) => key);

      if (missingElements.length > 0) {
        console.error(`Missing DOM elements: ${missingElements.join(", ")}`);
        return false;
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error("DOM Manager initialization failed:", error);
      return false;
    }
  }

  /**
   * Get a DOM element by key
   * @param {K} key Element key
   * @returns {DOMElements[K]} The requested element
   */
  public get<K extends keyof DOMElements>(key: K): DOMElements[K] {
    if (!this.initialized) {
      throw new Error("DOM Manager not initialized. Call initialize() first.");
    }

    const element = this.elements[key] as DOMElements[K];
    if (!element) {
      throw new Error(`Element "${key}" not found or not initialized.`);
    }

    return element;
  }

  /**
   * Safely access a DOM element, with error handling
   * @param {K} key Element key
   * @param {(element: DOMElements[K]) => void} callback Function to execute with element
   */
  public withElement<K extends keyof DOMElements>(key: K, callback: (element: DOMElements[K]) => void): void {
    try {
      const element = this.get(key);
      callback(element);
    } catch (error) {
      console.error(`Error accessing element "${key}":`, error);
    }
  }

  /**
   * Show an element
   * @param {K} key Element key
   */
  public show<K extends keyof DOMElements>(key: K): void {
    this.withElement(key, (element) => {
      if (element instanceof HTMLElement) {
        element.classList.remove("hidden");
      }
    });
  }

  /**
   * Hide an element
   * @param {K} key Element key
   */
  public hide<K extends keyof DOMElements>(key: K): void {
    this.withElement(key, (element) => {
      if (element instanceof HTMLElement) {
        element.classList.add("hidden");
      }
    });
  }

  /**
   * Set text content of an element
   * @param {K} key Element key
   * @param {string} text Text to set
   */
  public setText<K extends keyof DOMElements>(key: K, text: string): void {
    this.withElement(key, (element) => {
      if (element instanceof HTMLElement) {
        element.textContent = text;
      }
    });
  }

  /**
   * Clear the content of an element
   * @param {K} key Element key
   */
  public clearContent<K extends keyof DOMElements>(key: K): void {
    this.withElement(key, (element) => {
      if (element instanceof HTMLElement) {
        element.innerHTML = "";
      }
    });
  }
}

// Export singleton instance
export const domManager = new DOMManager();
