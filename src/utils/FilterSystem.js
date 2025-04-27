/**
 * FilterSystem Module
 * Provides a reusable filter system for consistent filtering across the application
 * Extracted from the Achievements page (assignments.js)
 * 
 * HOW FILTERS WORK:
 * -----------------
 * 1. Different fields are combined with AND logic
 *    (e.g., Phase=Primary AND Year=Year3 means staff must match both criteria)
 * 
 * 2. Multiple filters on the same field follow these rules:
 *    - INCLUDE filters: Staff must match AT LEAST ONE (OR logic)
 *      Example: Include Phase=Primary OR Phase=Secondary
 *    
 *    - EXCLUDE filters: Staff must NOT match ANY (AND NOT logic)
 *      Example: NOT Phase=Year1 AND NOT Phase=Year2
 *    
 *    - Mixed INCLUDE and EXCLUDE: Staff must match at least one INCLUDE
 *      AND not match any EXCLUDE
 *      Example: (Phase=Primary OR Phase=Secondary) AND NOT Phase=Year1
 * 
 * 3. Text fields (name, standard search) use partial matching
 *    while dropdown fields use exact matching
 */
import { Logger, Models } from './index.js';

export class FilterSystem {
    /**
     * Initialize the filter system
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.filterSection - Container for filter section
     * @param {Function} options.onFilterChange - Callback when filters change
     * @param {Array} options.staffData - Staff data array
     * @param {Array} options.standardsData - Standards data array
     * @param {Boolean} options.includeStandardsFilters - Whether to include standards filters
     */
    constructor(options) {
        this.filterSection = options.filterSection;
        this.onFilterChange = options.onFilterChange;
        this.staffData = options.staffData || [];
        this.standardsData = options.standardsData || [];
        this.options = options; // Save all options
        
        // Initialize filter state
        this.currentFilter = {};
        this.filteredStaff = [...this.staffData];
        this.filteredStandards = [...this.standardsData];
        
        // Ensure filter styles are loaded
        this.ensureFilterStylesLoaded();
        
        // Render filter controls
        this.initialize();
    }
    
    /**
     * Ensure the filter styles are loaded
     * Filter styles should be provided by filters.css in the global styles
     */
    ensureFilterStylesLoaded() {
        // Since the filters.css is now included in index.html, this is just a safety check
        if (!document.querySelector('link[href*="filters.css"]')) {
            console.warn('Filters stylesheet not found in document. It should be included in index.html.');
            
            // Add it as a fallback if somehow not loaded
            const filterStyles = document.createElement('link');
            filterStyles.rel = 'stylesheet';
            filterStyles.href = '/src/styles/filters.css';
            document.head.appendChild(filterStyles);
        }
    }
    
    /**
     * Initialize filter system and render filter controls
     */
    initialize() {
        // Create filter section if it doesn't exist
        if (!this.filterSection.innerHTML.trim()) {
            this.filterSection.innerHTML = `
                <h3>Filters</h3>
                <div class="filter-container">
                    <div class="filter-row main-filters">
                        <div class="filter-group staff-group">
                            <h4>Staff Information</h4>
                            <div id="staff-filters" class="filter-row"></div>
                        </div>
                        <div class="filter-group classification-group">
                            <h4>Classification</h4>
                            <div id="classification-filters" class="filter-row"></div>
                        </div>
                    </div>
                    ${this.options.includeStandardsFilters !== false ? `
                    <div class="filter-row standards-row">
                        <div class="filter-group standards-group">
                            <h4>Standards</h4>
                            <div id="standards-filters" class="filter-row"></div>
                        </div>
                    </div>
                    ` : ''}
                </div>
                <div class="filter-actions mt-1">
                    <button id="clear-filters" class="button button-secondary">Clear All Filters</button>
                </div>
            `;
        }
        
        const staffFilters = this.filterSection.querySelector('#staff-filters');
        const classificationFilters = this.filterSection.querySelector('#classification-filters');
        const standardsFilters = this.filterSection.querySelector('#standards-filters');
        
        // Define default filter groups if no custom filters are provided
        let filterGroups;
        
        // Use customFilters if provided, otherwise use defaults
        if (this.options.customFilters) {
            filterGroups = this.options.customFilters;
        } else {
            filterGroups = {
                staff: [
                    { id: 'name', name: 'Name', type: 'text' },
                    { id: 'id', name: 'ID', type: 'text' }
                ],
                classification: [
                    { id: 'phase', name: 'Phase', type: 'dropdown', options: Models.Staff.phaseOptions },
                    { id: 'overseas_thai', name: 'Overseas/Thai', type: 'dropdown', options: Models.Staff.overseasThaiOptions },
                    { id: 'year_group', name: 'Year Group', type: 'dropdown', options: Models.Staff.yearGroupOptions },
                    { id: 'department', name: 'Department', type: 'dropdown', options: Models.Staff.departmentOptions }
                ],
                standards: [
                    { id: 'standards', name: 'Filter:', type: 'text' }
                ]
            };
        }
        
        // Render each filter group if container exists
        if (staffFilters) {
            this.renderFilterGroup(filterGroups.staff || [], staffFilters);
        }
        
        if (classificationFilters) {
            this.renderFilterGroup(filterGroups.classification || [], classificationFilters);
        }
        
        // Only render standards filters if not excluded
        if (this.options.includeStandardsFilters !== false && standardsFilters) {
            this.renderFilterGroup(filterGroups.standards || [], standardsFilters, true);
        }
        
        // Add event listeners for live filtering of input values (not tags)
        this.filterSection.querySelectorAll('select, input[type="text"]').forEach(element => {
            element.addEventListener('input', () => this.applyFilters());
        });
        
        // Add event listeners for include/exclude toggle
        this.filterSection.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => this.applyFilters());
        });
        
        // Add event listener for the clear filters button
        this.filterSection.querySelector('#clear-filters').addEventListener('click', () => this.clearFilters());
    }
    
    /**
     * Render a group of filters
     * @param {Array} filters - Array of filter configurations
     * @param {HTMLElement} container - Container to render filters into
     * @param {boolean} isStandards - Whether this is the standards filter group
     */
    renderFilterGroup(filters, container, isStandards = false) {
        if (!Array.isArray(filters) || !container) return;
        
        filters.forEach(item => {
            if (!item || !item.id || !item.name) return;
            
            const filterItem = document.createElement('div');
            filterItem.className = 'filter-item';
            
            if (item.type === 'dropdown') {
                // Ensure options is an array
                const options = Array.isArray(item.options) ? item.options : [];
                
                filterItem.innerHTML = `
                    <label for="filter-${item.id}">${item.name}</label>
                    <div class="filter-input-row">
                        <select id="filter-${item.id}" class="filter-select" data-field="${item.id}">
                            <option value="">All</option>
                            ${options.map(option => `<option value="${option}">${option}</option>`).join('')}
                        </select>
                        <button class="enter-filter-button" title="Add filter" data-field="${item.id}">↵</button>
                        <button class="filter-button" title="Clear this filter" data-field="${item.id}">×</button>
                    </div>
                    <div class="filter-toggle">
                        <label title="Include matches">
                            <input type="radio" name="filter-mode-${item.id}" value="include" checked>
                            <span>Include</span>
                        </label>
                        <label title="Exclude matches">
                            <input type="radio" name="filter-mode-${item.id}" value="exclude">
                            <span>Exclude</span>
                        </label>
                    </div>
                    <div class="filter-tags" id="filter-tags-${item.id}"></div>
                `;
            } else {
                // Special handling for standards filter
                const placeholder = item.id === 'standards' ? 
                    "Filter by code, name, description or group" : 
                    "Type to filter";
                    
                filterItem.innerHTML = `
                    <label for="filter-${item.id}">${item.name}</label>
                    <div class="filter-input-row">
                        <input type="text" id="filter-${item.id}" class="filter-input" data-field="${item.id}" placeholder="${placeholder}">
                        <button class="enter-filter-button" title="Add filter" data-field="${item.id}">↵</button>
                        <button class="filter-button" title="Clear this filter" data-field="${item.id}">×</button>
                    </div>
                    <div class="filter-toggle">
                        <label title="Include matches">
                            <input type="radio" name="filter-mode-${item.id}" value="include" checked>
                            <span>Include</span>
                        </label>
                        <label title="Exclude matches">
                            <input type="radio" name="filter-mode-${item.id}" value="exclude">
                            <span>Exclude</span>
                        </label>
                    </div>
                    <div class="filter-tags" id="filter-tags-${item.id}"></div>
                `;
            }
            
            container.appendChild(filterItem);
        });
        
        // Add keydown event listeners for text inputs to handle "Enter" key
        container.querySelectorAll('.filter-input').forEach(input => {
            input.addEventListener('keydown', (event) => this.handleFilterKeydown(event));
        });
        
        // Add change event listeners for dropdowns to add tags
        container.querySelectorAll('.filter-select').forEach(select => {
            select.addEventListener('change', (event) => this.handleFilterChange(event));
        });
        
        // Add click event listeners for enter filter buttons
        container.querySelectorAll('.enter-filter-button').forEach(button => {
            button.addEventListener('click', (event) => {
                const field = event.target.dataset.field;
                const input = document.getElementById(`filter-${field}`);
                
                if (input && input.value && input.value.trim() !== '') {
                    const value = input.value.trim();
                    const mode = document.querySelector(`input[name="filter-mode-${field}"]:checked`).value;
                    
                    this.addFilterTag(field, value, mode);
                    input.value = '';
                    input.focus(); // Keep focus on the input field for easy addition of multiple filters
                }
            });
        });
        
        // Add click event listeners for clear filter buttons
        container.querySelectorAll('.filter-button').forEach(button => {
            button.addEventListener('click', (event) => {
                const field = event.target.dataset.field;
                this.clearSingleFilter(field);
            });
        });
    }
    
    /**
     * Apply filters and update UI
     */
    applyFilters() {
        // Apply filter logic
        this._filterData();
        
        // Execute callback
        if (this.onFilterChange) {
            this.onFilterChange(this.getFilteredData());
        }
        
        return {
            filteredStaff: this.filteredStaff,
            filteredStandards: this.filteredStandards
        };
    }
    
    /**
     * Internal method to filter data based on current filter state
     * @private
     */
    _filterData() {
        // Check if we have any staff filters
        const hasStaffFilters = Object.keys(this.currentFilter).some(key => {
            return key !== 'standards' && Array.isArray(this.currentFilter[key]) && this.currentFilter[key].length > 0;
        });
        
        // Apply staff filters if any exist
        if (hasStaffFilters) {
            this.filteredStaff = this.staffData.filter(staff => {
                // Check each staff-related field's filter criteria
                for (const field in this.currentFilter) {
                    // Skip standards filters
                    if (field === 'standards') continue;
                    
                    // Skip fields with no filters
                    if (!Array.isArray(this.currentFilter[field]) || this.currentFilter[field].length === 0) continue;
                    
                    // Separate include and exclude filters
                    const includeFilters = this.currentFilter[field].filter(f => f.mode === 'include');
                    const excludeFilters = this.currentFilter[field].filter(f => f.mode === 'exclude');
                    
                    // Get staff field value, ensure it's a string for comparison
                    const staffFieldValue = String(staff[field] || '').trim();
                    
                    // If include filters exist, this field must match at least one include filter
                    if (includeFilters.length > 0) {
                        const matchesAnyInclude = includeFilters.some(filter => {
                            // Case-insensitive matching
                            const filterValue = filter.value.toString().toLowerCase();
                            const staffValue = staffFieldValue.toLowerCase();
                            
                            // Handle comma-separated values
                            if (staffValue.includes(', ')) {
                                // Split by comma and space, then trim each value
                                const values = staffValue.split(', ').map(v => v.trim().toLowerCase());
                                // Check if any of the values match the filter value
                                return values.some(v => v.includes(filterValue));
                            }
                            
                            // For text fields like name and id, use partial matching (contains)
                            if (field === 'name' || field === 'id') {
                                return staffValue.includes(filterValue);
                            }
                            
                            // For other fields, use exact matching
                            return staffValue === filterValue;
                        });
                        
                        if (!matchesAnyInclude) return false;
                    }
                    
                    // Staff field must not match any exclude filters
                    const matchesAnyExclude = excludeFilters.some(filter => {
                        // Case-insensitive matching
                        const filterValue = filter.value.toString().toLowerCase();
                        const staffValue = staffFieldValue.toLowerCase();
                        
                        // Handle comma-separated values
                        if (staffValue.includes(', ')) {
                            // Split by comma and space, then trim each value
                            const values = staffValue.split(', ').map(v => v.trim().toLowerCase());
                            // Check if any of the values match the filter value
                            return values.some(v => v.includes(filterValue));
                        }
                        
                        // For text fields like name and id, use partial matching (contains)
                        if (field === 'name' || field === 'id') {
                            return staffValue.includes(filterValue);
                        }
                        
                        // For other fields, use exact matching
                        return staffValue === filterValue;
                    });
                    
                    if (matchesAnyExclude) return false;
                }
                
                return true;
            });
        } else {
            // If no staff filters, show all staff
            this.filteredStaff = [...this.staffData];
        }
        
        // Filter the standard columns based on standards filters
        if (this.currentFilter.standards && this.currentFilter.standards.length > 0) {
            // Separate include and exclude filters
            const includeFilters = this.currentFilter.standards.filter(f => f.mode === 'include');
            const excludeFilters = this.currentFilter.standards.filter(f => f.mode === 'exclude');
            
            this.filteredStandards = this.standardsData.filter(standard => {
                // For standards filtering, we'll do partial matching (contains)
                // Check includes first - if any exist, at least one must match
                if (includeFilters.length > 0) {
                    const matchesAnyInclude = includeFilters.some(filter => {
                        // Get values for matching, ensure they are lowercase for case-insensitive matching
                        const filterValue = filter.value.toString().toLowerCase();
                        const codeValue = standard.code.toLowerCase();
                        const nameValue = standard.name.toLowerCase();
                        const descValue = standard.description ? standard.description.toLowerCase() : '';
                        const groupValue = standard.group ? standard.group.toLowerCase() : '';
                        
                        // Match filter against different fields
                        const codeMatch = codeValue.includes(filterValue);
                        const nameMatch = nameValue.includes(filterValue);
                        const descMatch = descValue.includes(filterValue);
                        const groupMatch = groupValue.includes(filterValue);
                        
                        return codeMatch || nameMatch || descMatch || groupMatch;
                    });
                    
                    if (!matchesAnyInclude) return false;
                }
                
                // Check excludes - standard must not match any exclude filters
                const matchesAnyExclude = excludeFilters.some(filter => {
                    // Get values for matching, ensure they are lowercase
                    const filterValue = filter.value.toString().toLowerCase();
                    const codeValue = standard.code.toLowerCase();
                    const nameValue = standard.name.toLowerCase();
                    const descValue = standard.description ? standard.description.toLowerCase() : '';
                    const groupValue = standard.group ? standard.group.toLowerCase() : '';
                    
                    // Match filter against different fields
                    const codeMatch = codeValue.includes(filterValue);
                    const nameMatch = nameValue.includes(filterValue);
                    const descMatch = descValue.includes(filterValue);
                    const groupMatch = groupValue.includes(filterValue);
                    
                    return codeMatch || nameMatch || descMatch || groupMatch;
                });
                
                if (matchesAnyExclude) return false;
                
                return true;
            });
        } else {
            // If no standards filters, show all standards
            this.filteredStandards = [...this.standardsData];
        }
        
        // Remove temporary filters after applying
        for (const field in this.currentFilter) {
            if (Array.isArray(this.currentFilter[field])) {
                this.currentFilter[field] = this.currentFilter[field].filter(filter => !filter.temporary);
                if (this.currentFilter[field].length === 0) {
                    delete this.currentFilter[field];
                }
            }
        }
    }
    
    /**
     * Clear all filters
     */
    clearFilters() {
        // Reset filter inputs
        this.filterSection.querySelectorAll('select').forEach(select => {
            select.value = '';
        });
        
        this.filterSection.querySelectorAll('input[type="text"]').forEach(input => {
            input.value = '';
        });
        
        // Clear filter tags
        this.filterSection.querySelectorAll('.filter-tags').forEach(container => {
            container.innerHTML = '';
        });
        
        // Reset filter state
        this.currentFilter = {};
        
        // Reset filtered data
        this.filteredStaff = [...this.staffData];
        this.filteredStandards = [...this.standardsData];
        
        // Call the filter change callback
        if (this.onFilterChange) {
            this.onFilterChange({
                filteredStaff: this.filteredStaff,
                filteredStandards: this.filteredStandards,
                currentFilter: this.currentFilter
            });
        }
        
        Logger.log('Cleared all filters');
    }
    
    /**
     * Clear filters for a specific field
     * @param {string} field - The field to clear filters for
     */
    clearSingleFilter(field) {
        // Reset input value
        const input = document.getElementById(`filter-${field}`);
        if (input) {
            input.value = '';
        }
        
        // Clear filter tags
        const tagContainer = document.getElementById(`filter-tags-${field}`);
        if (tagContainer) {
            tagContainer.innerHTML = '';
        }
        
        // Remove from filter state
        delete this.currentFilter[field];
        
        // Apply filters with the field removed
        this.applyFilters();
        
        Logger.log(`Cleared filter for field: ${field}`);
    }
    
    /**
     * Handle keydown event for filter inputs
     * @param {Event} event - Keydown event
     */
    handleFilterKeydown(event) {
        // Check if the Enter key was pressed
        if (event.key === 'Enter') {
            event.preventDefault();
            
            const field = event.target.dataset.field;
            const value = event.target.value.trim();
            
            if (value) {
                const mode = document.querySelector(`input[name="filter-mode-${field}"]:checked`).value;
                this.addFilterTag(field, value, mode);
                event.target.value = '';
            }
        }
    }
    
    /**
     * Handle change event for filter dropdowns
     * @param {Event} event - Change event
     */
    handleFilterChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value;
        
        if (value) {
            const mode = document.querySelector(`input[name="filter-mode-${field}"]:checked`).value;
            this.addFilterTag(field, value, mode);
            event.target.value = '';
        }
    }
    
    /**
     * Add a filter tag
     * @param {string} field - Field to filter
     * @param {string} value - Value to filter
     * @param {string} mode - Filter mode (include or exclude)
     */
    addFilterTag(field, value, mode = 'include') {
        // Validate input
        if (!field || !value) return;
        
        // Ensure value is a string
        const valueStr = String(value).trim();
        if (!valueStr) return;
        
        // Create a unique ID for the tag
        const tagId = `filter-${field}-${Date.now()}`;
        
        // Get or create container for tags
        const tagsContainer = document.getElementById(`filter-tags-${field}`);
        if (!tagsContainer) return;
        
        // Create tag element
        const tag = document.createElement('span');
        tag.className = `filter-tag ${mode === 'exclude' ? 'exclude' : ''}`;
        tag.id = tagId;
        tag.innerHTML = `
            <span class="filter-tag-text">${valueStr}</span>
            <span class="filter-tag-remove">&times;</span>
        `;
        
        // Add removal event
        tag.querySelector('.filter-tag-remove').addEventListener('click', () => {
            this.removeFilterTag(tagId, field);
        });
        
        // Add to container
        tagsContainer.appendChild(tag);
        
        // Add to filter state
        if (!this.currentFilter[field]) {
            this.currentFilter[field] = [];
        }
        
        // Add exactly as provided (preserve case)
        this.currentFilter[field].push({
            id: tagId,
            value: valueStr,
            mode: mode,
            temporary: false
        });
        
        // Apply filters
        this.applyFilters();
        
        Logger.log(`Added filter tag for ${field}: ${valueStr} (${mode})`);
    }
    
    /**
     * Remove a filter tag
     * @param {string} tagId - ID of the tag to remove
     * @param {string} field - Field the tag belongs to
     */
    removeFilterTag(tagId, field) {
        // Remove tag element
        const tag = document.getElementById(tagId);
        if (tag) {
            tag.remove();
        }
        
        // Remove from filter state
        if (this.currentFilter[field]) {
            this.currentFilter[field] = this.currentFilter[field].filter(filter => filter.id !== tagId);
            
            if (this.currentFilter[field].length === 0) {
                delete this.currentFilter[field];
            }
        }
        
        // Apply filters with the tag removed
        this.applyFilters();
        
        Logger.log(`Removed filter tag: ${tagId}`);
    }
    
    /**
     * Get the filtered data
     * @returns {Object} - Filtered data
     */
    getFilteredData() {
        return {
            filteredStaff: this.filteredStaff,
            filteredStandards: this.filteredStandards,
            currentFilter: this.currentFilter
        };
    }
    
    /**
     * Update data sources
     * @param {Object} data - Data sources
     * @param {Array} data.staffData - Staff data array
     * @param {Array} data.standardsData - Standards data array
     */
    updateData(data) {
        if (data.staffData) {
            this.staffData = data.staffData;
            this.filteredStaff = [...this.staffData];
        }
        
        if (data.standardsData) {
            this.standardsData = data.standardsData;
            this.filteredStandards = [...this.standardsData];
        }
        
        // Reapply filters with new data
        this.applyFilters();
    }
    
    /**
     * Set the filter state from an external source
     * @param {Object} filterState - Filter state object
     * Set filter state directly with new filter configuration
     * @param {Object} filterState - New filter state to apply
     */
    setFilterState(filterState) {
        // Clear current filters first
        this.clearFilters();
        
        // Add each filter tag based on the provided state
        for (const [field, filters] of Object.entries(filterState)) {
            if (Array.isArray(filters)) {
                filters.forEach(filter => {
                    if (filter.value) {
                        this.addFilterTag(field, filter.value, filter.mode || 'include');
                    }
                });
            }
        }
    }
} 