/**
 * Style Picker Component
 * Searchable dropdown for selecting citation styles
 */

import { POPULAR_STYLES, searchStyles, getCategories, type StyleInfo } from "./styles";
import { fetchAllStyles, searchAllStyles, type AllStylesResult } from "./cslRepository";

export class StylePicker {
  private container: HTMLElement;
  private input: HTMLInputElement;
  private dropdown: HTMLDivElement;
  private selectedStyle: string;
  private onChangeCallback: ((styleId: string) => void) | null = null;
  private isOpen: boolean = false;
  private allStylesMode: boolean = false;
  private allStyles: StyleInfo[] = [];
  private isLoadingAllStyles: boolean = false;
  private boundUpdatePosition: () => void;

  constructor(containerId: string, defaultStyle: string = "apa") {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element #${containerId} not found`);
    }
    
    this.container = container;
    this.selectedStyle = defaultStyle;
    this.input = this.createInput();
    this.dropdown = this.createDropdown();
    this.boundUpdatePosition = () => this.updatePosition();
    
    this.render();
    this.attachEventListeners();
  }

  private createInput(): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "style-picker-input";
    input.placeholder = "Search citation styles...";
    input.autocomplete = "off";
    return input;
  }

  private createDropdown(): HTMLDivElement {
    const dropdown = document.createElement("div");
    dropdown.className = "style-picker-dropdown hidden";
    return dropdown;
  }

  private render(): void {
    this.container.innerHTML = "";
    this.container.className = "style-picker-container";
    
    const wrapper = document.createElement("div");
    wrapper.className = "style-picker-wrapper";
    
    // Selected style display
    const selected = document.createElement("div");
    selected.className = "style-picker-selected";
    const styleName = this.getStyleName(this.selectedStyle);
    selected.innerHTML = `
      <span class="style-name">${styleName}</span>
      <span class="style-arrow">▼</span>
    `;
    selected.addEventListener("click", () => this.toggle());
    
    wrapper.appendChild(selected);
    wrapper.appendChild(this.dropdown);
    this.container.appendChild(wrapper);
    
    this.updateDropdown(POPULAR_STYLES);
  }

  private updateDropdown(styles: StyleInfo[]): void {
    // Only update the list, not the search input
    let stylesList = this.dropdown.querySelector(".style-picker-list") as HTMLDivElement;
    
    if (!stylesList) {
      // First time setup - create search input and list container
      const searchWrapper = document.createElement("div");
      searchWrapper.className = "style-picker-search";
      searchWrapper.appendChild(this.input);
      this.dropdown.appendChild(searchWrapper);
      
      stylesList = document.createElement("div");
      stylesList.className = "style-picker-list";
      this.dropdown.appendChild(stylesList);
    }
    
    // Clear only the styles list, not the entire dropdown
    stylesList.innerHTML = "";
    
    if (styles.length === 0) {
      const noResults = document.createElement("div");
      noResults.className = "style-picker-no-results";
      noResults.textContent = "No styles found";
      stylesList.appendChild(noResults);
    } else {
      // Group by category
      const grouped = new Map<string, StyleInfo[]>();
      styles.forEach(style => {
        if (!grouped.has(style.category)) {
          grouped.set(style.category, []);
        }
        grouped.get(style.category)!.push(style);
      });
      
      // Render each category
      grouped.forEach((categoryStyles, category) => {
        const categoryHeader = document.createElement("div");
        categoryHeader.className = "style-picker-category";
        categoryHeader.textContent = category;
        stylesList.appendChild(categoryHeader);
        
        categoryStyles.forEach(style => {
          const item = document.createElement("div");
          item.className = "style-picker-item";
          if (style.id === this.selectedStyle) {
            item.classList.add("selected");
          }
          
          // Create style name with format badge
          const nameSpan = document.createElement("span");
          nameSpan.className = "style-name";
          nameSpan.textContent = style.name;
          item.appendChild(nameSpan);
          
          // Add citation format badge if available
          if (style.citationFormat) {
            const badge = document.createElement("span");
            badge.className = `style-badge style-badge-${style.citationFormat}`;
            badge.textContent = this.formatBadgeText(style.citationFormat);
            badge.title = `Citation format: ${style.citationFormat}`;
            item.appendChild(badge);
          }
          
          // Add dependent indicator
          if (style.isDependent) {
            const depBadge = document.createElement("span");
            depBadge.className = "style-badge style-badge-dependent";
            depBadge.textContent = "alias";
            depBadge.title = "This style is an alias for another style";
            item.appendChild(depBadge);
          }
          
          item.dataset.styleId = style.id;
          
          item.addEventListener("click", () => {
            this.selectStyle(style.id);
          });
          
          stylesList.appendChild(item);
        });
      });
    }
    
    // Add "Browse all styles" button if not in all styles mode and not loading
    if (!this.allStylesMode && !this.isLoadingAllStyles) {
      const browseAllBtn = document.createElement("button");
      browseAllBtn.className = "style-picker-browse-all";
      browseAllBtn.textContent = `Browse all 9,000+ styles...`;
      browseAllBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.loadAllStyles();
      });
      stylesList.appendChild(browseAllBtn);
    }
    
    // Show loading state if fetching all styles
    if (this.isLoadingAllStyles) {
      const loading = document.createElement("div");
      loading.className = "style-picker-loading";
      loading.textContent = "Loading all styles...";
      stylesList.appendChild(loading);
    }
    
    // Show "Back to curated" button if in all styles mode
    if (this.allStylesMode) {
      const backBtn = document.createElement("button");
      backBtn.className = "style-picker-back-btn";
      backBtn.textContent = `← Back to curated list`;
      backBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showCuratedStyles();
      });
      stylesList.insertBefore(backBtn, stylesList.firstChild);
    }
  }

  private getStyleName(styleId: string): string {
    const style = POPULAR_STYLES.find(s => s.id === styleId);
    return style ? style.name : styleId;
  }

  private toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private open(): void {
    this.isOpen = true;
    this.dropdown.classList.remove("hidden");
    
    this.updatePosition();
    // Add scroll/resize listeners to update position dynamically
    window.addEventListener("scroll", this.boundUpdatePosition, true);
    window.addEventListener("resize", this.boundUpdatePosition);
    
    this.input.value = "";
    this.input.focus();
    this.updateDropdown(POPULAR_STYLES);
  }

  private close(): void {
    this.isOpen = false;
    this.dropdown.classList.add("hidden");
    
    // Remove listeners
    window.removeEventListener("scroll", this.boundUpdatePosition, true);
    window.removeEventListener("resize", this.boundUpdatePosition);
    
    this.input.value = "";
  }

  private updatePosition(): void {
    if (!this.isOpen) return;
    
    const rect = this.container.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = 400; // Max height defined in CSS
    
    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
      this.dropdown.classList.add("open-up");
    } else {
      this.dropdown.classList.remove("open-up");
    }
  }

  private selectStyle(styleId: string): void {
    this.selectedStyle = styleId;
    this.close();
    this.updateSelectedDisplay();
    
    if (this.onChangeCallback) {
      this.onChangeCallback(styleId);
    }
  }

  private updateSelectedDisplay(): void {
    const selectedElement = this.container.querySelector(".style-picker-selected");
    if (selectedElement) {
      const styleName = this.getStyleName(this.selectedStyle);
      selectedElement.innerHTML = `
        <span class="style-name">${styleName}</span>
        <span class="style-arrow">▼</span>
      `;
    }
  }

  private async loadAllStyles(): Promise<void> {
    this.isLoadingAllStyles = true;
    this.updateDropdown(POPULAR_STYLES); // Show loading state
    
    try {
      const result = await fetchAllStyles();
      this.allStyles = result.styles;
      this.allStylesMode = true;
      this.isLoadingAllStyles = false;
      
      // Update dropdown with all styles
      this.updateDropdown(this.allStyles);
      
      // Clear and refocus search input
      this.input.value = "";
      this.input.placeholder = `Search ${result.totalCount.toLocaleString()} styles...`;
      this.input.focus();
    } catch (error) {
      this.isLoadingAllStyles = false;
      alert("Failed to load all styles. Please try again.");
      this.updateDropdown(POPULAR_STYLES);
    }
  }

  private showCuratedStyles(): void {
    this.allStylesMode = false;
    this.input.value = "";
    this.input.placeholder = "Search citation styles...";
    this.updateDropdown(POPULAR_STYLES);
    this.input.focus();
  }

  private attachEventListeners(): void {
    // Search functionality
    this.input.addEventListener("input", () => {
      const query = this.input.value;
      const results = this.allStylesMode 
        ? searchAllStyles(this.allStyles, query)
        : searchStyles(query);
      this.updateDropdown(results);
    });
    
    // Close on outside click
    document.addEventListener("click", (e) => {
      if (!this.container.contains(e.target as Node)) {
        this.close();
      }
    });
    
    // Keyboard navigation
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.close();
      }
    });
  }

  /**
   * Format citation format type for badge display
   */
  private formatBadgeText(format: string): string {
    const labels: Record<string, string> = {
      "author-date": "Author-Date",
      "numeric": "Numeric",
      "note": "Note",
      "label": "Label",
      "author": "Author"
    };
    return labels[format] || format;
  }

  /**
   * Set callback for when style changes
   */
  public onChange(callback: (styleId: string) => void): void {
    this.onChangeCallback = callback;
  }

  /**
   * Get currently selected style ID
   */
  public getSelectedStyle(): string {
    return this.selectedStyle;
  }

  /**
   * Set selected style programmatically
   */
  public setSelectedStyle(styleId: string): void {
    this.selectedStyle = styleId;
    this.updateSelectedDisplay();
  }
}
