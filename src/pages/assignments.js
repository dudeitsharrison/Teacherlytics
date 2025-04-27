/**
 * Achievements Page
 * For tracking staff achievement of standards
 */
import { Storage, Logger, Models, Validate } from '../utils/index.js';

// State management
let staffData = [];
let standardsData = [];
let groupsData = [];
let assignmentsData = [];
let filteredStaff = [];
let filteredStandards = [];
let currentFilter = {};

/**
 * Initialize the Achievements page
 * @param {HTMLElement} container - Container element for the page
 */
export function init(container) {
    Logger.log('Initializing Achievements page');
    
    // Load data
    staffData = Storage.load('staff', []);
    standardsData = Storage.load('standards', []);
    groupsData = Storage.load('groups', []);
    assignmentsData = Storage.load('assignments', []);
    
    // Initially, show all staff and standards
    filteredStaff = [...staffData];
    filteredStandards = [...standardsData];
    
    // Create page structure
    container.innerHTML = `
        <div class="achievements-page content-container">
            <h1>Standard Achievements</h1>
            
            <div id="filter-section" class="filter-section mb-1">
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
                    <div class="filter-row standards-row">
                        <div class="filter-group standards-group">
                            <h4>Standards</h4>
                            <div id="standards-filters" class="filter-row"></div>
                        </div>
                    </div>
                </div>
                <div class="filter-actions mt-1">
                    <button id="clear-filters" class="button button-secondary">Clear All Filters</button>
                </div>
            </div>
            
            <div class="assignments-actions mb-1">
                <button id="save-assignments" class="button">Save Changes</button>
                <button id="bulk-assign" class="button button-secondary">Bulk Assign</button>
            </div>
            
            <div id="assignments-container">
                <div class="table-scroll-container">
                    <table id="assignments-table" class="table">
                        <thead>
                            <tr id="table-header-groups">
                                <th rowspan="2" style="width: 180px; min-width: 180px; max-width: 180px;">Staff</th>
                                <!-- Standard group headers will be added dynamically -->
                            </tr>
                            <tr id="table-header-standards">
                                <!-- Standard headers will be added dynamically -->
                            </tr>
                        </thead>
                        <tbody id="table-body"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    // Ensure the filter styles are loaded
    loadFilterStyles();
    
    // Add page-specific styles
    addAssignmentStyles();
    
    // Render filter controls
    renderFilterControls();
    
    // Render the assignments table with filtered data
    renderAssignmentsTable();
    
    // Add event listeners
    setupEventListeners();
}

/**
 * Load filter styles
 */
function loadFilterStyles() {
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
 * Add special styles for the assignments table
 */
function addAssignmentStyles() {
    // Add a style element if needed for the table scrolling
    if (!document.getElementById('assignments-table-styles')) {
        const style = document.createElement('style');
        style.id = 'assignments-table-styles';
        style.textContent = `
            .content-container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 0 15px;
            }
            .achievements-page h1 {
                margin-bottom: 1.5rem;
            }
            .table-scroll-container {
                overflow-x: auto;
                max-width: 100%;
                border: 1px solid #ddd;
                border-radius: 4px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            }
            #assignments-container {
                width: 100%;
                margin: 1rem 0;
            }
            #assignments-table {
                table-layout: fixed;
                border-collapse: collapse;
                width: 100%;
            }
            #assignments-table th:first-child,
            #assignments-table td:first-child {
                position: sticky;
                left: 0;
                background-color: #f2f2f2;
                z-index: 10;
                box-shadow: 2px 0 5px rgba(0,0,0,0.1);
                width: 180px;
                min-width: 180px;
                max-width: 180px;
            }
            .standard-header {
                width: 36px;
                min-width: 36px;
                max-width: 36px;
                text-align: center;
                padding: 3px 0;
            }
            .standard-header-group {
                border-bottom: 3px solid;
                text-align: center;
                font-weight: bold;
                padding: 8px 2px;
                font-size: 0.95em;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                position: relative;
                cursor: default;
            }
            .standard-name {
                writing-mode: vertical-lr;
                transform: rotate(180deg);
                height: 90px;
                padding: 6px 0;
                text-align: left;
                font-size: 0.8em;
                overflow: hidden;
                text-overflow: ellipsis;
                max-height: 90px;
                white-space: nowrap;
            }
            .assignment-cell {
                text-align: center;
                padding: 2px;
                border: 1px solid #e0e0e0;
            }
            .assignment-checkbox {
                width: 16px;
                height: 16px;
                cursor: pointer;
                margin: 0;
            }
            .assignment-checkbox:checked {
                accent-color: #2ecc71;
            }
            /* Group background colors will be applied dynamically */
            .group-colored {
                background-color: rgba(var(--group-color-rgb), 0.1);
            }
            .staff-cell {
                padding: 6px 8px;
            }
            .staff-details {
                font-size: 0.85em;
                color: #666;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .staff-name {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                display: block;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Render the filter controls
 */
function renderFilterControls() {
    const staffFilters = document.getElementById('staff-filters');
    const classificationFilters = document.getElementById('classification-filters');
    const standardsFilters = document.getElementById('standards-filters');
    
    if (!staffFilters || !classificationFilters || !standardsFilters) {
        console.error('Filter containers not found');
        return;
    }
    
    // Get dynamic filters based on custom classifications
    const filterGroups = buildDynamicFilters();
    
    // Render staff filters
    renderFilterGroup(filterGroups.staff, staffFilters);
    
    // Render classification filters
    renderFilterGroup(filterGroups.classification, classificationFilters);
    
    // Render standards filters
    renderFilterGroup([{ id: 'standards', name: 'Filter:', type: 'text' }], standardsFilters, true);
    
    // Add event listeners for the clear filters button
    document.getElementById('clear-filters').addEventListener('click', clearFilters);
    
    Logger.log('Standard Achievements filter system initialized with custom classifications');
}

/**
 * Build dynamic filters based on current columns and custom classifications
 * @returns {Object} - Dynamic filters configuration
 */
function buildDynamicFilters() {
    // Basic staff filters
    const staffFilters = [
        { id: 'name', name: 'Name', type: 'text' },
        { id: 'id', name: 'ID', type: 'text' }
    ];
    
    // Default classification filters
    const defaultClassifications = [
        { id: 'phase', name: 'Phase', type: 'dropdown', options: Models.Staff.phaseOptions },
        { id: 'overseas_thai', name: 'Overseas/Thai', type: 'dropdown', options: Models.Staff.overseasThaiOptions },
        { id: 'year_group', name: 'Year Group', type: 'dropdown', options: Models.Staff.yearGroupOptions },
        { id: 'department', name: 'Department', type: 'dropdown', options: Models.Staff.departmentOptions }
    ];
    
    // Load any custom classifications
    const customClassifications = Storage.load('custom_classifications', []);
    Logger.log(`Loaded ${customClassifications.length} custom classifications for filter system`);
    
    // Map custom classifications to filter format
    const customClassificationFilters = customClassifications.map(cc => ({
        id: cc.id,
        name: cc.name,
        type: 'dropdown',
        options: cc.options || []
    }));
    
    // Combine default and custom classifications
    // Using a Set to store unique IDs to avoid duplicate filters
    const uniqueIds = new Set();
    const allClassifications = [];
    
    // Add default classifications if they have options
    defaultClassifications.forEach(cls => {
        if (Array.isArray(cls.options) && cls.options.length > 0) {
            uniqueIds.add(cls.id);
            allClassifications.push(cls);
        }
    });
    
    // Add custom classifications if they don't conflict with defaults
    customClassificationFilters.forEach(cls => {
        if (!uniqueIds.has(cls.id) && Array.isArray(cls.options) && cls.options.length > 0) {
            uniqueIds.add(cls.id);
            allClassifications.push(cls);
            Logger.log(`Added custom classification to filters: ${cls.name} (${cls.id})`);
        }
    });
    
    return {
        staff: staffFilters,
        classification: allClassifications
    };
}

/**
 * Render the assignments table
 */
function renderAssignmentsTable() {
    renderTableHeader();
    renderTableBody();
}

/**
 * Render the table header with standard columns
 */
function renderTableHeader() {
    const groupHeaderRow = document.getElementById('table-header-groups');
    const standardHeaderRow = document.getElementById('table-header-standards');
    
    // Keep only the first cell in the group header row (staff column is already there with rowspan=2)
    while (groupHeaderRow.children.length > 1) {
        groupHeaderRow.removeChild(groupHeaderRow.lastChild);
    }
    
    // Clear the standard header row
    while (standardHeaderRow.children.length > 0) {
        standardHeaderRow.removeChild(standardHeaderRow.lastChild);
    }
    
    // Sort standards by group and then by code
    const sortedStandards = [...filteredStandards].sort((a, b) => {
        // First sort by group
        if (a.group !== b.group) {
            // Null groups come last
            if (a.group === null) return 1;
            if (b.group === null) return -1;
            return a.group.localeCompare(b.group);
        }
        // Then sort by code within same group
        return a.code.localeCompare(b.code);
    });
    
    // Create header cells for each standard
    let currentGroup = null;
    let groupHeaderCell = null;
    let groupWidth = 0;
    let groupColorRgb = null;
    
    sortedStandards.forEach((standard, index) => {
        // Check if we're starting a new group
        if (standard.group !== currentGroup) {
            // If we were in a group, set the colspan of the group header
            if (groupHeaderCell && groupWidth > 0) {
                groupHeaderCell.colSpan = groupWidth;
            }
            
            // Start new group
            currentGroup = standard.group;
            groupWidth = 1;
            groupColorRgb = null;
            
            if (currentGroup) {
                // Create group header
                groupHeaderCell = document.createElement('th');
                groupHeaderCell.textContent = currentGroup;
                groupHeaderCell.className = 'standard-header-group';
                groupHeaderCell.title = currentGroup;
                
                // Set color if group exists in groupsData
                const group = groupsData.find(g => g.name === currentGroup);
                if (group && group.color) {
                    // Convert hex to rgb for background opacity
                    const hex = group.color.replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);
                    groupColorRgb = `${r}, ${g}, ${b}`;
                    
                    groupHeaderCell.style.borderBottomColor = group.color;
                    groupHeaderCell.style.setProperty('--group-color-rgb', groupColorRgb);
                    groupHeaderCell.classList.add('group-colored');
                }
                
                // Add to group header row (will adjust colspan later)
                groupHeaderRow.appendChild(groupHeaderCell);
            } else {
                // No group, reset groupHeaderCell
                groupHeaderCell = null;
            }
        } else if (currentGroup) {
            // Continue current group
            groupWidth++;
        }
        
        // Create standard header cell in the standard header row
        const th = document.createElement('th');
        th.className = 'standard-header';
        th.innerHTML = `<div class="standard-name" title="${standard.name}">${standard.code}</div>`;
        th.dataset.code = standard.code;
        
        // Add group coloring if applicable
        if (groupColorRgb) {
            th.style.setProperty('--group-color-rgb', groupColorRgb);
            th.classList.add('group-colored');
        }
        
        standardHeaderRow.appendChild(th);
    });
    
    // Adjust colspan for the last group if needed
    if (groupHeaderCell && groupWidth > 0) {
        groupHeaderCell.colSpan = groupWidth;
    }
}

/**
 * Render the table body with staff rows and achievement checkboxes
 */
function renderTableBody() {
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';  // Clear existing content
    
    // Sort staff by name
    const sortedStaff = [...filteredStaff].sort((a, b) => a.name.localeCompare(b.name));
    
    // Sort standards by group and then by code (same as header)
    const sortedStandards = [...filteredStandards].sort((a, b) => {
        // First sort by group
        if (a.group !== b.group) {
            // Null groups come last
            if (a.group === null) return 1;
            if (b.group === null) return -1;
            return a.group.localeCompare(b.group);
        }
        // Then sort by code within same group
        return a.code.localeCompare(b.code);
    });
    
    // Map of group names to their RGB color values
    const groupColorMap = {};
    groupsData.forEach(group => {
        if (group && group.color) {
            const hex = group.color.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            groupColorMap[group.name] = `${r}, ${g}, ${b}`;
        }
    });
    
    sortedStaff.forEach(staff => {
        const row = document.createElement('tr');
        
        // Create cell for staff information
        const staffCell = document.createElement('td');
        staffCell.className = 'staff-cell';
        const staffName = staff.name;
        const staffDetails = `${staff.department || ''} ${staff.year_group ? '| ' + staff.year_group : ''}`;
        staffCell.innerHTML = `
            <strong class="staff-name" title="${staffName}">${staffName}</strong>
            <div class="staff-details" title="${staffDetails}">${staffDetails}</div>
        `;
        row.appendChild(staffCell);
        
        // Add a cell for each standard
        sortedStandards.forEach(standard => {
            const cell = document.createElement('td');
            cell.className = 'assignment-cell';
            cell.dataset.staffId = staff.id;
            cell.dataset.standardCode = standard.code;
            
            // Add group coloring if applicable
            if (standard.group && groupColorMap[standard.group]) {
                cell.style.setProperty('--group-color-rgb', groupColorMap[standard.group]);
                cell.classList.add('group-colored');
            }
            
            // Check if assignment exists
            const assignment = assignmentsData.find(a => 
                a.staff_id === staff.id && a.standard_code === standard.code
            );
            
            const achieved = assignment ? assignment.achieved : false;
            
            cell.innerHTML = `
                <input type="checkbox" class="assignment-checkbox" 
                       ${achieved ? 'checked' : ''} 
                       data-staff-id="${staff.id}" 
                       data-standard-code="${standard.code}">
            `;
            
            row.appendChild(cell);
        });
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners to checkboxes
    document.querySelectorAll('.assignment-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleAssignmentChange);
    });
}

/**
 * Handle change in assignment checkbox
 * @param {Event} event - Change event
 */
function handleAssignmentChange(event) {
    const checkbox = event.target;
    const staffId = checkbox.dataset.staffId;
    const standardCode = checkbox.dataset.standardCode;
    const achieved = checkbox.checked;
    
    Logger.log(`Assignment changed: Staff ${staffId}, Standard ${standardCode}, Achieved: ${achieved}`);
    
    // Update or create assignment in memory
    const existingIndex = assignmentsData.findIndex(a => 
        a.staff_id === staffId && a.standard_code === standardCode
    );
    
    if (existingIndex !== -1) {
        // Update existing assignment
        assignmentsData[existingIndex].achieved = achieved;
        assignmentsData[existingIndex].date_achieved = achieved ? new Date().toISOString() : null;
    } else {
        // Create new assignment
        assignmentsData.push({
            staff_id: staffId,
            standard_code: standardCode,
            achieved: achieved,
            date_achieved: achieved ? new Date().toISOString() : null
        });
    }
    
    // Note: We don't save to storage here; that happens when the user clicks "Save Changes"
}

/**
 * Save assignment changes to storage
 */
function saveAssignments() {
    Storage.save('assignments', assignmentsData);
    Logger.log('Saved assignment changes');
    alert('Assignments saved successfully!');
}

/**
 * Apply filters to staff data and standards columns
 */
function applyFilters() {
    // Get additional filter values from inputs that don't have tags yet
    document.querySelectorAll('#filter-section select').forEach(select => {
        if (select.value) {
            const field = select.dataset.field;
            const value = select.value;
            const mode = document.querySelector(`input[name="filter-mode-${field}"]:checked`).value;
            
            // Create field array if it doesn't exist
            if (!currentFilter[field]) {
                currentFilter[field] = [];
            }
            
            // Check if this value is already in permanent filters
            const valueExists = currentFilter[field].some(filter => 
                !filter.temporary && filter.value === value.toLowerCase());
            
            // Only add if not already in permanent filters
            if (!valueExists) {
                // Add as temporary filter (without ID since it's not a tag)
                currentFilter[field].push({
                    value: value.toLowerCase(),
                    mode: mode,
                    temporary: true
                });
            }
        }
    });
    
    document.querySelectorAll('#filter-section input[type="text"]').forEach(input => {
        if (input.value.trim()) {
            const field = input.dataset.field;
            const value = input.value.trim();
            const mode = document.querySelector(`input[name="filter-mode-${field}"]:checked`).value;
            
            // Create field array if it doesn't exist
            if (!currentFilter[field]) {
                currentFilter[field] = [];
            }
            
            // Check if this value is already in permanent filters
            const valueExists = currentFilter[field].some(filter => 
                !filter.temporary && filter.value === value.toLowerCase());
            
            // Only add if not already in permanent filters
            if (!valueExists) {
                // Add as temporary filter (without ID since it's not a tag)
                currentFilter[field].push({
                    value: value.toLowerCase(),
                    mode: mode,
                    temporary: true
                });
            }
        }
    });
    
    // Filter the staff rows based on staff-related filters
    const staffFilters = Object.entries(currentFilter).filter(([field]) => 
        field !== 'standards'
    );
    
    if (staffFilters.length > 0) {
        filteredStaff = staffData.filter(staff => {
            // Check each staff-related field's filter criteria
            for (const [field, filters] of staffFilters) {
                // Special handling for name filter
                if (field === 'name') {
                    for (const filter of filters) {
                        const matches = staff.name.toLowerCase().includes(filter.value);
                        if ((filter.mode === 'include' && !matches) || (filter.mode === 'exclude' && matches)) {
                            return false;
                        }
                    }
                    continue;
                }
                
                // Special handling for ID filter
                if (field === 'id') {
                    for (const filter of filters) {
                        const staffId = String(staff.id).toLowerCase();
                        const matches = staffId.includes(filter.value);
                        if ((filter.mode === 'include' && !matches) || (filter.mode === 'exclude' && matches)) {
                            return false;
                        }
                    }
                    continue;
                }
                
                // Regular field filters
                if (staff[field] !== undefined) {
                    for (const filter of filters) {
                        // For dropdown selections, do exact matching
                        const matches = staff[field].toLowerCase() === filter.value;
                        if ((filter.mode === 'include' && !matches) || (filter.mode === 'exclude' && matches)) {
                            return false;
                        }
                    }
                }
            }
            return true;
        });
    } else {
        // If no staff filters, show all staff
        filteredStaff = [...staffData];
    }
    
    // Filter the standard columns based on standards filters
    if (currentFilter.standards && currentFilter.standards.length > 0) {
        filteredStandards = standardsData.filter(standard => {
            for (const filter of currentFilter.standards) {
                // Check standard code (exact or partial match)
                const codeMatch = standard.code.toLowerCase().includes(filter.value);
                
                // Check standard name
                const nameMatch = standard.name.toLowerCase().includes(filter.value);
                
                // Check standard description (if exists)
                const descMatch = standard.description && standard.description.toLowerCase().includes(filter.value);
                
                // Check standard group
                const groupMatch = standard.group && standard.group.toLowerCase().includes(filter.value);
                
                const matches = codeMatch || nameMatch || descMatch || groupMatch;
                
                if ((filter.mode === 'include' && !matches) || (filter.mode === 'exclude' && matches)) {
                    return false;
                }
            }
            return true;
        });
    } else {
        // If no standards filters, show all standards
        filteredStandards = [...standardsData];
    }
    
    // Remove temporary filters after applying
    for (const field in currentFilter) {
        if (Array.isArray(currentFilter[field])) {
            currentFilter[field] = currentFilter[field].filter(filter => !filter.temporary);
            if (currentFilter[field].length === 0) {
                delete currentFilter[field];
            }
        }
    }
    
    // Re-render table header (for standards columns) and body (for filtered staff)
    renderTableHeader();
    renderTableBody();
    
    Logger.log(`Applied filters: ${JSON.stringify(currentFilter)}`);
}

/**
 * Clear all filters
 */
function clearFilters() {
    // Reset filter inputs
    document.querySelectorAll('#filter-section select').forEach(select => {
        select.value = '';
    });
    
    document.querySelectorAll('#filter-section input[type="text"]').forEach(input => {
        input.value = '';
    });
    
    // Clear filter tags
    document.querySelectorAll('.filter-tags').forEach(container => {
        container.innerHTML = '';
    });
    
    // Reset filter state
    currentFilter = {};
    
    // Reset filtered data
    filteredStaff = [...staffData];
    filteredStandards = [...standardsData];
    
    // Re-render table
    renderTableHeader();
    renderTableBody();
    
    Logger.log('Cleared all filters');
}

/**
 * Clear filters for a specific field
 * @param {string} field - The field to clear filters for
 */
function clearSingleFilter(field) {
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
    if (currentFilter[field]) {
        delete currentFilter[field];
    }
    
    // Apply filters to update the table
    applyFilters();
    
    Logger.log(`Cleared filters for field: ${field}`);
}

/**
 * Show modal for bulk assignment
 */
function showBulkAssignModal() {
    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-header">
            <h2>Bulk Assign Achievements</h2>
            <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
            <p>Select the standards to assign and the staff to assign them to.</p>
            
            <div class="form-group">
                <label>Standards:</label>
                <div class="checkbox-list">
                    ${filteredStandards.map(standard => `
                        <div class="checkbox-item">
                            <input type="checkbox" id="std-${standard.code}" class="bulk-standard-checkbox" data-code="${standard.code}">
                            <label for="std-${standard.code}">${standard.code}: ${standard.name}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="form-group">
                <label>Staff:</label>
                <div class="checkbox-list">
                    ${filteredStaff.map(staff => `
                        <div class="checkbox-item">
                            <input type="checkbox" id="staff-${staff.id}" class="bulk-staff-checkbox" data-id="${staff.id}">
                            <label for="staff-${staff.id}">${staff.name}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="form-group">
                <label>Achievement Status:</label>
                <div class="radio-group">
                    <label>
                        <input type="radio" name="bulk-status" value="true" checked> Achieved
                    </label>
                    <label>
                        <input type="radio" name="bulk-status" value="false"> Not Achieved
                    </label>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="button" id="cancel-bulk" class="button button-secondary">Cancel</button>
                <button type="button" id="apply-bulk" class="button">Apply</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add styles for the modal
    if (!document.getElementById('bulk-assign-styles')) {
        const style = document.createElement('style');
        style.id = 'bulk-assign-styles';
        style.textContent = `
            .checkbox-list {
                max-height: 200px;
                overflow-y: auto;
                border: 1px solid #ddd;
                padding: 0.5rem;
                margin-top: 0.5rem;
            }
            .checkbox-item {
                margin-bottom: 0.5rem;
            }
            .radio-group {
                display: flex;
                gap: 1rem;
                margin-top: 0.5rem;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add event listeners for modal actions
    modal.querySelector('.modal-close').addEventListener('click', () => {
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
    });
    
    modal.querySelector('#cancel-bulk').addEventListener('click', () => {
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
    });
    
    modal.querySelector('#apply-bulk').addEventListener('click', () => {
        // Get selected standards
        const selectedStandards = Array.from(modal.querySelectorAll('.bulk-standard-checkbox:checked'))
            .map(checkbox => checkbox.dataset.code);
            
        // Get selected staff
        const selectedStaff = Array.from(modal.querySelectorAll('.bulk-staff-checkbox:checked'))
            .map(checkbox => checkbox.dataset.id);
            
        // Get assignment status
        const achieved = modal.querySelector('input[name="bulk-status"]:checked').value === 'true';
        
        // Validate selections
        if (selectedStandards.length === 0) {
            alert('Please select at least one standard');
            return;
        }
        
        if (selectedStaff.length === 0) {
            alert('Please select at least one staff member');
            return;
        }
        
        // Create/update assignments
        let updatedCount = 0;
        
        selectedStaff.forEach(staffId => {
            selectedStandards.forEach(standardCode => {
                // Check if assignment already exists
                const existingIndex = assignmentsData.findIndex(a => 
                    a.staff_id === staffId && a.standard_code === standardCode
                );
                
                if (existingIndex !== -1) {
                    // Update existing assignment
                    assignmentsData[existingIndex].achieved = achieved;
                    assignmentsData[existingIndex].date_achieved = achieved ? new Date().toISOString() : null;
                } else {
                    // Create new assignment
                    assignmentsData.push({
                        staff_id: staffId,
                        standard_code: standardCode,
                        achieved: achieved,
                        date_achieved: achieved ? new Date().toISOString() : null
                    });
                }
                
                updatedCount++;
            });
        });
        
        // Close modal
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
        
        // Update table to reflect changes
        renderTableBody();
        
        Logger.log(`Bulk assigned ${updatedCount} standards`);
        alert(`Updated ${updatedCount} assignments. Remember to click "Save Changes" to save these updates.`);
    });
}

/**
 * Handle keydown event for filter input
 * @param {KeyboardEvent} event - Keydown event
 */
function handleFilterKeydown(event) {
    // If the Enter key is pressed
    if (event.key === 'Enter' && event.target.value.trim()) {
        const field = event.target.dataset.field;
        const value = event.target.value.trim();
        const mode = document.querySelector(`input[name="filter-mode-${field}"]:checked`).value;
        
        addFilterTag(field, value, mode);
        
        // Clear the input
        event.target.value = '';
        
        // Prevent form submission if inside a form
        event.preventDefault();
    }
}

/**
 * Handle change event for filter select
 * @param {Event} event - Change event
 */
function handleFilterChange(event) {
    if (event.target.value) {
        const field = event.target.dataset.field;
        const value = event.target.value;
        const mode = document.querySelector(`input[name="filter-mode-${field}"]:checked`).value;
        
        addFilterTag(field, value, mode);
        
        // Reset the select to empty
        event.target.value = '';
    }
}

/**
 * Add a filter tag for a field
 * @param {string} field - Field name
 * @param {string} value - Filter value
 * @param {string} mode - Filter mode (include/exclude)
 */
function addFilterTag(field, value, mode) {
    const tagContainer = document.getElementById(`filter-tags-${field}`);
    
    // Don't add duplicate tags
    const isDuplicate = currentFilter[field]?.some(filter => 
        filter.value === value.toLowerCase() && !filter.temporary);
    
    if (isDuplicate) {
        return;
    }
    
    // Create unique ID for this tag
    const tagId = `tag-${field}-${Date.now()}`;
    
    // Create filter tag element
    const tag = document.createElement('div');
    tag.className = `filter-tag ${mode}`;
    tag.id = tagId;
    tag.innerHTML = `
        <span>${value}</span>
        <span class="filter-tag-remove" title="Remove">×</span>
    `;
    
    // Add removal event
    tag.querySelector('.filter-tag-remove').addEventListener('click', () => {
        removeFilterTag(tagId, field);
    });
    
    // Add to DOM
    tagContainer.appendChild(tag);
    
    // Update filter state
    if (!currentFilter[field]) {
        currentFilter[field] = [];
    }
    
    // Add to filter criteria
    currentFilter[field].push({
        id: tagId,
        value: value.toLowerCase(),
        mode: mode
    });
    
    // Apply filters
    applyFilters();
}

/**
 * Remove a filter tag
 * @param {string} tagId - Tag ID
 * @param {string} field - Field name
 */
function removeFilterTag(tagId, field) {
    // Remove from DOM
    const tag = document.getElementById(tagId);
    if (tag) {
        tag.remove();
    }
    
    // Remove from filter state
    if (currentFilter[field]) {
        currentFilter[field] = currentFilter[field].filter(filter => filter.id !== tagId);
        
        // Clean up empty filter arrays
        if (currentFilter[field].length === 0) {
            delete currentFilter[field];
        }
    }
    
    // Apply filters
    applyFilters();
}

/**
 * Setup all event listeners for the page
 */
function setupEventListeners() {
    document.getElementById('clear-filters').addEventListener('click', clearFilters);
    document.getElementById('save-assignments').addEventListener('click', saveAssignments);
    document.getElementById('bulk-assign').addEventListener('click', showBulkAssignModal);
}

/**
 * Render a group of filters
 * @param {Array} filters - Array of filter configurations
 * @param {HTMLElement} container - Container to render filters into
 * @param {boolean} isStandards - Whether this is the standards filter group
 */
function renderFilterGroup(filters, container, isStandards = false) {
    if (!Array.isArray(filters) || !container) {
        console.error('Invalid filters or container');
        return;
    }
    
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
        input.addEventListener('keydown', handleFilterKeydown);
    });
    
    // Add change event listeners for dropdowns to add tags
    container.querySelectorAll('.filter-select').forEach(select => {
        select.addEventListener('change', handleFilterChange);
    });
    
    // Add click event listeners for enter filter buttons
    container.querySelectorAll('.enter-filter-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const field = event.target.dataset.field;
            const input = document.getElementById(`filter-${field}`);
            
            if (input && input.value && input.value.trim() !== '') {
                const value = input.value.trim();
                const mode = document.querySelector(`input[name="filter-mode-${field}"]:checked`).value;
                
                addFilterTag(field, value, mode);
                input.value = '';
            }
        });
    });
    
    // Add click event listeners for clear filter buttons
    container.querySelectorAll('.filter-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const field = event.target.dataset.field;
            clearSingleFilter(field);
        });
    });
    
    // Add event listeners for include/exclude toggle and input fields
    container.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => applyFilters());
    });
    
    container.querySelectorAll('select, input[type="text"]').forEach(element => {
        element.addEventListener('input', applyFilters);
    });
} 