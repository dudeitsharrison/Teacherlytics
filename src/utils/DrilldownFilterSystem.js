/**
 * DrilldownFilterSystem Module
 * Provides an interactive drill-down filter system with circular UI elements
 * Users can select header attributes and drill down through staff data
 */
import { Logger } from './logger.js';

export class DrilldownFilterSystem {
    /**
     * Initialize the drill-down filter system
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.container - Container for the filter system
     * @param {Array} options.staffData - Staff data array
     * @param {Array} options.filterFields - Array of fields to use for filtering
     * @param {Function} options.onFilterChange - Callback when filters change
     * @param {Object} options.filterSystem - Reference to main filter system (optional)
     */
    constructor(options) {
        this.container = options.container;
        this.staffData = options.staffData || [];
        this.filterFields = options.filterFields || [];
        this.onFilterChange = options.onFilterChange;
        this.filterSystem = options.filterSystem;
        
        // Generate unique IDs for this instance
        this.instanceId = `circle-filter-${Date.now()}`;
        
        // DOM elements we'll store references to
        this.elements = {
            selector: null,
            breadcrumbs: null,
            circles: null,
            results: null,
            staffList: null,
            resultsCount: null,
            resetButton: null
        };
        
        // Initialize state
        this.currentFilters = [];
        this.filteredStaff = [...this.staffData];
        this.activeField = null;
        this.filterHistory = [];
        this.diveLevel = 0;
        
        // Create HTML elements
        this.buildFilterUI();
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    /**
     * Create the filter UI elements
     */
    buildFilterUI() {
        // Create filter options HTML
        const filterOptions = this.filterFields.map(field => 
            `<option value="${field.id}">${field.name}</option>`
        ).join('');
        
        // Create filter HTML
        this.container.innerHTML = `
            <div class="circle-filter-container">
                <div class="circle-filter-header">
                    <h3 class="circle-filter-title">Drill-Down Filters</h3>
                    <select class="circle-filter-selector">
                        <option value="">Select a starting filter...</option>
                        ${filterOptions}
                    </select>
                </div>
                <div class="circle-filter-breadcrumbs"></div>
                <div class="circle-filter-circles"></div>
                <div class="circle-filter-results" style="display: none;">
                    <div class="circle-filter-results-header">
                        <span class="circle-filter-results-title">Staff Matching Filters</span>
                        <span class="circle-filter-results-count">0 staff members</span>
                        <span class="circle-filter-reset">Reset Filters</span>
                    </div>
                    <div class="circle-filter-staff-list"></div>
                </div>
            </div>
        `;
        
        // Cache element references
        this.cacheElements();
    }
    
    /**
     * Cache references to DOM elements for faster access
     */
    cacheElements() {
        const container = this.container.querySelector('.circle-filter-container');
        if (!container) return;
        
        this.elements = {
            selector: container.querySelector('.circle-filter-selector'),
            breadcrumbs: container.querySelector('.circle-filter-breadcrumbs'),
            circles: container.querySelector('.circle-filter-circles'),
            results: container.querySelector('.circle-filter-results'),
            staffList: container.querySelector('.circle-filter-staff-list'),
            resultsCount: container.querySelector('.circle-filter-results-count'),
            resetButton: container.querySelector('.circle-filter-reset')
        };
    }
    
    /**
     * Set up event listeners for filter controls
     */
    setupEventListeners() {
        // Get elements
        this.selector = this.container.querySelector('.circle-filter-selector');
        this.breadcrumbs = this.container.querySelector('.circle-filter-breadcrumbs');
        this.circles = this.container.querySelector('.circle-filter-circles');
        this.results = this.container.querySelector('.circle-filter-results');
        this.resetButton = this.container.querySelector('.circle-filter-reset');
        this.resultsCount = this.container.querySelector('.circle-filter-results-count');
        this.staffList = this.container.querySelector('.circle-filter-staff-list');
        
        // Add selector change listener
        if (this.selector) {
            this.selector.addEventListener('change', (e) => {
                this.handleFieldSelect(e.target.value);
            });
        }
        
        // Add reset button listener
        if (this.resetButton) {
            this.resetButton.addEventListener('click', () => {
                this.resetFilters();
            });
        }
    }
    
    /**
     * Handle field selection from dropdown
     */
    handleFieldSelect(fieldId) {
        if (!fieldId) return;
        
        // Reset filters but keep selector value
        this.resetFilters(false);
        
        this.activeField = fieldId;
        this.diveLevel = 0;
        
        // Generate filter options
        this.generateFilterOptions();
    }
    
    /**
     * Generate filter circles for active field
     */
    generateFilterOptions() {
        if (!this.circles) {
            Logger.error('Circles element not found');
            return;
        }
        
        // Clear previous circles
        this.circles.innerHTML = '';
        
        // Apply current filters without triggering callback
        this.applyFilters(false);
        
        // Update UI based on filter state
        this.updateResultsUI();
        
        // Update breadcrumbs
        this.generateBreadcrumbs();
        
        // If no active field, stop here
        if (!this.activeField) return;
        
        // Get field config
        const fieldConfig = this.filterFields.find(f => f.id === this.activeField);
        if (!fieldConfig) return;
        
        // Get unique values for active field
        const uniqueValues = this.getUniqueFieldValues(this.activeField);
        
        // Create a circle for each value
        uniqueValues.forEach((value, index) => {
            if (!value || value === '') return;
            
            try {
                // Count staff with this value
                const count = this.filteredStaff.filter(staff => {
                    try {
                        const staffFieldValue = staff[this.activeField];
                        
                        // Handle multiple values (comma-separated lists)
                        if (staffFieldValue && typeof staffFieldValue === 'string' && staffFieldValue.includes(', ')) {
                            // Split by comma and space, then trim each value
                            const values = staffFieldValue.split(', ').map(v => v.trim());
                            // Check if any of the values match the filter value
                            return values.includes(value);
                        }
                        
                        // Standard exact matching for single values
                        return staffFieldValue === value;
                    } catch (error) {
                        console.error(`Error filtering staff for field ${this.activeField}:`, staff, error);
                        return false;
                    }
                }).length;
                
                // Create circle element
                const circleItem = document.createElement('div');
                circleItem.className = 'circle-filter-item';
                
                // Assign color based on index
                const colorIndex = (index % 10) + 1;
                
                // Set circle content
                circleItem.innerHTML = `
                    <div class="circle-filter-circle circle-color-${colorIndex}">
                        ${value}
                    </div>
                    <div class="circle-filter-label">
                        ${count} staff
                    </div>
                `;
                
                // Add click handler
                circleItem.addEventListener('click', () => {
                    this.selectFilterValue(value);
                });
                
                // Add to container
                this.circles.appendChild(circleItem);
            } catch (error) {
                console.error(`Error processing filter value "${value}":`, error);
            }
        });
    }
    
    /**
     * Update the results UI based on current filters
     */
    updateResultsUI() {
        // Check if all UI elements are available
        if (!this.results) {
            console.warn('Results container not available');
            return;
        }
        
        if (this.currentFilters.length > 0) {
            // Show results
            this.results.style.display = 'block';
            
            // Update count if element exists
            if (this.resultsCount) {
                this.resultsCount.textContent = 
                    `${this.filteredStaff.length} staff member${this.filteredStaff.length !== 1 ? 's' : ''}`;
            }
            
            // Update staff list if element exists
            if (this.staffList) {
                try {
                    this.staffList.innerHTML = this.generateStaffList();
                } catch (error) {
                    console.error('Error updating staff list:', error);
                }
            }
        } else {
            // Hide results
            this.results.style.display = 'none';
        }
    }
    
    /**
     * Handle selection of a filter value
     */
    selectFilterValue(value) {
        if (!this.activeField) return;
        
        Logger.log(`Selected ${this.activeField} = ${value}`);
        
        // Add new filter
        this.currentFilters.push({
            field: this.activeField,
            value: value,
            level: this.diveLevel
        });
        
        // Move to next field
        this.diveLevel++;
        
        // Find next field index
        const currentIndex = this.filterFields.findIndex(f => f.id === this.activeField);
        const nextIndex = (currentIndex + 1) % this.filterFields.length;
        
        // Set next active field
        this.activeField = this.filterFields[nextIndex].id;
        
        // Update filter options without triggering callback (we'll do it via updateMainFilterSystem)
        this.generateFilterOptions();
        
        // Update main filter system
        this.updateMainFilterSystem();
        
        // Trigger callback explicitly once
        if (this.onFilterChange) {
            this.onFilterChange(this.filteredStaff);
        }
    }
    
    /**
     * Generate breadcrumbs for current filters
     */
    generateBreadcrumbs() {
        if (!this.breadcrumbs) return;
        
        // Clear previous breadcrumbs
        this.breadcrumbs.innerHTML = '';
        
        // Create breadcrumb for each filter
        this.currentFilters.forEach((filter, index) => {
            const fieldConfig = this.filterFields.find(f => f.id === filter.field);
            if (!fieldConfig) return;
            
            // Create breadcrumb element
            const breadcrumb = document.createElement('div');
            breadcrumb.className = 'circle-filter-breadcrumb';
            breadcrumb.innerHTML = `
                <span class="circle-filter-breadcrumb-label">${fieldConfig.name}:</span>
                <span class="circle-filter-breadcrumb-value">${filter.value}</span>
                <span class="circle-filter-breadcrumb-remove" data-index="${index}">×</span>
            `;
            
            // Add remove handler
            const removeButton = breadcrumb.querySelector('.circle-filter-breadcrumb-remove');
            if (removeButton) {
                removeButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeFilter(index);
                });
            }
            
            // Add click handler
            breadcrumb.addEventListener('click', () => {
                this.navigateToFilter(index);
            });
            
            // Add to container
            this.breadcrumbs.appendChild(breadcrumb);
        });
    }
    
    /**
     * Apply current filters to staff data
     * @param {boolean} triggerCallback - Whether to trigger the callback (default: false)
     */
    applyFilters(triggerCallback = false) {
        // Start with all staff
        this.filteredStaff = [...this.staffData];
        
        // Apply each filter
        this.currentFilters.forEach(filter => {
            try {
                this.filteredStaff = this.filteredStaff.filter(staff => {
                    try {
                        // Get staff field value
                        const staffFieldValue = staff[filter.field];
                        
                        // Handle multiple values (comma-separated lists)
                        if (staffFieldValue && typeof staffFieldValue === 'string' && staffFieldValue.includes(', ')) {
                            // Split by comma and space, then trim each value
                            const values = staffFieldValue.split(', ').map(v => v.trim());
                            // Check if any of the values match the filter value
                            return values.includes(filter.value);
                        }
                        
                        // Standard exact matching for single values
                        return staffFieldValue === filter.value;
                    } catch (error) {
                        console.error(`Error filtering staff for field ${filter.field}:`, staff, error);
                        return false; // Exclude problematic staff members
                    }
                });
            } catch (error) {
                console.error(`Error applying filter:`, filter, error);
            }
        });
        
        // Only trigger callback if explicitly requested
        if (triggerCallback && this.onFilterChange) {
            this.onFilterChange(this.filteredStaff);
        }
    }
    
    /**
     * Remove a filter by index
     */
    removeFilter(index) {
        if (index < 0 || index >= this.currentFilters.length) return;
        
        // Remove filter and all after it
        this.currentFilters = this.currentFilters.slice(0, index);
        
        // Reset dive level
        if (this.currentFilters.length > 0) {
            // Set to level after last remaining filter
            this.diveLevel = this.currentFilters[this.currentFilters.length - 1].level + 1;
            
            // Set active field to next field after last filter
            const lastFilterIndex = this.filterFields.findIndex(
                f => f.id === this.currentFilters[this.currentFilters.length - 1].field
            );
            
            const nextIndex = (lastFilterIndex + 1) % this.filterFields.length;
            this.activeField = this.filterFields[nextIndex].id;
        } else {
            // Reset to initial state
            this.diveLevel = 0;
            this.activeField = this.selector ? this.selector.value : null;
        }
        
        // Update filter options without triggering callback (we'll do it via updateMainFilterSystem)
        this.generateFilterOptions();
        
        // Update main filter system
        this.updateMainFilterSystem();
        
        // Trigger callback explicitly once
        if (this.onFilterChange) {
            this.onFilterChange(this.filteredStaff);
        }
    }
    
    /**
     * Navigate to a specific filter level
     */
    navigateToFilter(index) {
        if (index < 0 || index >= this.currentFilters.length) return;
        
        // Keep filters up to this one
        this.currentFilters = this.currentFilters.slice(0, index + 1);
        
        // Set dive level
        this.diveLevel = this.currentFilters[index].level + 1;
        
        // Set active field to next field
        const fieldIndex = this.filterFields.findIndex(f => f.id === this.currentFilters[index].field);
        const nextIndex = (fieldIndex + 1) % this.filterFields.length;
        this.activeField = this.filterFields[nextIndex].id;
        
        // Update filter options without triggering callback (we'll do it via updateMainFilterSystem)
        this.generateFilterOptions();
        
        // Update main filter system
        this.updateMainFilterSystem();
        
        // Trigger callback explicitly once
        if (this.onFilterChange) {
            this.onFilterChange(this.filteredStaff);
        }
    }
    
    /**
     * Reset all filters
     */
    resetFilters(resetSelector = true) {
        // Clear filters
        this.currentFilters = [];
        this.filteredStaff = [...this.staffData];
        this.diveLevel = 0;
        
        // Reset selector if requested
        if (resetSelector && this.selector) {
            this.selector.value = '';
            this.activeField = null;
        }
        
        // Clear UI
        if (this.breadcrumbs) this.breadcrumbs.innerHTML = '';
        if (this.circles) this.circles.innerHTML = '';
        if (this.results) this.results.style.display = 'none';
        
        // Update main filter system
        this.updateMainFilterSystem();
        
        // Trigger callback explicitly once
        if (this.onFilterChange) {
            this.onFilterChange(this.filteredStaff);
        }
    }
    
    /**
     * Update the main filter system
     */
    updateMainFilterSystem() {
        // Check if main filter system is available and active
        if (!this.filterSystem) return;
        
        // Get current filter state
        const currentFilters = {};
        
        // Preserve the current data category from the chart system
        const activeChartId = this.getActiveChartId();
        const dataCategory = this.getActiveChartDataCategory();
        
        // If there are no current filters, just clear drill-down related filters
        // but don't clear all filters in the main system
        if (this.currentFilters.length === 0) {
            // Get current filter state from main system
            const mainFilters = this.filterSystem.getFilteredData().currentFilter;
            
            // Create a copy without our drilldown fields
            const fieldsToPreserve = {};
            for (const field in mainFilters) {
                const isOurField = this.filterFields.some(f => f.id === field);
                if (!isOurField) {
                    fieldsToPreserve[field] = mainFilters[field];
                }
            }
            
            // Apply the preserved filters
            this.filterSystem.setFilterState(fieldsToPreserve);
            
            // Update filtered data in this system
            this.filteredStaff = this.filterSystem.getFilteredData().filteredStaff;
            
            Logger.log('Cleared drilldown filters, preserved other filters');
            return;
        }
        
        // Convert drilldown filters to main filter system format
        for (const filter of this.currentFilters) {
            // Get field and value
            const { field, value } = filter;
            
            // Initialize field array if not exists
            if (!currentFilters[field]) {
                currentFilters[field] = [];
            }
            
            // Add filter with a unique ID and preserve case
            currentFilters[field].push({
                id: `filter-${field}-${Date.now()}`,
                value: value, // Use exact case from the filter
                mode: 'include',
                temporary: false
            });
        }
        
        // Merge with existing non-drilldown filters from the main filter system
        const mainFilters = this.filterSystem.getFilteredData().currentFilter;
        for (const field in mainFilters) {
            // Skip fields that are part of our drilldown system
            const isOurField = this.filterFields.some(f => f.id === field);
            if (!isOurField) {
                currentFilters[field] = mainFilters[field];
            }
        }
        
        // Apply filters to main filter system
        if (Object.keys(currentFilters).length > 0) {
            // Update filter system
            this.filterSystem.setFilterState(currentFilters);
            
            // Update filtered data in this system - handle staff with multiple values
            this.filteredStaff = this.staffData.filter(staff => {
                try {
                    // Check each filter field
                    for (const [field, filters] of Object.entries(currentFilters)) {
                        // Skip non-array filters
                        if (!Array.isArray(filters) || filters.length === 0) continue;
                        
                        // Skip if this field isn't one of our filter fields
                        if (!this.filterFields.some(f => f.id === field)) continue;
                        
                        const staffFieldValue = staff[field];
                        
                        // Skip if field value is missing
                        if (!staffFieldValue) return false;
                        
                        // Handle comma-separated values
                        if (typeof staffFieldValue === 'string' && staffFieldValue.includes(', ')) {
                            const values = staffFieldValue.split(', ').map(v => v.trim());
                            
                            // For each filter, check if any of the staff values match
                            const anyMatch = filters.some(filter => 
                                values.includes(filter.value)
                            );
                            
                            // If no match, exclude this staff
                            if (!anyMatch) return false;
                        } else {
                            // For single value, check against all filters
                            const anyMatch = filters.some(filter => 
                                staffFieldValue === filter.value
                            );
                            
                            // If no match, exclude this staff
                            if (!anyMatch) return false;
                        }
                    }
                    
                    // If all filter conditions met, include this staff
                    return true;
                } catch (error) {
                    console.error('Error filtering staff in updateMainFilterSystem:', staff, error);
                    return false; // Exclude staff with errors
                }
            });
            
            // Log the filter application
            Logger.log(`Applied filters: ${JSON.stringify(currentFilters)}`);
            
            // Add filter tags for each filter
            for (const field in currentFilters) {
                if (Array.isArray(currentFilters[field])) {
                    for (const filter of currentFilters[field]) {
                        Logger.log(`Added filter tag for ${field}: ${filter.value} (${filter.mode})`);
                    }
                }
            }
        } else {
            Logger.log('Applied filters: {}');
        }
    }
    
    /**
     * Get the active chart ID if available
     * @returns {string|null} Active chart ID or null
     */
    getActiveChartId() {
        const activeChartContainer = document.querySelector('.chart-wrapper');
        if (!activeChartContainer) return null;
        
        const chartActionButtons = activeChartContainer.querySelectorAll('.chart-actions button');
        if (!chartActionButtons || chartActionButtons.length === 0) return null;
        
        return chartActionButtons[0].dataset.chartId || null;
    }
    
    /**
     * Get the current data category from the active chart
     * @returns {string} Data category or 'auto' if not found
     */
    getActiveChartDataCategory() {
        const activeChartContainer = document.querySelector('.chart-wrapper');
        if (!activeChartContainer) return 'auto';
        
        const categorySelector = activeChartContainer.querySelector('#data-category-selector');
        return categorySelector ? categorySelector.value : 'auto';
    }
    
    /**
     * Generate HTML for staff list
     */
    generateStaffList() {
        if (this.filteredStaff.length === 0) {
            return '<p>No staff members match the selected filters.</p>';
        }
        
        // Limit to 10 staff with "show more" option
        const displayStaff = this.filteredStaff.slice(0, 10);
        const hasMore = this.filteredStaff.length > 10;
        
        let html = '<ul class="circle-filter-staff-list">';
        
        displayStaff.forEach(staff => {
            html += `
                <li class="circle-filter-staff">
                    <span>${staff.name || 'Unknown'}</span>
                    <small>(ID: ${staff.id || 'N/A'})</small>
                </li>
            `;
        });
        
        html += '</ul>';
        
        if (hasMore) {
            html += `<p class="circle-filter-more">+ ${this.filteredStaff.length - 10} more staff members</p>`;
        }
        
        return html;
    }
    
    /**
     * Get unique values for a field
     */
    getUniqueFieldValues(fieldId) {
        // Get all values (potentially comma-separated)
        const allValues = [];
        
        // Process each staff member
        this.filteredStaff.forEach(staff => {
            try {
                const fieldValue = staff[fieldId];
                
                // Skip null/undefined/empty values or non-string values
                if (fieldValue == null || fieldValue === '' || typeof fieldValue !== 'string') return;
                
                // Handle comma-separated values
                if (fieldValue.includes(', ')) {
                    // Split by comma and space, then trim each value
                    const values = fieldValue.split(', ').map(v => v.trim());
                    // Add each value to allValues
                    values.forEach(value => {
                        if (value && !allValues.includes(value)) {
                            allValues.push(value);
                        }
                    });
                } else {
                    // Single value - add if not already in list
                    if (!allValues.includes(fieldValue)) {
                        allValues.push(fieldValue);
                    }
                }
            } catch (error) {
                // Log and skip any problematic data
                console.error(`Error processing field ${fieldId} for staff:`, staff, error);
            }
        });
        
        return allValues;
    }
    
    /**
     * Update staff data
     */
    updateData(staffData) {
        this.staffData = staffData || [];
        this.filteredStaff = [...this.staffData];
        this.generateFilterOptions();
    }
    
    /**
     * Get filtered staff
     */
    getFilteredStaff() {
        return this.filteredStaff;
    }
} 