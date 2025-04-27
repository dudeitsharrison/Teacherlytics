/**
 * Masterlog Page
 * Core functionality for managing staff profiles
 */
import { Storage, Logger, Models, Validate, FilterSystem } from '../utils/index.js';

// Column definitions
const columns = [
    { id: 'name', name: 'Name', type: 'text', width: '20%', visible: true, sortable: true, isCore: true },
    { id: 'id', name: 'ID', type: 'text', width: '10%', visible: true, sortable: true, isCore: true },
    { id: 'phase', name: 'Phase', type: 'dropdown', width: '15%', options: Models.Staff.phaseOptions, visible: true, sortable: true },
    { id: 'overseas_thai', name: 'Overseas/Thai', type: 'dropdown', width: '15%', options: Models.Staff.overseasThaiOptions, visible: true, sortable: true },
    { id: 'year_group', name: 'Year Group', type: 'dropdown', width: '15%', options: Models.Staff.yearGroupOptions, visible: true, sortable: true },
    { id: 'department', name: 'Department', type: 'dropdown', width: '15%', options: Models.Staff.departmentOptions, visible: true, sortable: true },
    { id: 'actions', name: 'Actions', type: 'actions', width: '10%', visible: true, sortable: false, isCore: true }
];

// State management
let staffData = [];
let filteredData = [];
let filterState = {};
let currentPage = 1;
let rowsPerPage = 10;
let editingCell = null;
let sortColumn = null;
let sortDirection = 'asc';
let filterSystem = null; // Store reference to FilterSystem instance

// State management for custom classifications
let customClassifications = [];

// Load column settings
function loadColumnSettings() {
    const savedColumns = Storage.load('masterlog_columns', null);
    if (savedColumns) {
        // Apply saved settings to columns
        savedColumns.forEach(savedCol => {
            const col = columns.find(c => c.id === savedCol.id);
            if (col) {
                col.visible = savedCol.visible;
                col.width = savedCol.width;
            }
        });
    }
}

/**
 * Initialize the Masterlog page
 * @param {HTMLElement} container - Container element for the page
 */
export function init(container) {
    Logger.log('Initializing Masterlog page');
    
    // Load column settings
    loadColumnSettings();
    
    // Load custom classifications
    loadCustomClassifications();
    
    // Load staff data
    staffData = Storage.load('staff', []);
    filteredData = [...staffData];
    
    // Create page structure
    container.innerHTML = `
        <h1>Staff Masterlog</h1>
        <div class="masterlog-controls mb-1">
            <button id="add-staff" class="button">Add Staff</button>
            <button id="bulk-add-staff" class="button">Bulk Add Staff</button>
            <button id="export-data" class="button button-secondary">Export</button>
            <button id="manage-columns" class="button button-secondary">Manage Columns</button>
        </div>
        
        <!-- Filter section container -->
        <div id="filter-section" class="filter-section mb-1"></div>
        
        <div id="table-container">
            <table id="staff-table" class="table">
                <thead>
                    <tr id="table-header"></tr>
                </thead>
                <tbody id="table-body"></tbody>
            </table>
        </div>
        
        <div id="pagination" class="pagination mt-1"></div>
    `;
    
    // Add styles for table selection
    const style = document.createElement('style');
    style.id = 'table-selection-styles';
    style.textContent = `
        #staff-table td.selected {
            background-color: rgba(33, 150, 243, 0.2);
        }
        #context-menu {
            position: absolute;
            background: white;
            border: 1px solid #ccc;
            box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
            border-radius: 3px;
            z-index: 1000;
            padding: 5px 0;
        }
        .context-menu-item {
            padding: 8px 20px;
            cursor: pointer;
            font-size: 14px;
        }
        .context-menu-item:hover {
            background-color: #f0f0f0;
        }
        /* Custom classifications styles */
        .classification-header {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .add-classification-button {
            background: none;
            border: none;
            color: #2196f3;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 50%;
        }
        .add-classification-button:hover {
            background-color: #e3f2fd;
        }
    `;
    document.head.appendChild(style);
    
    // Initialize the filter system
    initializeFilterSystem();
    
    // Initialize other components
    renderTableHeader();
    renderTable();
    renderPagination();
    
    // Add event listeners
    document.getElementById('add-staff').addEventListener('click', handleAddStaff);
    document.getElementById('bulk-add-staff').addEventListener('click', handleBulkAddStaff);
    document.getElementById('export-data').addEventListener('click', handleExportData);
    document.getElementById('manage-columns').addEventListener('click', showColumnManager);
    
    // Handle clicks outside of editing cells and close all dropdowns
    document.addEventListener('click', handleGlobalClick);
    
    // Setup cell selection and context menu
    setupTableSelection();
}

/**
 * Initialize the FilterSystem with proper configuration
 */
function initializeFilterSystem() {
    // Get the filter section container
    const filterSection = document.getElementById('filter-section');
    
    // Clear existing filter content to prevent duplicates
    if (filterSection) {
        filterSection.innerHTML = '';
    }
    
    // Configure filter system with custom filters override
    // This completely bypasses the default FilterSystem classifications
    const customFilters = buildDynamicFilters();
    
    filterSystem = new FilterSystem({
        filterSection: filterSection,
        staffData: staffData,
        includeStandardsFilters: false,
        onFilterChange: handleFilterChange,
        customFilters: customFilters
    });
    
    // Add plus button to the Classification header
    const classificationHeader = filterSection.querySelector('.classification-group h4');
    if (classificationHeader) {
        // Create a wrapper div with className classification-header
        const headerWrapper = document.createElement('div');
        headerWrapper.className = 'classification-header';
        
        // Move the text content to the wrapper
        headerWrapper.textContent = classificationHeader.textContent;
        
        // Create the plus button
        const addButton = document.createElement('button');
        addButton.className = 'add-classification-button';
        addButton.textContent = '+';
        addButton.title = 'Add new classification';
        addButton.addEventListener('click', showAddClassificationModal);
        
        // Clear the header and append the wrapper and button
        classificationHeader.textContent = '';
        headerWrapper.appendChild(addButton);
        classificationHeader.appendChild(headerWrapper);
    }
    
    // Enforce grid layout for classification filters
    const classificationFilters = document.getElementById('classification-filters');
    if (classificationFilters) {
        classificationFilters.style.display = 'grid';
        
        // Count the number of visible classification filters
        const filterCount = classificationFilters.querySelectorAll('.filter-item').length;
        
        // Adjust grid column width based on number of items
        if (filterCount <= 2) {
            classificationFilters.style.gridTemplateColumns = 'repeat(2, 1fr)';
        } else if (filterCount <= 4) {
            classificationFilters.style.gridTemplateColumns = 'repeat(4, 1fr)';
        } else {
            classificationFilters.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))';
        }
        
        classificationFilters.style.gap = '8px';
        classificationFilters.style.width = '100%';
    }
}

/**
 * Build dynamic filters based on current columns
 * @returns {Object} - Dynamic filters configuration
 */
function buildDynamicFilters() {
    // Log column state for debugging
    Logger.log(`Building filters from ${columns.length} columns:`);
    columns.forEach(col => {
        Logger.log(` - ${col.name} (${col.id}): type=${col.type}, visible=${col.visible}, isCore=${col.isCore}, isCustom=${col.isCustom}`);
    });
    
    const staffFilters = [
        { id: 'name', name: 'Name', type: 'text' },
        { id: 'id', name: 'ID', type: 'text' }
    ];
    
    // Only use dropdown columns from our current columns array
    // This ensures removed columns don't show up in filters
    const classificationFilters = columns
        .filter(col => 
            col.type === 'dropdown' && 
            col.visible && 
            Array.isArray(col.options) && 
            col.options.length > 0
        )
        .map(col => ({
            id: col.id,
            name: col.name,
            type: 'dropdown',
            options: col.options
        }));
    
    Logger.log(`Created ${classificationFilters.length} classification filters:`);
    classificationFilters.forEach(f => Logger.log(` - ${f.name} (${f.id})`));
    
    return {
        staff: staffFilters,
        classification: classificationFilters
    };
}

/**
 * Handle filter changes from the FilterSystem
 * @param {Object} data - Filtered data from FilterSystem
 */
function handleFilterChange(data) {
    // FilterSystem now returns an object with filteredStaff property
    // Check if we got a data object or just an array
    if (data && data.filteredStaff) {
        // Using the filtered staff from the data object
        filteredData = Array.isArray(data.filteredStaff) ? [...data.filteredStaff] : [];
    } else {
        // Fallback for backward compatibility - data might be passed directly as an array
        filteredData = Array.isArray(data) ? [...data] : [];
    }
    
    // Reset to first page
    currentPage = 1;
    
    // Re-render table with filtered data
    renderTable();
    renderPagination();
}

/**
 * Setup table selection and context menu functionality
 */
function setupTableSelection() {
    const table = document.getElementById('staff-table');
    let isMouseDown = false;
    let selectedCells = [];
    
    // Mouse down event - start selection
    table.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only handle left clicks
        const cell = e.target.closest('td');
        if (!cell || cell.classList.contains('actions')) return;
        
        // Don't interfere with editing
        if (editingCell) return;
        
        // Start selection mode
        isMouseDown = true;
        
        // Clear previous selection unless Shift key is pressed
        if (!e.shiftKey) {
            selectedCells.forEach(cell => cell.classList.remove('selected'));
            selectedCells = [];
        }
        
        // Add this cell
        cell.classList.add('selected');
        if (!selectedCells.includes(cell)) {
            selectedCells.push(cell);
        }
        
        // Prevent default
        e.preventDefault();
    });
    
    // Mouse over - extend selection
    table.addEventListener('mouseover', (e) => {
        if (!isMouseDown) return;
        
        const cell = e.target.closest('td');
        if (!cell || cell.classList.contains('actions') || cell.classList.contains('selected')) return;
        
        // Add this cell to selection
        cell.classList.add('selected');
        if (!selectedCells.includes(cell)) {
            selectedCells.push(cell);
        }
    });
    
    // Mouse up - end selection
    document.addEventListener('mouseup', () => {
        isMouseDown = false;
    });
    
    // Context menu for selected cells
    table.addEventListener('contextmenu', (e) => {
        const cell = e.target.closest('td');
        if (!cell || cell.classList.contains('actions')) return;
        
        // If clicking on a non-selected cell, select it first
        if (!cell.classList.contains('selected')) {
            selectedCells.forEach(c => c.classList.remove('selected'));
            selectedCells = [cell];
            cell.classList.add('selected');
        }
        
        // Prevent default browser context menu
        e.preventDefault();
        
        // Remove any existing context menu
        const existingMenu = document.getElementById('context-menu');
        if (existingMenu) {
            document.body.removeChild(existingMenu);
        }
        
        // Create context menu
        const menu = document.createElement('div');
        menu.id = 'context-menu';
        
        // Menu items
        const items = [
            {
                label: `Copy ${selectedCells.length} cell${selectedCells.length !== 1 ? 's' : ''}`,
                action: () => {
                    copySelection();
                    showToast(`Copied ${selectedCells.length} cell${selectedCells.length !== 1 ? 's' : ''}`);
                }
            },
            {
                label: `Cut ${selectedCells.length} cell${selectedCells.length !== 1 ? 's' : ''}`,
                action: () => {
                    copySelection();
                    selectedCells.forEach(cell => {
                        // Save the edit for each cell
                        const column = cell.dataset.column;
                        const rowIndex = parseInt(cell.dataset.row, 10);
                        if (column && rowIndex >= 0) {
                            saveEdit(cell, column, rowIndex, '');
                        }
                    });
                    showToast(`Cut ${selectedCells.length} cell${selectedCells.length !== 1 ? 's' : ''}`);
                }
            },
            {
                label: 'Paste',
                action: () => {
                    // We can only use the Clipboard API to read in secure contexts
                    if (selectedCells.length === 1) {
                        // We'll need to start cell editing first
                        const cell = selectedCells[0];
                        const column = cell.dataset.column;
                        const rowIndex = parseInt(cell.dataset.row, 10);
                        
                        if (column && rowIndex >= 0) {
                            // Start editing the cell
                            handleCellClick({ target: cell });
                            
                            // Let the user know to press Ctrl+V
                            showToast('Press Ctrl+V to paste');
                        }
                    } else {
                        showToast('Select a single cell to paste');
                    }
                }
            },
            {
                label: `Delete ${selectedCells.length} cell${selectedCells.length !== 1 ? 's' : ''}`,
                action: () => {
                    selectedCells.forEach(cell => {
                        // Save the edit for each cell
                        const column = cell.dataset.column;
                        const rowIndex = parseInt(cell.dataset.row, 10);
                        if (column && rowIndex >= 0) {
                            saveEdit(cell, column, rowIndex, '');
                        }
                    });
                    showToast(`Deleted ${selectedCells.length} cell${selectedCells.length !== 1 ? 's' : ''}`);
                }
            },
            {
                label: 'Clear selection',
                action: () => {
                    selectedCells.forEach(cell => cell.classList.remove('selected'));
                    selectedCells = [];
                }
            }
        ];
        
        // Add items to menu
        items.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.textContent = item.label;
            
            // Click handler
            menuItem.addEventListener('click', () => {
                item.action();
                document.body.removeChild(menu);
            });
            
            menu.appendChild(menuItem);
        });
        
        // Add menu to document with initial position
        document.body.appendChild(menu);
        
        // Calculate optimal position to ensure menu is visible
        const menuRect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Start with the clicked position
        let left = e.pageX;
        let top = e.pageY;
        
        // Check right edge
        if (left + menuRect.width > viewportWidth - 10) {
            left = viewportWidth - menuRect.width - 10;
        }
        
        // Check bottom edge
        if (top + menuRect.height > viewportHeight - 10) {
            top = viewportHeight - menuRect.height - 10;
        }
        
        // Ensure not positioned too far left or top
        left = Math.max(10, left);
        top = Math.max(10, top);
        
        // Apply calculated position
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        
        // Close menu when clicking outside
        document.addEventListener('mousedown', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                if (document.body.contains(menu)) {
                    document.body.removeChild(menu);
                }
                document.removeEventListener('mousedown', closeMenu);
            }
        });
    });
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Only process if we have selected cells
        if (selectedCells.length === 0) return;
        
        // Skip if we're editing
        if (editingCell) return;
        
        // Ctrl+C (Copy)
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            copySelection();
            showToast(`Copied ${selectedCells.length} cell${selectedCells.length !== 1 ? 's' : ''}`);
            e.preventDefault();
        }
        // Ctrl+X (Cut)
        else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
            copySelection();
            selectedCells.forEach(cell => {
                const column = cell.dataset.column;
                const rowIndex = parseInt(cell.dataset.row, 10);
                if (column && rowIndex >= 0) {
                    saveEdit(cell, column, rowIndex, '');
                }
            });
            showToast(`Cut ${selectedCells.length} cell${selectedCells.length !== 1 ? 's' : ''}`);
            e.preventDefault();
        }
        // Delete/Backspace (Clear)
        else if (e.key === 'Delete' || e.key === 'Backspace') {
            selectedCells.forEach(cell => {
                const column = cell.dataset.column;
                const rowIndex = parseInt(cell.dataset.row, 10);
                if (column && rowIndex >= 0) {
                    saveEdit(cell, column, rowIndex, '');
                }
            });
            showToast(`Cleared ${selectedCells.length} cell${selectedCells.length !== 1 ? 's' : ''}`);
            e.preventDefault();
        }
    });
}

/**
 * Load saved model options from storage
 */
function loadModelOptions() {
    const savedOptions = Storage.load('model_options', null);
    if (savedOptions) {
        // Update Models with saved options
        if (savedOptions.phaseOptions) {
            Models.Staff.phaseOptions = savedOptions.phaseOptions;
            updateColumnOptions('phase', savedOptions.phaseOptions);
        }
        
        if (savedOptions.overseasThaiOptions) {
            Models.Staff.overseasThaiOptions = savedOptions.overseasThaiOptions;
            updateColumnOptions('overseas_thai', savedOptions.overseasThaiOptions);
        }
        
        if (savedOptions.yearGroupOptions) {
            Models.Staff.yearGroupOptions = savedOptions.yearGroupOptions;
            updateColumnOptions('year_group', savedOptions.yearGroupOptions);
        }
        
        if (savedOptions.departmentOptions) {
            Models.Staff.departmentOptions = savedOptions.departmentOptions;
            updateColumnOptions('department', savedOptions.departmentOptions);
        }
    }
}

/**
 * Update column options based on model changes
 * @param {string} columnId - Column ID to update
 * @param {Array<string>} options - New options array
 */
function updateColumnOptions(columnId, options) {
    const column = columns.find(col => col.id === columnId);
    if (column) {
        column.options = options;
    }
}

/**
 * Save model options to storage
 */
function saveModelOptions() {
    // Save all model options together
    const modelOptions = {
        phaseOptions: Models.Staff.phaseOptions,
        overseasThaiOptions: Models.Staff.overseasThaiOptions,
        yearGroupOptions: Models.Staff.yearGroupOptions,
        departmentOptions: Models.Staff.departmentOptions
    };
    
    Storage.save('model_options', modelOptions);
    Logger.log('Saved model options');
}

/**
 * Handle global click events to close dropdowns and editing cells
 * @param {Event} event - Click event
 */
function handleGlobalClick(event) {
    // Handle clicking outside of dropdown menus
    const dropdowns = document.querySelectorAll('.filter-dropdown-content.show');
    if (dropdowns.length > 0) {
        const clickedInsideDropdown = Array.from(dropdowns).some(dropdown => {
            // Check if click was inside the dropdown or on its toggle
            return dropdown.contains(event.target) || 
                dropdown.previousElementSibling && dropdown.previousElementSibling.contains(event.target);
        });
        
        if (!clickedInsideDropdown) {
            // Close all dropdowns
            dropdowns.forEach(dropdown => dropdown.classList.remove('show'));
        }
    }
    
    // Handle clicking outside editing cell
    if (editingCell) {
        // Check if editingCell is DOM element or object based on form
        const clickedInsideEditor = editingCell.cell 
            ? editingCell.cell.contains(event.target) 
            : false;
            
        if (!clickedInsideEditor) {
            // If input has a value, save it
            if (editingCell.cell) {
                const input = editingCell.cell.querySelector('input, select');
                if (input && input.value !== undefined) {
                    saveEdit(editingCell.cell, editingCell.column, editingCell.rowIndex, input.value);
                } else {
                    cancelEdit();
                }
            } else {
                cancelEdit();
            }
        }
    }
}

/**
 * Render the table header with column names and sort indicators
 */
function renderTableHeader() {
    const tableHeader = document.getElementById('table-header');
    tableHeader.innerHTML = '';
    
    // Add header cells for visible columns
    columns.filter(column => column.visible).forEach(column => {
        const headerCell = document.createElement('th');
        headerCell.dataset.column = column.id;
        headerCell.style.width = column.width;
        
        // For sortable columns, add sort indicators and click behavior
        if (column.sortable) {
            headerCell.className = 'sortable';
            headerCell.innerHTML = `
                <div class="header-content">
                    <span>${column.name}</span>
                    <span class="sort-indicator"></span>
                </div>
            `;
            
            // Add sort indicator if this column is sorted
            if (sortColumn === column.id) {
                headerCell.querySelector('.sort-indicator').textContent = 
                    sortDirection === 'asc' ? '▲' : '▼';
                headerCell.classList.add(sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
            }
            
            // Add click handler for sorting
            headerCell.addEventListener('click', () => handleSortColumn(column.id));
        } else {
            headerCell.textContent = column.name;
        }
        
        // For columns with settings, add gear icon
        if (column.type === 'dropdown') {
            const settingsIcon = document.createElement('span');
            settingsIcon.className = 'column-settings';
            settingsIcon.textContent = '⚙️';
            settingsIcon.title = 'Column Settings';
            settingsIcon.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent sort when clicking the gear
                showColumnSettings(column);
            });
            
            // Add to header cell
            if (headerCell.querySelector('.header-content')) {
                headerCell.querySelector('.header-content').appendChild(settingsIcon);
            } else {
                const headerContent = document.createElement('div');
                headerContent.className = 'header-content';
                headerContent.innerHTML = `<span>${column.name}</span>`;
                headerContent.appendChild(settingsIcon);
                headerCell.innerHTML = '';
                headerCell.appendChild(headerContent);
            }
        }
        
        tableHeader.appendChild(headerCell);
    });
}

/**
 * Handle column sort when header is clicked
 */
function handleSortColumn(columnId) {
    // Toggle sort direction if same column is clicked
    if (sortColumn === columnId) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = columnId;
        sortDirection = 'asc';
    }
    
    // Sort the data
    filteredData.sort((a, b) => {
        const aValue = a[columnId]?.toLowerCase() || '';
        const bValue = b[columnId]?.toLowerCase() || '';
        
        if (sortDirection === 'asc') {
            return aValue.localeCompare(bValue);
        } else {
            return bValue.localeCompare(aValue);
        }
    });
    
    // Render updated table
    renderTable();
    renderTableHeader();
}

/**
 * Render the filter controls above the table
 * @deprecated - Using FilterSystem instead
 */
function renderFilterControls() {
    // This function is no longer used since we're using the FilterSystem
    console.warn('renderFilterControls is deprecated, using FilterSystem instead');
}

/**
 * Render the staff table with current data
 */
function renderTable() {
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    
    // Calculate visible rows for current page
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, filteredData.length);
    const visibleData = filteredData.slice(startIndex, endIndex);
    
    // No data message
    if (visibleData.length === 0) {
        const noDataRow = document.createElement('tr');
        const noDataCell = document.createElement('td');
        noDataCell.colSpan = columns.filter(c => c.visible).length;
        noDataCell.className = 'no-data';
        noDataCell.textContent = 'No staff records found.';
        noDataRow.appendChild(noDataCell);
        tableBody.appendChild(noDataRow);
        return;
    }
    
    // Render data rows
    visibleData.forEach((staff, index) => {
        const row = document.createElement('tr');
        row.dataset.staffIndex = startIndex + index;
        
        // Add cells for each visible column
        columns.filter(column => column.visible).forEach(column => {
            const cell = document.createElement('td');
            cell.dataset.column = column.id;
            cell.dataset.row = startIndex + index;
            cell.dataset.type = column.type; // Set the data-type attribute for proper editing
            
            // Special rendering for action column
            if (column.type === 'actions') {
                cell.className = 'actions';
                cell.innerHTML = `
                    <button class="button-small edit-staff" title="Edit staff member">
                        <span class="icon">✏️</span>
                    </button>
                    <button class="button-small delete-staff" title="Delete staff member">
                        <span class="icon">🗑️</span>
                    </button>
                `;
                
                // Add event listeners for action buttons
                cell.querySelector('.edit-staff').addEventListener('click', handleEditStaff);
                cell.querySelector('.delete-staff').addEventListener('click', handleDeleteStaff);
            } else {
                // Standard cell - display the value
                cell.textContent = staff[column.id] || '';
                
                // For dropdown columns, add options as data attribute
                if (column.type === 'dropdown' && column.options) {
                    cell.dataset.options = JSON.stringify(column.options);
                }
                
                // Make cells editable (except actions)
                cell.addEventListener('click', handleCellClick);
            }
            
            row.appendChild(cell);
        });
        
        tableBody.appendChild(row);
    });
}

/**
 * Render pagination controls
 */
function renderPagination() {
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';
    
    if (filteredData.length === 0) {
        return;
    }
    
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.textContent = '←';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
            renderPagination();
        }
    });
    paginationContainer.appendChild(prevButton);
    
    // Page buttons
    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.classList.toggle('active', i === currentPage);
        pageButton.addEventListener('click', () => {
            currentPage = i;
            renderTable();
            renderPagination();
        });
        paginationContainer.appendChild(pageButton);
    }
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.textContent = '→';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
            renderPagination();
        }
    });
    paginationContainer.appendChild(nextButton);
}

/**
 * Handle cell click to make it editable
 * @param {Event} event - Click event
 */
function handleCellClick(event) {
    // If we're already editing a cell, close it first
    if (editingCell) {
        cancelEdit();
    }
    
    const cell = event.currentTarget;
    const column = cell.dataset.column;
    const rowIndex = parseInt(cell.dataset.row, 10);
    const type = cell.dataset.type;
    
    // Stop event propagation to prevent immediate closing
    event.stopPropagation();
    
    // Store reference to currently editing cell
    editingCell = {
        cell,
        column,
        rowIndex,
        originalValue: cell.textContent
    };
    
    if (type === 'text') {
        // Create text input
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'editable-cell-input';
        input.value = cell.textContent;
        
        // Clear cell and add input
        cell.textContent = '';
        cell.appendChild(input);
        
        // Focus input
        input.focus();
        
        // Handle input events
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                saveEdit(cell, column, rowIndex, input.value);
                e.preventDefault();
            } else if (e.key === 'Escape') {
                cancelEdit();
                e.preventDefault();
            }
        });
    } else if (type === 'dropdown') {
        // Get dropdown options and current value
        // First get from dataset for backward compatibility
        let options = [];
        try {
            options = JSON.parse(cell.dataset.options);
        } catch (e) {
            console.error('Error parsing cell options:', e);
        }
        
        // Ensure we have the latest options by getting from the column definition
        const columnDef = columns.find(col => col.id === column);
        if (columnDef && columnDef.type === 'dropdown' && columnDef.options) {
            options = columnDef.options;
        }
        
        const currentValue = cell.textContent.trim();
        
        // Split current value if it contains multiple selections
        const currentValues = currentValue ? currentValue.split(', ') : [];
        
        // Create multi-select dropdown
        const dropdownContainer = document.createElement('div');
        dropdownContainer.className = 'multi-dropdown-container';
        
        // Create options list (scrollable part)
        const optionsList = document.createElement('div');
        optionsList.className = 'dropdown-content-scroll multi-select';
        
        // Add options with checkboxes
        options.forEach(option => {
            const isSelected = currentValues.includes(option);
            
            const item = document.createElement('div');
            item.className = 'dropdown-item multi-select-item';
            item.innerHTML = `
                <label>
                    <input type="checkbox" value="${option}" ${isSelected ? 'checked' : ''}>
                    <span>${option}</span>
                </label>
            `;
            optionsList.appendChild(item);
        });
        
        // Create the wrapper for the dropdown content
        const dropdownContent = document.createElement('div');
        dropdownContent.className = 'dropdown-content show';
        
        // Add options list to dropdown content
        dropdownContent.appendChild(optionsList);
        
        // Add confirm button (outside the scrollable area)
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'button dropdown-confirm';
        confirmBtn.textContent = 'Confirm';
        confirmBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            
            // Get all selected options
            const selectedOptions = Array.from(
                optionsList.querySelectorAll('input[type="checkbox"]:checked')
            ).map(checkbox => checkbox.value);
            
            // Join selected options with comma and save
            const newValue = selectedOptions.join(', ');
            
            // Save the edit - this will also clean up the dropdown
            saveEdit(cell, column, rowIndex, newValue);
        });
        
        // Add cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'button button-secondary dropdown-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            cancelEdit();
        });
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'dropdown-button-container';
        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(confirmBtn);
        
        // Add button container to dropdown content (outside scroll area)
        dropdownContent.appendChild(buttonContainer);
        
        // Add custom styles for multi-select dropdown
        if (!document.getElementById('multi-select-dropdown-styles')) {
            const style = document.createElement('style');
            style.id = 'multi-select-dropdown-styles';
            style.textContent = `
                .dropdown-content {
                    display: flex;
                    flex-direction: column;
                    background: white;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                    min-width: 150px;
                    max-width: 250px;
                }
                .dropdown-content-scroll {
                    padding: 5px;
                    height: 100$;
                    overflow-y: auto;
                    flex: 1;
                }
                .multi-select-item {
                    padding: 5px;
                    cursor: default;
                }
                .multi-select-item:hover {
                    background-color: #f5f5f5;
                }
                .multi-select-item label {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    width: 100%;
                }
                .multi-select-item input {
                    margin-right: 8px;
                }
                .dropdown-button-container {
                    display: flex;
                    justify-content: space-between;
                    padding: 5px;
                    border-top: 1px solid #eee;
                    background: white;
                    position: sticky;
                    bottom: 0;
                }
                .dropdown-confirm, .dropdown-cancel {
                    padding: 3px 10px;
                    font-size: 0.8rem;
                }
                .multi-dropdown-container {
                    position: absolute;
                    z-index: 50;
                    background: white;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                }
            `;
            document.head.appendChild(style);
        }
        
        // Add to cell
        dropdownContainer.appendChild(dropdownContent);
        cell.appendChild(dropdownContainer);
        
        // Add click listeners to option checkboxes to prevent cell click event
        optionsList.querySelectorAll('.multi-select-item').forEach(item => {
            item.addEventListener('click', e => {
                e.stopPropagation();
            });
        });
    }
}

/**
 * Save cell edit to the data model
 * @param {HTMLElement} cell - The cell being edited
 * @param {string} column - Column ID
 * @param {number} rowIndex - Row index
 * @param {string} value - New value
 */
function saveEdit(cell, column, rowIndex, value) {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const dataIndex = startIndex + rowIndex;
    
    // Special validation for ID field
    if (column === 'id') {
        const existingIds = staffData
            .filter((_, idx) => idx !== dataIndex)
            .map(staff => staff.id);
            
        if (!Validate.staffId(value, existingIds)) {
            alert('Invalid or duplicate ID. Please provide a unique ID.');
            cancelEdit();
            return;
        }
    }
    
    // Handle comma-separated values for dropdown columns
    const columnDef = columns.find(col => col.id === column);
    if (columnDef && columnDef.type === 'dropdown' && value) {
        // Split and trim values
        const values = value.split(',').map(v => v.trim()).filter(v => v);
        
        // Check for invalid options
        const invalidOptions = values.filter(v => !columnDef.options.includes(v));
        if (invalidOptions.length > 0) {
            // Show confirmation
            if (confirm(`The following values are not in the existing options: ${invalidOptions.join(', ')}. Would you like to add them?`)) {
                // Add new options
                invalidOptions.forEach(opt => {
                    if (!columnDef.options.includes(opt)) {
                        columnDef.options.push(opt);
                        
                        // Update Models based on column ID
                        if (column === 'phase') {
                            Models.Staff.phaseOptions.push(opt);
                        } else if (column === 'overseas_thai') {
                            Models.Staff.overseasThaiOptions.push(opt);
                        } else if (column === 'year_group') {
                            Models.Staff.yearGroupOptions.push(opt);
                        } else if (column === 'department') {
                            Models.Staff.departmentOptions.push(opt);
                        }
                    }
                });
                
                // Save updated options
                saveModelOptions();
            } else {
                // Cancel the edit if user doesn't want to add the options
                cancelEdit();
                return;
            }
        }
        
        // Standardize format with comma-space
        value = values.join(', ');
    }
    
    // Update data model
    filteredData[dataIndex][column] = value;
    
    // If we're filtering, we need to find the actual index in the original data
    const originalIndex = staffData.findIndex(staff => staff.id === filteredData[dataIndex].id);
    if (originalIndex !== -1) {
        staffData[originalIndex][column] = value;
        
        // Save to storage
        Storage.save('staff', staffData);
        Logger.log(`Updated ${column} for staff ID ${staffData[originalIndex].id}`);
    }
    
    // Update cell display
    cell.textContent = value;
    
    // Clear editing state
    editingCell = null;
}

/**
 * Cancel the current edit operation
 */
function cancelEdit() {
    if (editingCell) {
        // Remove any dropdown or input elements
        if (editingCell.cell) {
            const dropdown = editingCell.cell.querySelector('.multi-dropdown-container');
            if (dropdown) {
                editingCell.cell.removeChild(dropdown);
            }
            
            const input = editingCell.cell.querySelector('input.editable-cell-input');
            if (input) {
                editingCell.cell.textContent = editingCell.originalValue;
            }
        }
        
        // Reset editing state
        editingCell = null;
    }
}

/**
 * Add a new staff member
 */
function handleAddStaff() {
    const newStaff = Models.Staff.createDefault();
    newStaff.id = `STAFF-${Date.now()}`;
    newStaff.name = 'New Staff Member';
    
    staffData.push(newStaff);
    filteredData.push(newStaff);
    
    Storage.save('staff', staffData);
    Logger.log(`Added new staff with ID ${newStaff.id}`);
    
    // Navigate to the last page
    currentPage = Math.ceil(filteredData.length / rowsPerPage);
    
    renderTable();
    renderPagination();
}

/**
 * Edit a staff member (not used directly in the table, but through action button)
 * @param {Event} event - Click event
 */
function handleEditStaff(event) {
    // Get staff member from row
    const row = event.target.closest('tr');
    const staffIndex = parseInt(row.dataset.staffIndex, 10);
    const staff = filteredData[staffIndex];
    
    if (!staff) {
        console.error('Staff member not found');
        return;
    }
    
    // Create a list of all form groups for each field
    const formGroups = [];
    
    // Add standard fields
    formGroups.push(`
        <div class="form-group">
            <label for="edit-name">Name:</label>
            <input type="text" id="edit-name" class="form-control" value="${staff.name || ''}">
        </div>
        
        <div class="form-group">
            <label for="edit-id">ID:</label>
            <input type="text" id="edit-id" class="form-control" value="${staff.id || ''}">
        </div>
    `);
    
    // Add standard classifications
    formGroups.push(`
        <div class="form-group">
            <label for="edit-phase">Phase:</label>
            <div id="phase-container" class="multi-select-container"></div>
        </div>
        
        <div class="form-group">
            <label for="edit-overseas-thai">Overseas/Thai:</label>
            <div id="overseas-thai-container" class="multi-select-container"></div>
        </div>
        
        <div class="form-group">
            <label for="edit-year-group">Year Group:</label>
            <div id="year-group-container" class="multi-select-container"></div>
        </div>
        
        <div class="form-group">
            <label for="edit-department">Department:</label>
            <div id="department-container" class="multi-select-container"></div>
        </div>
    `);
    
    // Add custom classifications
    const customFields = customClassifications.map(custom => `
        <div class="form-group">
            <label for="edit-${custom.id}">${custom.name}:</label>
            <div id="${custom.id}-container" class="multi-select-container"></div>
        </div>
    `).join('');
    
    if (customFields) {
        formGroups.push(customFields);
    }
    
    // Create modal for editing
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h2>Edit Staff</h2>
            
            ${formGroups.join('')}
            
            <div class="form-actions">
                <button id="save-edit" class="button">Save Changes</button>
                <button id="cancel-edit" class="button button-secondary">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Show the modal with a small delay to allow for transition
    setTimeout(() => modal.classList.add('show'), 10);
    
    // Get the containers for multi-select checkboxes
    const phaseContainer = document.getElementById('phase-container');
    const overseasThaiContainer = document.getElementById('overseas-thai-container');
    const yearGroupContainer = document.getElementById('year-group-container');
    const departmentContainer = document.getElementById('department-container');
    
    // Add multi-select checkboxes for standard fields
    phaseContainer.innerHTML = createMultiSelectCheckboxes('phase', Models.Staff.phaseOptions, staff.phase);
    overseasThaiContainer.innerHTML = createMultiSelectCheckboxes('overseas_thai', Models.Staff.overseasThaiOptions, staff.overseas_thai);
    yearGroupContainer.innerHTML = createMultiSelectCheckboxes('year_group', Models.Staff.yearGroupOptions, staff.year_group);
    departmentContainer.innerHTML = createMultiSelectCheckboxes('department', Models.Staff.departmentOptions, staff.department);
    
    // Add multi-select checkboxes for custom fields
    customClassifications.forEach(custom => {
        const container = document.getElementById(`${custom.id}-container`);
        if (container) {
            container.innerHTML = createMultiSelectCheckboxes(custom.id, custom.options, staff[custom.id] || '');
        }
    });
    
    // Add event listeners
    modal.querySelector('.close-modal').addEventListener('click', closeModal);
    modal.querySelector('#cancel-edit').addEventListener('click', closeModal);
    
    modal.querySelector('#save-edit').addEventListener('click', () => {
        // Get values from form
        const updatedStaff = {...staff};
        updatedStaff.name = document.getElementById('edit-name').value;
        updatedStaff.id = document.getElementById('edit-id').value;
        
        // Get multi-select values for standard fields
        updatedStaff.phase = getMultiSelectValues(document.getElementById('phase-container'), 'phase');
        updatedStaff.overseas_thai = getMultiSelectValues(document.getElementById('overseas-thai-container'), 'overseas_thai');
        updatedStaff.year_group = getMultiSelectValues(document.getElementById('year-group-container'), 'year_group');
        updatedStaff.department = getMultiSelectValues(document.getElementById('department-container'), 'department');
        
        // Get multi-select values for custom fields
        customClassifications.forEach(custom => {
            const container = document.getElementById(`${custom.id}-container`);
            if (container) {
                updatedStaff[custom.id] = getMultiSelectValues(container, custom.id);
            }
        });
        
        // Update staff data
        const staffIndex = staffData.findIndex(s => s.id === staff.id);
        if (staffIndex >= 0) {
            staffData[staffIndex] = updatedStaff;
            Storage.save('staff', staffData);
            
            // Update filtered data
            filteredData = [...staffData];
            
            // Re-render table
            renderTable();
            renderPagination();
            initializeFilterSystem();
            
            Logger.log(`Updated staff: ${updatedStaff.name} (${updatedStaff.id})`);
        }
        
        closeModal();
    });
    
    // Modal close function
    function closeModal() {
        modal.classList.remove('show');
        setTimeout(() => document.body.removeChild(modal), 300);
    }
}

/**
 * Helper to create multi-select checkboxes for the edit form
 * @param {string} fieldName - Field name 
 * @param {Array<string>} options - Available options
 * @param {string} currentValue - Current comma-separated values
 * @returns {string} HTML for checkboxes
 */
function createMultiSelectCheckboxes(fieldName, options, currentValue) {
    // Split by comma and space, then trim each value
    const currentValues = currentValue ? currentValue.split(', ').map(v => v.trim()).filter(v => v) : [];
    
    return options.map(option => `
        <div class="multi-select-item">
            <label>
                <input type="checkbox" name="${fieldName}" value="${option}" 
                       ${currentValues.includes(option) ? 'checked' : ''}>
                <span>${option}</span>
            </label>
        </div>
    `).join('');
}

/**
 * Helper to get comma-separated values from multi-select checkboxes
 * @param {HTMLElement} container - Container element
 * @param {string} fieldName - Field name
 * @returns {string} Comma-separated values
 */
function getMultiSelectValues(container, fieldName) {
    const selected = Array.from(
        container.querySelectorAll(`input[name="${fieldName}"]:checked`)
    ).map(checkbox => checkbox.value);
    
    return selected.join(', ');
}

/**
 * Delete a staff member
 * @param {Event} event - Click event
 */
function handleDeleteStaff(event) {
    const staffId = event.currentTarget.dataset.id;
    
    if (confirm(`Are you sure you want to delete staff member with ID ${staffId}?`)) {
        // Remove from data
        staffData = staffData.filter(staff => staff.id !== staffId);
        filteredData = filteredData.filter(staff => staff.id !== staffId);
        
        // Save to storage
        Storage.save('staff', staffData);
        Logger.log(`Deleted staff with ID ${staffId}`);
        
        // Update table
        renderTable();
        renderPagination();
    }
}

/**
 * Export staff data to JSON
 */
function handleExportData() {
    const jsonData = JSON.stringify(staffData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'staff_data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    Logger.log('Exported staff data');
}

/**
 * Show column settings for a specific column
 * @param {Object} column - Column definition
 */
function showColumnSettings(column) {
    // Only process dropdown columns
    if (column.type !== 'dropdown') return;
    
    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    
    // Create settings modal
    const modal = document.createElement('div');
    modal.className = 'page-modal'; // Change from 'modal' to 'page-modal'
    modal.innerHTML = `
        <div class="modal-header">
            <h2>${column.name} Options</h2>
            <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
            <p>Manage available options for the ${column.name} dropdown:</p>
            
            <div class="form-group">
                <label for="current-options">Current Options:</label>
                <ul id="options-list" class="options-list">
                    ${column.options.map((option, index) => `
                        <li class="option-item">
                            <span class="option-text">${option}</span>
                            <button class="button button-danger remove-option" data-index="${index}">Remove</button>
                        </li>
                    `).join('')}
                </ul>
            </div>
            
            <div class="form-group">
                <label for="new-option">Add New Option:</label>
                <div class="option-add-row">
                    <input type="text" id="new-option" placeholder="Enter new option">
                    <button id="add-option" class="button">Add</button>
                </div>
            </div>
            
            <div class="form-actions">
                <button id="save-options" class="button">Save Changes</button>
                <button id="cancel-options" class="button button-secondary">Cancel</button>
                ${!column.isCore ? `<button id="delete-category" class="button button-danger">Delete Category</button>` : ''}
            </div>
        </div>
    `;
    
    // Add custom styles for options list
    if (!document.getElementById('options-list-styles')) {
        const style = document.createElement('style');
        style.id = 'options-list-styles';
        style.textContent = `
            .options-list {
                list-style: none;
                padding: 0;
                margin: 0;
                border: 1px solid #ddd;
                max-height: 300px;
                overflow-y: auto;
            }
            .option-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.5rem;
                border-bottom: 1px solid #eee;
            }
            .option-item:last-child {
                border-bottom: none;
            }
            .option-add-row {
                display: flex;
                gap: 0.5rem;
            }
            .option-add-row input {
                flex: 1;
            }
            .button-danger {
                background-color: #f44336;
                color: white;
            }
            .button-danger:hover {
                background-color: #d32f2f;
            }
            .form-actions {
                display: flex;
                gap: 0.5rem;
                flex-wrap: wrap;
            }
            .form-actions .button-danger {
                margin-left: auto;
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(modal);
    
    // Create a copy of options for editing
    const editingOptions = [...column.options];
    
    // Add event listeners
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('#cancel-options').addEventListener('click', closeModal);
    
    // Add delete category button handler if this is a custom or non-core classification
    const deleteBtn = modal.querySelector('#delete-category');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const confirmMsg = `Are you sure you want to delete the "${column.name}" category? This will remove it from all staff records and cannot be undone.`;
            
            if (confirm(confirmMsg)) {
                deleteCategory(column);
                closeModal();
            }
        });
    }
    
    // Add new option
    modal.querySelector('#add-option').addEventListener('click', () => {
        const newOptionInput = modal.querySelector('#new-option');
        const newOption = newOptionInput.value.trim();
        
        if (!newOption) {
            alert('Please enter an option name');
            return;
        }
        
        if (editingOptions.includes(newOption)) {
            alert('This option already exists');
            return;
        }
        
        // Add to temporary options array
        editingOptions.push(newOption);
        
        // Add to UI
        const optionsList = modal.querySelector('#options-list');
        const newIndex = editingOptions.length - 1;
        
        const li = document.createElement('li');
        li.className = 'option-item';
        li.innerHTML = `
            <span class="option-text">${newOption}</span>
            <button class="button button-danger remove-option" data-index="${newIndex}">Remove</button>
        `;
        
        optionsList.appendChild(li);
        
        // Add remove handler to new item
        li.querySelector('.remove-option').addEventListener('click', function() {
            handleRemoveOption(this, editingOptions);
        });
        
        // Clear input
        newOptionInput.value = '';
    });
    
    // Remove option handlers
    modal.querySelectorAll('.remove-option').forEach(button => {
        button.addEventListener('click', function() {
            handleRemoveOption(this, editingOptions);
        });
    });
    
    // Save changes
    modal.querySelector('#save-options').addEventListener('click', () => {
        // Ensure we have at least one option
        if (editingOptions.length === 0) {
            alert('You must have at least one option in the dropdown');
            return;
        }
        
        // Update the column options - using shared references for built-in columns
        // or updating custom columns
        if (column.id === 'phase') {
            Models.Staff.phaseOptions = editingOptions;
            column.options = Models.Staff.phaseOptions; // Using reference from the model
        } else if (column.id === 'overseas_thai') {
            Models.Staff.overseasThaiOptions = editingOptions;
            column.options = Models.Staff.overseasThaiOptions;
        } else if (column.id === 'year_group') {
            Models.Staff.yearGroupOptions = editingOptions;
            column.options = Models.Staff.yearGroupOptions;
        } else if (column.id === 'department') {
            Models.Staff.departmentOptions = editingOptions;
            column.options = Models.Staff.departmentOptions;
        } else if (column.isCustom) {
            // Handle custom classification options
            column.options = editingOptions;
            
            // Update the stored custom classifications
            const customClassIndex = customClassifications.findIndex(cc => cc.id === column.id);
            if (customClassIndex >= 0) {
                customClassifications[customClassIndex].options = editingOptions;
                saveCustomClassifications();
            }
        }
        
        // Save options to model storage
        saveModelOptions();
        
        // Reinitialize filter system to reflect updated column options
        initializeFilterSystem();
        
        // Check for and update any data consistency issues
        checkAndUpdateStaffData();
        
        // Re-render the table to ensure cells have updated dropdown options
        renderTable();
        
        // Close modal
        closeModal();
        
        Logger.log(`Updated options for ${column.name}`);
    });
    
    function handleRemoveOption(button, optionsArray) {
        const index = parseInt(button.dataset.index);
        const option = optionsArray[index];
        
        // Check if this option is used in any staff records
        const isUsed = staffData.some(staff => {
            if (!staff[column.id]) return false;
            
            // Handle multi-select values
            const values = staff[column.id].split(', ');
            return values.includes(option);
        });
        
        if (isUsed) {
            if (!confirm(`The option "${option}" is currently used by staff records. Removing it may cause data inconsistencies. Continue?`)) {
                return;
            }
        }
        
        // Remove from array
        optionsArray.splice(index, 1);
        
        // Rebuild the entire list to ensure indices are correct
        const optionsList = modal.querySelector('#options-list');
        optionsList.innerHTML = optionsArray.map((opt, idx) => `
            <li class="option-item">
                <span class="option-text">${opt}</span>
                <button class="button button-danger remove-option" data-index="${idx}">Remove</button>
            </li>
        `).join('');
        
        // Re-attach event handlers
        optionsList.querySelectorAll('.remove-option').forEach(btn => {
            btn.addEventListener('click', function() {
                handleRemoveOption(this, optionsArray);
            });
        });
    }
    
    function closeModal() {
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
    }
}

/**
 * Delete a category (column) from the table and filters
 * @param {Object} column - Column to delete
 */
function deleteCategory(column) {
    // First, remove from columns array
    const colIndex = columns.findIndex(col => col.id === column.id);
    if (colIndex !== -1) {
        columns.splice(colIndex, 1);
    }
    
    // If it's a custom classification, remove from customClassifications array
    if (column.isCustom) {
        const customIndex = customClassifications.findIndex(cc => cc.id === column.id);
        if (customIndex !== -1) {
            customClassifications.splice(customIndex, 1);
            saveCustomClassifications();
        }
    }
    
    // Remove the field from all staff records
    staffData.forEach(staff => {
        if (staff.hasOwnProperty(column.id)) {
            delete staff[column.id];
        }
    });
    
    // Save updated staff data
    Storage.save('staff', staffData);
    filteredData = [...staffData];
    
    // Save column settings
    Storage.save('masterlog_columns', columns);
    
    // Re-render components
    renderTableHeader();
    renderTable();
    renderPagination();
    
    // SPECIAL CASE: Force a complete rebuild of the filter system UI
    const filterSection = document.getElementById('filter-section');
    if (filterSection) {
        // Get the list of current filter IDs before deletion
        const oldFilterIds = Array.from(filterSection.querySelectorAll('.filter-select'))
            .map(el => el.dataset.field);
        
        // Log which filters we have before deletion
        Logger.log(`Filters before deletion: ${oldFilterIds.join(', ')}`);
        
        // Completely remove all filters
        filterSection.innerHTML = '';
        
        // Configure filter system with custom filters that exclude the deleted column
        const customFilters = buildDynamicFilters();
        
        // Log if our deleted column was removed
        const currentFilterIds = customFilters.classification.map(f => f.id);
        Logger.log(`Filters after deletion: ${currentFilterIds.join(', ')}`);
        
        // Verify removal
        if (oldFilterIds.includes(column.id) && !currentFilterIds.includes(column.id)) {
            Logger.log(`Successfully removed filter for ${column.name} (${column.id})`);
        }
        
        // Create a new filter system instance
        filterSystem = new FilterSystem({
            filterSection: filterSection,
            staffData: staffData,
            includeStandardsFilters: false,
            onFilterChange: handleFilterChange,
            customFilters: customFilters
        });
        
        // Add plus button to the Classification header
        const classificationHeader = filterSection.querySelector('.classification-group h4');
        if (classificationHeader) {
            const headerWrapper = document.createElement('div');
            headerWrapper.className = 'classification-header';
            headerWrapper.textContent = classificationHeader.textContent;
            
            const addButton = document.createElement('button');
            addButton.className = 'add-classification-button';
            addButton.textContent = '+';
            addButton.title = 'Add new classification';
            addButton.addEventListener('click', showAddClassificationModal);
            
            classificationHeader.textContent = '';
            headerWrapper.appendChild(addButton);
            classificationHeader.appendChild(headerWrapper);
        }
        
        // Enforce grid layout for classification filters
        const classificationFilters = document.getElementById('classification-filters');
        if (classificationFilters) {
            classificationFilters.style.display = 'grid';
            
            // Count the number of visible classification filters
            const filterCount = classificationFilters.querySelectorAll('.filter-item').length;
            
            // Adjust grid column width based on number of items
            if (filterCount <= 2) {
                classificationFilters.style.gridTemplateColumns = 'repeat(2, 1fr)';
            } else if (filterCount <= 4) {
                classificationFilters.style.gridTemplateColumns = 'repeat(4, 1fr)';
            } else {
                classificationFilters.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))';
            }
            
            classificationFilters.style.gap = '8px';
            classificationFilters.style.width = '100%';
        }
    }
    
    Logger.log(`Deleted category: ${column.name}`);
}

/**
 * Check and update staff data for consistency after option changes
 */
function checkAndUpdateStaffData() {
    // Get all staff data
    staffData = Storage.load('staff', []);
    
    // Check if we need to update staff data with new column options
    let updated = false;
    const columnOptions = {};
    
    // Collect the current options for each dropdown column
    columns.forEach(column => {
        if (column.type === 'dropdown' && Array.isArray(column.options)) {
            columnOptions[column.id] = [...column.options];
        }
    });
    
    // Update staff records with empty fields for any missing columns
    staffData.forEach(staff => {
        Object.keys(columnOptions).forEach(columnId => {
            // Check if staff has value for this column
            if (staff[columnId] === undefined || staff[columnId] === null) {
                // Use first option as default
                staff[columnId] = columnOptions[columnId][0] || '';
                updated = true;
            }
        });
    });
    
    // Save updated staff data if changes were made
    if (updated) {
        Storage.save('staff', staffData);
        filteredData = [...staffData];
        
        // Re-render components
        renderTableHeader();
        renderTable();
        renderPagination();
        initializeFilterSystem();
        
        Logger.log('Updated staff data with new fields');
    }
}

/**
 * Show the column manager modal
 */
function showColumnManager() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    // Create column checkboxes, including custom classifications
    const columnCheckboxes = columns.map(column => {
        if (column.id === 'actions') {
            return ''; // Skip the actions column, always visible
        }
        
        // Add tag for custom classifications
        const customBadge = column.isCustom ? 
            '<span class="badge badge-info">Custom</span>' : '';
            
        return `
            <div class="modal-field column-toggle">
                <label>
                    <input type="checkbox" data-column="${column.id}" ${column.visible ? 'checked' : ''}>
                    ${column.name} ${customBadge}
                </label>
                <div class="column-size-control">
                    <label for="width-${column.id}">Width:</label>
                    <input type="text" id="width-${column.id}" class="column-width" value="${column.width}">
                </div>
            </div>
        `;
    }).join('');
    
    modal.innerHTML = `
        <div class="modal-content column-manager">
            <span class="close-modal">&times;</span>
            <h2>Manage Columns</h2>
            <p>Select columns to display and set their widths.</p>
            
            <div class="column-manager-container">
                ${columnCheckboxes}
            </div>
            
            <div class="modal-footer">
                <button id="save-columns" class="button">Save Changes</button>
                <button id="cancel-columns" class="button button-secondary">Cancel</button>
            </div>
        </div>
    `;
    
    // Add styles for the custom badge
    if (!document.getElementById('custom-badge-styles')) {
        const style = document.createElement('style');
        style.id = 'custom-badge-styles';
        style.textContent = `
            .badge {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 0.7rem;
                font-weight: bold;
                margin-left: 6px;
            }
            .badge-info {
                background-color: #e3f2fd;
                color: #0288d1;
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(modal);
    
    // Show the modal
    setTimeout(() => modal.classList.add('show'), 10);
    
    // Add event listeners
    modal.querySelector('.close-modal').addEventListener('click', closeModal);
    modal.querySelector('#cancel-columns').addEventListener('click', closeModal);
    modal.querySelector('#save-columns').addEventListener('click', () => {
        saveColumnSettings();
        closeModal();
    });
    
    // Close modal function
    function closeModal() {
        modal.classList.remove('show');
        setTimeout(() => document.body.removeChild(modal), 300);
    }
}

/**
 * Save column visibility and width settings
 */
function saveColumnSettings() {
    const columnToggles = document.querySelectorAll('.column-toggle input[type="checkbox"]');
    const columnWidths = document.querySelectorAll('.column-width');
    
    // Update column settings
    columnToggles.forEach(toggle => {
        const column = columns.find(c => c.id === toggle.dataset.column);
        if (column) {
            column.visible = toggle.checked;
        }
    });
    
    columnWidths.forEach(input => {
        const columnId = input.id.replace('width-', '');
        const column = columns.find(c => c.id === columnId);
        if (column) {
            column.width = input.value || column.width;
        }
    });
    
    // Save updated column settings
    Storage.save('masterlog_columns', columns);
    
    // Re-render components
    renderTableHeader();
    renderTable();
    initializeFilterSystem();
}

/**
 * Apply filters manually (used for direct filter application, not through FilterSystem)
 */
function applyFilters() {
    // If we have a filter system instance, use it
    if (filterSystem) {
        // This will trigger the onFilterChange callback
        filterSystem.applyFilters();
    }
}

/**
 * Clear all filters
 */
function clearFilters() {
    // If we have a filter system instance, use it
    if (filterSystem) {
        filterSystem.clearFilters();
    }
}

/**
 * Handle bulk adding multiple staff members from spreadsheet data
 */
function handleBulkAddStaff() {
    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    
    // Get visible columns for the bulk add table
    const visibleColumns = columns.filter(col => col.visible && col.id !== 'actions');
    
    // Create bulk add modal
    const modal = document.createElement('div');
    modal.className = 'page-modal modal-large'; // Change from 'modal modal-large' to 'page-modal modal-large'
    modal.innerHTML = `
        <div class="modal-header">
            <h2>Bulk Add Staff</h2>
            <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
            <p>Copy and paste data from a spreadsheet. Each row will create a new staff member.</p>
            <div class="bulk-add-instructions mb-1">
                <ol>
                    <li>Copy cells from your spreadsheet (Ctrl+C or Cmd+C)</li>
                    <li>Click in the table below and paste (Ctrl+V or Cmd+V)</li>
                    <li>Review the data and click "Add Staff" when ready</li>
                </ol>
                <p><small><strong>Tip:</strong> For dropdown fields, you can use comma-separated values (e.g., "Primary, Secondary") to select multiple options.</small></p>
                <p><small>You can drag to select multiple cells, double-click to select an entire column, and use Ctrl+C/Ctrl+X/Delete on selections.</small></p>
            </div>
            
            <div class="bulk-table-container">
                <table id="bulk-add-table" class="table">
                    <thead>
                        <tr>
                            ${visibleColumns.map(col => `<th>${col.name}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${Array(10).fill().map(() => `
                            <tr>
                                ${visibleColumns.map(col => `<td contenteditable="true" data-column="${col.id}"></td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="form-actions mt-1">
                <button id="cancel-bulk-add" class="button button-secondary">Cancel</button>
                <button id="add-rows" class="button button-secondary">Add Rows</button>
                <button id="bulk-save" class="button">Add Staff</button>
            </div>
        </div>
    `;
    
    // Add custom styles for bulk add modal
    if (!document.getElementById('bulk-add-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'bulk-add-modal-styles';
        style.textContent = `
            .bulk-add-modal {
                width: 95vw;
                max-width: 95vw;
                margin: 0 auto;
                position: fixed;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
                max-height: 90vh;
                display: flex;
                flex-direction: column;
            }
            .bulk-add-modal .modal-header {
                width: 100%;
                padding: 10px 20px;
                flex-shrink: 0;
            }
            .bulk-add-modal .modal-body {
                max-width: 100%;
                width: 100%;
                padding: 20px;
                overflow: hidden;
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            .bulk-table-container {
                max-height: 65vh;
                overflow-y: auto;
                overflow-x: auto;
                border: 1px solid #ddd;
                border-radius: 4px;
                flex: 1;
            }
            #bulk-add-table {
                width: 100%;
                border-collapse: collapse;
                table-layout: auto;
            }
            #bulk-add-table th, #bulk-add-table td {
                padding: 8px 12px;
                border: 1px solid #ddd;
                min-width: 180px;
                max-width: 350px;
                white-space: normal;
                word-break: break-word;
            }
            #bulk-add-table th {
                background-color: #f5f5f5;
                font-weight: bold;
                text-align: left;
                position: sticky;
                top: 0;
                z-index: 10;
            }
            #bulk-add-table td {
                background-color: #fff;
            }
            #bulk-add-table td:focus {
                outline: 2px solid #2196f3;
            }
            #bulk-add-table td.selected {
                background-color: rgba(33, 150, 243, 0.2);
            }
            #bulk-add-table td.selecting {
                background-color: rgba(33, 150, 243, 0.4);
            }
            .bulk-add-instructions {
                margin-bottom: 15px;
                flex-shrink: 0;
            }
            .bulk-add-instructions ol {
                padding-left: 20px;
            }
            .form-actions.mt-1 {
                flex-shrink: 0;
                margin-top: 15px;
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(modal);
    
    // Add event listeners for modal controls
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('#cancel-bulk-add').addEventListener('click', closeModal);
    modal.querySelector('#add-rows').addEventListener('click', addRows);
    
    // Handle paste events on the table
    const bulkAddTable = document.getElementById('bulk-add-table');
    bulkAddTable.addEventListener('paste', handlePaste);
    
    // Add cell selection functionality
    setupCellSelection(bulkAddTable);
    
    // Add diagnostic function to the window to test selection
    window.debugBulkAddTable = function() {
        console.log('--- BULK ADD TABLE DIAGNOSTIC ---');
        try {
            const table = document.getElementById('bulk-add-table');
            if (!table) {
                console.error('Bulk add table not found in DOM');
                return false;
            }
            
            console.log('Table found:', table);
            console.log('Table dimensions:', 
                'thead rows:', table.tHead ? table.tHead.rows.length : 0,
                'tbody rows:', table.tBodies[0] ? table.tBodies[0].rows.length : 0
            );
            
            if (table.tBodies[0] && table.tBodies[0].rows.length > 0) {
                const firstRow = table.tBodies[0].rows[0];
                console.log('First row cells:', firstRow.cells.length);
                
                // Try to check for event listeners (only works in Chrome DevTools)
                console.log('Note: Use Chrome DevTools to see event listeners with getEventListeners(table)');
                
                // Try to manually trigger a selection
                const cell = firstRow.cells[0];
                if (cell) {
                    console.log('Selected cell:', cell);
                    cell.classList.add('selected');
                    console.log('Added selected class, cell now:', cell);
                    
                    // Check if style is applied
                    const style = window.getComputedStyle(cell);
                    console.log('Cell computed style:', {
                        backgroundColor: style.backgroundColor,
                        border: style.border
                    });
                    
                    // Try to trigger selection manually
                    console.log('Attempting to trigger selection directly:');
                    if (window.testSelection) {
                        const result = window.testSelection();
                        console.log('Test selection result:', result);
                    }
                    
                    setTimeout(() => {
                        cell.classList.remove('selected');
                        console.log('Removed selected class after 2 seconds');
                    }, 2000);
                    
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('Error in diagnostic:', error);
            return false;
        }
    };
    
    // Provide a global fix function that can be called if selection doesn't work
    window.fixBulkTableSelection = function() {
        try {
            const table = document.getElementById('bulk-add-table');
            if (!table) {
                console.error('Bulk add table not found');
                return false;
            }
            
            console.log('Attempting to manually add selection handlers');
            
            // Create style
            const style = document.createElement('style');
            style.textContent = `
                #bulk-add-table td.manually-selected {
                    background-color: #ffcc00 !important;
                    border: 3px solid #ff6600 !important;
                }
            `;
            document.head.appendChild(style);
            
            // Add click handler directly
            table.addEventListener('click', function(e) {
                const cell = e.target.closest('td');
                if (!cell) return;
                
                // Toggle selection
                cell.classList.toggle('manually-selected');
                console.log('Toggled selection on cell');
            });
            
            console.log('Manual selection handler added. Click cells to select/deselect');
            return true;
        } catch (error) {
            console.error('Error adding manual selection:', error);
            return false;
        }
    };
    
    // Handle the bulk save action
    modal.querySelector('#bulk-save').addEventListener('click', () => {
        const newStaffMembers = [];
        const invalidValues = {};
        
        // Get all rows with data
        const rows = Array.from(bulkAddTable.querySelectorAll('tbody tr')).filter(row => {
            const cells = row.querySelectorAll('td');
            return Array.from(cells).some(cell => cell.textContent.trim() !== '');
        });
        
        // Process each row
        rows.forEach((row, index) => {
            const newStaff = Models.Staff.createDefault();
            newStaff.id = `STAFF-${Date.now()}-${index}`;
            
            // Process each cell in the row
            row.querySelectorAll('td').forEach(cell => {
                const columnId = cell.dataset.column;
                const value = cell.textContent.trim();
                
                if (value) {
                    // Check if the value is in the options for dropdown columns
                    const column = columns.find(col => col.id === columnId);
                    if (column && column.type === 'dropdown' && column.options) {
                        // Split by comma and process each value separately
                        const values = value.split(',').map(v => v.trim()).filter(v => v);
                        
                        // Check if any values are not in the options
                        values.forEach(singleValue => {
                            if (!column.options.includes(singleValue)) {
                                // Track invalid values for later prompting
                                if (!invalidValues[columnId]) {
                                    invalidValues[columnId] = new Set();
                                }
                                invalidValues[columnId].add(singleValue);
                            }
                        });
                        
                        // Set the value as comma-space separated list
                        newStaff[columnId] = values.join(', ');
                    } else {
                        // Set the value as is for non-dropdown columns
                        newStaff[columnId] = value;
                    }
                }
            });
            
            // Only add staff with a name
            if (newStaff.name) {
                newStaffMembers.push(newStaff);
            }
        });
        
        // Check if there are any invalid values to add to options
        if (Object.keys(invalidValues).length > 0) {
            showInvalidValuesPrompt(invalidValues, newStaffMembers, closeModal);
        } else {
            // Add all staff members
            addNewStaffMembers(newStaffMembers);
            closeModal();
        }
    });
    
    /**
     * Close the modal
     */
    function closeModal() {
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
    }
    
    /**
     * Add more rows to the bulk add table
     */
    function addRows() {
        const tbody = bulkAddTable.querySelector('tbody');
        const rowsToAdd = 5;
        
        for (let i = 0; i < rowsToAdd; i++) {
            const newRow = document.createElement('tr');
            newRow.innerHTML = visibleColumns.map(col => 
                `<td contenteditable="true" data-column="${col.id}"></td>`
            ).join('');
            
            tbody.appendChild(newRow);
        }
    }
    
    /**
     * Handle paste event from spreadsheet
     * @param {ClipboardEvent} event - The paste event
     */
    function handlePaste(event) {
        event.preventDefault();
        
        // Get the paste data
        const clipboardData = event.clipboardData || window.clipboardData;
        const pastedData = clipboardData.getData('text');
        
        // Parse the data into rows and columns
        const rows = pastedData.trim().split(/[\r\n]+/);
        const grid = rows.map(row => row.split('\t'));
        
        // Get the target cell
        const targetCell = event.target.closest('td');
        if (!targetCell) return;
        
        // Get the position of the target cell
        const targetRow = targetCell.parentElement;
        const rowIndex = Array.from(targetRow.parentElement.children).indexOf(targetRow);
        const cellIndex = Array.from(targetRow.children).indexOf(targetCell);
        
        // Populate cells with pasted data
        grid.forEach((rowData, rowOffset) => {
            // Find or create the row
            let currentRow;
            if (rowIndex + rowOffset < bulkAddTable.querySelectorAll('tbody tr').length) {
                currentRow = bulkAddTable.querySelectorAll('tbody tr')[rowIndex + rowOffset];
            } else {
                // Add a new row if needed
                currentRow = document.createElement('tr');
                currentRow.innerHTML = visibleColumns.map(col => 
                    `<td contenteditable="true" data-column="${col.id}"></td>`
                ).join('');
                bulkAddTable.querySelector('tbody').appendChild(currentRow);
            }
            
            // Populate cells in this row
            rowData.forEach((cellData, colOffset) => {
                // Check if the column exists
                if (cellIndex + colOffset < currentRow.children.length) {
                    currentRow.children[cellIndex + colOffset].textContent = cellData;
                }
            });
        });
    }
    
    /**
     * Setup cell selection functionality for the bulk add table
     * @param {HTMLElement} table - The bulk add table element
     */
    function setupCellSelection(table) {
        console.log('Setting up simple cell selection for', table);
        
        // Add required styles directly to head
        const style = document.createElement('style');
        style.textContent = `
            #bulk-add-table td.selected {
                background-color: rgba(33, 150, 243, 0.4) !important;
                border: 2px solid #2196f3 !important;
            }
        `;
        document.head.appendChild(style);
        
        // Simple selection implementation - no complex range selection yet
        let isMouseDown = false;
        let selectedCells = [];
        
        // Direct DOM event handlers - as simple as possible
        function handleMouseDown(e) {
            console.log('Mouse down on table');
            const cell = e.target.closest('td');
            if (!cell) return;
            
            // Don't interfere with editing or non-left click events
            if (document.activeElement === cell || e.button !== 0) return;
            
            // Start selection mode
            isMouseDown = true;
            
            // Clear previous selection unless Shift key is pressed
            if (!e.shiftKey) {
                selectedCells.forEach(cell => cell.classList.remove('selected'));
                selectedCells = [];
            }
            
            // Add this cell
            cell.classList.add('selected');
            selectedCells.push(cell);
            
            // If only one cell is selected, make it editable by focusing
            if (selectedCells.length === 1 && cell.hasAttribute('contenteditable')) {
                setTimeout(() => {
                    // Use setTimeout to allow the selection to complete first
                    cell.focus();
                }, 0);
                return; // Don't prevent default to allow focus to work
            }
            
            // Prevent default for multi-selection
            e.preventDefault();
        }
        
        function handleMouseOver(e) {
            if (!isMouseDown) return;
            
            const cell = e.target.closest('td');
            if (!cell || cell.classList.contains('selected')) return;
            
            // Add this cell to selection
            cell.classList.add('selected');
            selectedCells.push(cell);
        }
        
        function handleMouseUp() {
            isMouseDown = false;
        }
        
        // Handle double-click to immediately edit a cell
        function handleDoubleClick(e) {
            const cell = e.target.closest('td');
            if (!cell || !cell.hasAttribute('contenteditable')) return;
            
            // Clear selection and only select this cell
            selectedCells.forEach(c => c.classList.remove('selected'));
            selectedCells = [cell];
            cell.classList.add('selected');
            
            // Focus for editing
            cell.focus();
        }
        
        // Add keyboard shortcuts
        function handleKeyDown(e) {
            // Only process when the bulk add modal is open
            if (!document.querySelector('.bulk-add-modal')) return;
            
            // Only process if we have selected cells
            if (selectedCells.length === 0) return;
            
            // Skip if we're already editing
            if (document.activeElement.tagName === 'TD') return;
            
            console.log('Key press detected:', e.key, 'Ctrl/Cmd:', e.ctrlKey || e.metaKey);
            
            // Ctrl+C (Copy)
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                // Simple implementation - just join cell contents with tabs and newlines
                const content = copySelection();
                console.log('Copied content:', content);
                
                // Show feedback
                showToast('Copied ' + selectedCells.length + ' cells');
                e.preventDefault();
            }
            // Ctrl+X (Cut)
            else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
                const content = copySelection();
                console.log('Cut content:', content);
                selectedCells.forEach(cell => {
                    cell.textContent = '';
                });
                showToast('Cut ' + selectedCells.length + ' cells');
                e.preventDefault();
            }
            // Ctrl+V (Paste) - focus the single cell to allow native paste
            else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                if (selectedCells.length === 1) {
                    selectedCells[0].focus();
                }
                // Let the default paste behavior handle the rest
            }
            // Delete/Backspace (Clear)
            else if (e.key === 'Delete' || e.key === 'Backspace') {
                console.log('Clearing', selectedCells.length, 'cells');
                selectedCells.forEach(cell => {
                    cell.textContent = '';
                });
                showToast('Cleared ' + selectedCells.length + ' cells');
                e.preventDefault();
            }
            // Direct typing when a single cell is selected - start editing
            else if (selectedCells.length === 1 && 
                     e.key.length === 1 && 
                     !e.ctrlKey && !e.metaKey && !e.altKey && 
                     selectedCells[0].hasAttribute('contenteditable')) {
                // Focus the cell
                const cell = selectedCells[0];
                cell.focus();
                
                // If it's a character, we want to clear the cell first to replace content
                // But only if it was a direct keypress (not part of a composition)
                if (!e.isComposing) {
                    cell.textContent = '';
                    // Let the default behavior add the character
                }
            }
        }
        
        // Show feedback toast
        function showToast(message) {
            // Create a toast element
        }
        
        // Show feedback toast
        function showToast(message) {
            // Create a toast element
            const toast = document.createElement('div');
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background-color: #333;
                color: white;
                padding: 10px 20px;
                border-radius: 4px;
                z-index: 9999;
            `;
            document.body.appendChild(toast);
            
            // Remove after 2 seconds
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 2000);
        }
        
        // Copy selected cells to clipboard
        function copySelection() {
            // Group by rows
            const rows = {};
            selectedCells.forEach(cell => {
                const rowIndex = cell.parentElement.rowIndex;
                const colIndex = cell.cellIndex;
                
                if (!rows[rowIndex]) rows[rowIndex] = {};
                rows[rowIndex][colIndex] = cell.textContent || '';
            });
            
            // Format as tab-delimited text
            const rowIndices = Object.keys(rows).sort((a, b) => a - b);
            let text = '';
            
            rowIndices.forEach(rowIndex => {
                const columns = rows[rowIndex];
                const colIndices = Object.keys(columns).sort((a, b) => a - b);
                
                const rowValues = colIndices.map(colIndex => columns[colIndex]);
                text += rowValues.join('\t') + '\n';
            });
            
            // Copy to clipboard
            try {
                navigator.clipboard.writeText(text).then(() => {
                    console.log('Successfully copied to clipboard');
                }).catch(err => {
                    console.error('Clipboard API failed:', err);
                    
                    // Try execCommand as fallback
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    document.body.appendChild(textArea);
                    textArea.select();
                    const success = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    
                    if (!success) {
                        console.error('Both clipboard methods failed');
                    }
                });
            } catch (err) {
                console.error('Error copying to clipboard:', err);
            }
            
            return text;
        }
        
        // Add right-click context menu
        table.addEventListener('contextmenu', function(e) {
            // Only handle right-click on cells
            const cell = e.target.closest('td');
            if (!cell) return;
            
            // If we have no selected cells, select this one
            if (selectedCells.length === 0) {
                cell.classList.add('selected');
                selectedCells.push(cell);
            }
            
            // Prevent default browser context menu
            e.preventDefault();
            
            // Remove any existing context menu
            const existingMenu = document.getElementById('table-context-menu');
            if (existingMenu) {
                document.body.removeChild(existingMenu);
            }
            
            // Create context menu
            const menu = document.createElement('div');
            menu.id = 'table-context-menu';
            menu.style.cssText = `
                position: fixed;
                background: white;
                border: 1px solid #ccc;
                box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
                border-radius: 3px;
                z-index: 1000;
                padding: 5px 0;
            `;
            
            // Menu items
            const items = [
                {
                    label: `Copy (${selectedCells.length} cells)`,
                    action: () => {
                        copySelection();
                        showToast('Copied ' + selectedCells.length + ' cells');
                    }
                },
                {
                    label: `Cut (${selectedCells.length} cells)`,
                    action: () => {
                        copySelection();
                        selectedCells.forEach(cell => cell.textContent = '');
                        showToast('Cut ' + selectedCells.length + ' cells');
                    }
                },
                {
                    label: 'Paste',
                    action: () => {
                        // We can only use the Clipboard API to read in secure contexts
                        // This is a UI hint to use Ctrl+V instead
                        if (selectedCells.length === 1) {
                            // Focus the cell to allow native paste
                            selectedCells[0].focus();
                            showToast('Press Ctrl+V to paste');
                        } else {
                            showToast('Select a single cell to paste');
                        }
                    }
                },
                {
                    label: `Delete (${selectedCells.length} cells)`,
                    action: () => {
                        selectedCells.forEach(cell => cell.textContent = '');
                        showToast('Deleted ' + selectedCells.length + ' cells');
                    }
                },
                {
                    label: `Clear selection`,
                    action: () => {
                        selectedCells.forEach(cell => cell.classList.remove('selected'));
                        selectedCells = [];
                        showToast('Selection cleared');
                    }
                }
            ];
            
            // Add items to menu
            items.forEach(item => {
                const menuItem = document.createElement('div');
                menuItem.textContent = item.label;
                menuItem.style.cssText = `
                    padding: 8px 20px;
                    cursor: pointer;
                    font-size: 14px;
                `;
                
                // Hover effect
                menuItem.addEventListener('mouseover', () => {
                    menuItem.style.backgroundColor = '#f0f0f0';
                });
                menuItem.addEventListener('mouseout', () => {
                    menuItem.style.backgroundColor = 'white';
                });
                
                // Click handler
                menuItem.addEventListener('click', () => {
                    item.action();
                    document.body.removeChild(menu);
                });
                
                menu.appendChild(menuItem);
            });
            
            // Add menu to document
            document.body.appendChild(menu);
            
            // Calculate optimal position to ensure menu is visible
            const menuRect = menu.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Start with the clicked position
            let left = e.pageX;
            let top = e.pageY;
            
            // Check right edge
            if (left + menuRect.width > viewportWidth - 10) {
                left = viewportWidth - menuRect.width - 10;
            }
            
            // Check bottom edge
            if (top + menuRect.height > viewportHeight - 10) {
                top = viewportHeight - menuRect.height - 10;
            }
            
            // Ensure not positioned too far left or top
            left = Math.max(10, left);
            top = Math.max(10, top);
            
            // Apply calculated position
            menu.style.left = `${left}px`;
            menu.style.top = `${top}px`;
            
            // Close menu when clicking outside
            document.addEventListener('mousedown', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    if (document.body.contains(menu)) {
                        document.body.removeChild(menu);
                    }
                    document.removeEventListener('mousedown', closeMenu);
                }
            });
        });
        
        // Attach events directly to table
        table.addEventListener('mousedown', handleMouseDown);
        table.addEventListener('mouseover', handleMouseOver);
        document.addEventListener('mouseup', handleMouseUp);
        table.addEventListener('dblclick', handleDoubleClick);
        table.addEventListener('keydown', handleKeyDown);
        
        // Provide a test function
        window.testSelection = function() {
            console.log('Test selection - selected cells:', selectedCells.length);
            
            // Try to manually select the first cell
            try {
                if (table.tBodies && table.tBodies[0] && table.tBodies[0].rows[0]) {
                    const cell = table.tBodies[0].rows[0].cells[0];
                    if (cell) {
                        // Clear existing selection
                        selectedCells.forEach(c => c.classList.remove('selected'));
                        selectedCells = [];
                        
                        // Select this cell
                        cell.classList.add('selected');
                        selectedCells.push(cell);
                        console.log('Selected first cell');
                        
                        return true;
                    }
                }
            } catch (error) {
                console.error('Error in test selection:', error);
            }
            
            return false;
        };
        
        // Return cleanup function
        return function cleanup() {
            table.removeEventListener('mousedown', handleMouseDown);
            table.removeEventListener('mouseover', handleMouseOver);
            document.removeEventListener('mouseup', handleMouseUp);
            table.removeEventListener('dblclick', handleDoubleClick);
            table.removeEventListener('keydown', handleKeyDown);
            
            // Clear any remaining selections
            selectedCells.forEach(cell => cell.classList.remove('selected'));
            selectedCells = [];
        };
    }
}

/**
 * Show prompt for invalid values that could be added to options
 * @param {Object} invalidValues - Object with column IDs as keys and Sets of invalid values as values
 * @param {Array} newStaffMembers - Array of new staff members to add
 * @param {Function} onClose - Function to call when the dialog is closed
 */
function showInvalidValuesPrompt(invalidValues, newStaffMembers, onClose) {
    // Create modal for prompt
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    
    const invalidColumns = Object.keys(invalidValues);
    
    const modal = document.createElement('div');
    modal.className = 'page-modal'; // Change from 'modal' to 'page-modal'
    modal.innerHTML = `
        <div class="modal-header">
            <h2>New Values Detected</h2>
            <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
            <p>The following new values were detected. Would you like to add them to the available options?</p>
            <p class="mb-1"><small>Note: Values with commas are automatically split into separate options.</small></p>
            
            <div class="invalid-values-container">
                ${invalidColumns.map(columnId => {
                    const column = columns.find(col => col.id === columnId);
                    const values = Array.from(invalidValues[columnId]);
                    
                    return `
                        <div class="invalid-value-group mb-1">
                            <h3>${column ? column.name : columnId}</h3>
                            <div class="invalid-values-list">
                                ${values.map(value => `
                                    <div class="invalid-value-item">
                                        <label>
                                            <input type="checkbox" name="add-${columnId}" value="${value}" checked>
                                            <span>${value}</span>
                                        </label>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div class="form-actions mt-1">
                <button id="cancel-add-values" class="button button-secondary">Cancel</button>
                <button id="add-values" class="button">Add Selected Values</button>
            </div>
        </div>
    `;
    
    // Add custom styles for invalid values prompt
    if (!document.getElementById('invalid-values-styles')) {
        const style = document.createElement('style');
        style.id = 'invalid-values-styles';
        style.textContent = `
            .invalid-values-container {
                max-height: 60vh;
                overflow-y: auto;
            }
            .invalid-value-group {
                margin-bottom: 16px;
            }
            .invalid-values-list {
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 8px;
                max-height: 150px;
                overflow-y: auto;
            }
            .invalid-value-item {
                padding: 4px 0;
            }
            .invalid-value-item label {
                display: flex;
                align-items: center;
                cursor: pointer;
            }
            .invalid-value-item input {
                margin-right: 8px;
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => closeInvalidModal(false));
    modal.querySelector('#cancel-add-values').addEventListener('click', () => closeInvalidModal(false));
    modal.querySelector('#add-values').addEventListener('click', () => closeInvalidModal(true));
    
    /**
     * Close the invalid values modal
     * @param {boolean} addValues - Whether to add the selected values to options
     */
    function closeInvalidModal(addValues) {
        if (addValues) {
            // Add selected values to options
            invalidColumns.forEach(columnId => {
                const column = columns.find(col => col.id === columnId);
                if (column && column.options) {
                    // Get all checked values
                    const checkboxes = modal.querySelectorAll(`input[name="add-${columnId}"]:checked`);
                    checkboxes.forEach(checkbox => {
                        const value = checkbox.value;
                        if (!column.options.includes(value)) {
                            column.options.push(value);
                            
                            // Update Models based on column ID
                            if (columnId === 'phase') {
                                Models.Staff.phaseOptions.push(value);
                            } else if (columnId === 'overseas_thai') {
                                Models.Staff.overseasThaiOptions.push(value);
                            } else if (columnId === 'year_group') {
                                Models.Staff.yearGroupOptions.push(value);
                            } else if (columnId === 'department') {
                                Models.Staff.departmentOptions.push(value);
                            }
                        }
                    });
                }
            });
            
            // Save updated options
            saveModelOptions();
        }
        
        // Add all staff members
        addNewStaffMembers(newStaffMembers);
        
        // Close the modal
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
        
        // Call the original onClose function
        if (onClose) onClose();
    }
}

/**
 * Add multiple new staff members to the data
 * @param {Array} staffMembers - Array of staff member objects to add
 */
function addNewStaffMembers(staffMembers) {
    if (!staffMembers.length) return;
    
    // Add all staff members to the data
    staffData.push(...staffMembers);
    filteredData.push(...staffMembers);
    
    // Save to storage
    Storage.save('staff', staffData);
    Logger.log(`Added ${staffMembers.length} new staff members`);
    
    // Navigate to the last page
    currentPage = Math.ceil(filteredData.length / rowsPerPage);
    
    // Re-render the table
    renderTable();
    renderPagination();
} 

/**
 * Load custom classifications from storage
 */
function loadCustomClassifications() {
    customClassifications = Storage.load('custom_classifications', []);
    let columnsModified = false;
    
    // First, remove any custom classifications that exist in columns but are no longer in customClassifications
    const customColumnIds = customClassifications.map(cc => cc.id);
    const toRemove = columns.filter(col => col.isCustom && !customColumnIds.includes(col.id));
    
    if (toRemove.length > 0) {
        // Remove these columns
        Logger.log(`Removing ${toRemove.length} obsolete custom classifications`);
        toRemove.forEach(col => {
            Logger.log(` - Removing ${col.name} (${col.id})`);
            const colIndex = columns.findIndex(c => c.id === col.id);
            if (colIndex !== -1) {
                columns.splice(colIndex, 1);
                columnsModified = true;
            }
        });
    }
    
    // Then add any new custom classifications
    const missingClassifications = customClassifications.filter(cc => !columns.some(col => col.id === cc.id));
    if (missingClassifications.length > 0) {
        Logger.log(`Adding ${missingClassifications.length} missing custom classifications`);
    }
    
    customClassifications.forEach(classification => {
        // Check if column already exists
        if (!columns.find(col => col.id === classification.id)) {
            Logger.log(` - Adding ${classification.name} (${classification.id})`);
            
            // Find the index of the actions column to insert before it
            const actionsIndex = columns.findIndex(col => col.id === 'actions');
            const newColumn = {
                id: classification.id,
                name: classification.name,
                type: 'dropdown',
                width: '15%',
                options: classification.options || [],
                visible: true,
                sortable: true,
                isCustom: true
            };
            
            if (actionsIndex !== -1) {
                // Insert before the actions column
                columns.splice(actionsIndex, 0, newColumn);
            } else {
                // Fallback - just append to the end
                columns.push(newColumn);
            }
            
            columnsModified = true;
        }
        
        // Also ensure existing column has up-to-date options
        const existingCol = columns.find(col => col.id === classification.id);
        if (existingCol && JSON.stringify(existingCol.options) !== JSON.stringify(classification.options)) {
            Logger.log(` - Updating options for ${classification.name} (${classification.id})`);
            existingCol.options = [...classification.options];
            columnsModified = true;
        }
    });
    
    // Save columns if modified
    if (columnsModified) {
        Logger.log('Saving updated columns after customClassifications sync');
        Storage.save('masterlog_columns', columns);
    }
}

/**
 * Save custom classifications to storage
 */
function saveCustomClassifications() {
    Storage.save('custom_classifications', customClassifications);
    Logger.log('Saved custom classifications');
}

/**
 * Show modal to add a new classification
 */
function showAddClassificationModal() {
    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'page-modal';
    modal.innerHTML = `
        <div class="modal-header">
            <h2>Add New Classification</h2>
            <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
            <p>Add a new classification field for staff members.</p>
            
            <div class="form-group">
                <label for="classification-name">Classification Name:</label>
                <input type="text" id="classification-name" class="form-control" placeholder="e.g., Certification, Location, etc." required>
            </div>
            
            <div class="form-group">
                <label for="classification-options">Initial Options:</label>
                <textarea id="classification-options" class="form-control" rows="4" placeholder="Enter options, one per line"></textarea>
                <p class="help-text"><small>These can be edited later with the gear icon in the table header.</small></p>
            </div>
            
            <div class="form-actions mt-1">
                <button id="add-classification" class="button">Add Classification</button>
                <button id="cancel-classification" class="button button-secondary">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('#cancel-classification').addEventListener('click', closeModal);
    modal.querySelector('#add-classification').addEventListener('click', addClassification);
    
    // Focus the name input
    setTimeout(() => {
        document.getElementById('classification-name').focus();
    }, 100);
    
    function closeModal() {
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
    }
    
    function addClassification() {
        const nameInput = document.getElementById('classification-name');
        const optionsInput = document.getElementById('classification-options');
        
        // Validate inputs
        const name = nameInput.value.trim();
        const optionsText = optionsInput.value.trim();
        
        if (!name) {
            alert('Please enter a name for the classification.');
            nameInput.focus();
            return;
        }
        
        // Create an ID from the name (lowercase, no spaces)
        const id = `custom_${name.toLowerCase().replace(/\s+/g, '_')}`;
        
        // Check if ID already exists
        if (columns.find(col => col.id === id)) {
            alert(`A classification with a similar name already exists. Please choose a different name.`);
            nameInput.focus();
            return;
        }
        
        if (!optionsText) {
            alert('Please enter at least one option.');
            optionsInput.focus();
            return;
        }
        
        // Parse options (one per line)
        const options = optionsText.split('\n')
            .map(opt => opt.trim())
            .filter(opt => opt); // Remove empty strings
        
        if (options.length === 0) {
            alert('Please enter at least one option.');
            optionsInput.focus();
            return;
        }
        
        // Create new column
        const newColumn = {
            id: id,
            name: name,
            type: 'dropdown',
            options: options,
            width: '15%',
            visible: true,
            sortable: true,
            isCustom: true
        };
        
        // Add to custom classifications
        customClassifications.push({
            id: id,
            name: name,
            options: options
        });
        saveCustomClassifications();
        
        // Add to columns at the right position (before actions column)
        const actionsIndex = columns.findIndex(col => col.id === 'actions');
        
        if (actionsIndex !== -1) {
            // Insert before the actions column
            columns.splice(actionsIndex, 0, newColumn);
        } else {
            // Fallback - just append to the end
            columns.push(newColumn);
        }
        
        // Initialize staff data with the new field
        staffData.forEach(staff => {
            if (!staff[id]) {
                staff[id] = '';
            }
        });
        Storage.save('staff', staffData);
        
        // Re-render components
        renderTableHeader();
        renderTable();
        
        // Force complete rebuild of filter system with the new column
        initializeFilterSystem();
        
        // Close modal
        closeModal();
        
        Logger.log(`Added new classification: ${name}`);
    }
}
