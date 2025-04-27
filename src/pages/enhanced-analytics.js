/**
 * Enhanced Analytics Page
 * Implements a dynamic, reusable chart generation system with live-updating charts,
 * consistent filtering, and interactive features
 */
import { Storage, Logger, Models, FilterSystem, ChartSystem, DrilldownFilterSystem } from '../utils/index.js';

// State management
let staffData = [];
let standardsData = [];
let groupsData = [];
let assignmentsData = [];
let filterSystem = null;
let drilldownFilterSystem = null;
let isSplitView = false;

// Configuration options
const config = {
    // Set to true to show filter testing panel
    showFilterTestPanel: true
};

/**
 * Initialize the Enhanced Analytics page
 * @param {HTMLElement} container - Container element for the page
 */
export function init(container) {
    Logger.log('Initializing Enhanced Analytics page');
    
    // Load data
    staffData = Storage.load('staff', []);
    standardsData = Storage.load('standards', []);
    groupsData = Storage.load('groups', []);
    assignmentsData = Storage.load('assignments', []);
    
    // Create page structure
    container.innerHTML = `
        <div class="enhanced-analytics-page content-container">
            <h1>Enhanced Analytics Dashboard</h1>
            <div class="example-data-container">
                <button id="load-example-data" class="button button-success">
                    <i class="fas fa-database"></i> Load Example Data
                </button>
                <button id="remove-example-data" class="button button-danger">
                    <i class="fas fa-trash-alt"></i> Remove Example Data
                </button>
                <small class="example-data-note">For testing and demonstration purposes only</small>
            </div>
            
            <div id="filter-section" class="filter-section mb-2"></div>
            
            <div class="analytics-main-content">
                <div class="standards-sidebar">
                    <div class="sidebar-header">
                        <h3>Standards</h3>
                        <p class="sidebar-info">Select standards to include in charts</p>
                    </div>
                    <div class="standards-tree" id="standards-tree">
                        <!-- Standards tree will be rendered here -->
                        <div class="loading-indicator">Loading standards...</div>
                    </div>
                    <div class="tree-controls mt-1">
                        <button id="select-all-standards" class="button button-small">Select All</button>
                        <button id="deselect-all-standards" class="button button-small button-secondary">Deselect All</button>
                    </div>
                </div>
                
                <div class="charts-content">
                    <div class="interactive-filters mb-2">
                        <h3>Interactive Filters</h3>
                        <div id="drilldown-filter-container" class="drilldown-filter-container"></div>
                    </div>
                    
                    <div class="charts-section">
                        <div class="chart-controls mb-1">
                            <button id="add-chart-btn" class="button">
                                <i class="fas fa-plus"></i> Create New Chart
                            </button>
                            <button id="open-saved-btn" class="button button-secondary">
                                <i class="fas fa-folder-open"></i> Open Saved Charts
                            </button>
                            <div class="chart-view-toggle">
                                <label class="toggle-switch">
                                    <input type="checkbox" id="split-standards-toggle">
                                    <span class="toggle-slider"></span>
                                </label>
                                <span class="toggle-label">Total View</span>
                            </div>
                        </div>
                        
                        <div id="main-chart-container" class="main-chart-container">
                            <!-- Main chart will be rendered here -->
                        </div>
                        
                        <div id="staff-data-container" class="staff-data-container mt-2">
                            <!-- Staff data table will be rendered here -->
                        </div>
                        
                        <div id="timeline-container" class="timeline-container mt-2">
                            <!-- Timeline of minimized charts will be rendered here -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <style>
            /* Styles for lazy-loaded charts */
            .main-chart-container {
                max-height: 600px;
                overflow-y: auto;
                overflow-x: hidden;
                position: relative;
            }
            
            .chart-wrapper {
                padding-bottom: 20px;
            }
            
            /* Loading indicator for lazy loading */
            .load-more-indicator {
                text-align: center;
                padding: 10px;
                margin-top: 5px;
                font-style: italic;
                color: #666;
            }
            
            /* Improve data-reference-selector appearance */
            .data-reference-selector {
                margin-right: 10px;
                display: flex;
                align-items: center;
            }
            
            .data-reference-selector select {
                min-width: 180px;
                max-width: 220px;
                font-size: 14px;
                padding: 4px 8px;
            }
            
            /* Make sure charts with lots of data are visible */
            canvas.chart-canvas {
                min-height: 300px;
                height: auto !important;
            }
            
            /* When many labels are present, add special styling */
            .many-labels .chart-wrapper {
                padding-bottom: 200px;
            }
        </style>
    `;
    
    // Include Font Awesome for icons
    loadFontAwesome();
    
    // Include Chart.js from CDN
    loadChartJsCDN();
    
    // Initialize filter system
    initFilterSystem();
    
    // Initialize the drill-down filter system
    initDrilldownFilterSystem();
    
    // Initialize the standards tree
    initStandardsTree();
    
    // Initialize chart system
    initChartSystem();
    
    // Add event listeners
    document.getElementById('add-chart-btn').addEventListener('click', showCreateChartDialog);
    document.getElementById('open-saved-btn').addEventListener('click', showOpenChartDialog);
    document.getElementById('select-all-standards').addEventListener('click', selectAllStandards);
    document.getElementById('deselect-all-standards').addEventListener('click', deselectAllStandards);
    document.getElementById('split-standards-toggle').addEventListener('change', handleSplitViewToggle);
    document.getElementById('load-example-data').addEventListener('click', loadExampleData);
    document.getElementById('remove-example-data').addEventListener('click', removeExampleData);
    
    // Set up cleanup for when navigating away
    window.addEventListener('beforeunload', cleanup);
}

/**
 * Clean up resources when navigating away from the page
 */
export function cleanup() {
    // Clean up chart system
    if (ChartSystem && ChartSystem.cleanup) {
        ChartSystem.cleanup();
    }
    
    // Remove global event listeners
    window.removeEventListener('beforeunload', cleanup);
    
    // Clear any global references
    window.changeChartDataCategory = null;
    
    // Log cleanup
    Logger.log('Enhanced Analytics page cleanup complete');
}

/**
 * Load Font Awesome from CDN
 */
function loadFontAwesome() {
    // Check if Font Awesome is already loaded
    if (document.querySelector('link[href*="fontawesome"]')) {
        return;
    }
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
    link.integrity = 'sha512-1ycn6IcaQQ40/MKBW2W4Rhis/DbILU74C1vSrLJxCq57o941Ym01SwNsOMqvEBFlcgUa6xLiPY/NS5R+E6ztJQ==';
    link.crossOrigin = 'anonymous';
    
    document.head.appendChild(link);
}

/**
 * Load Chart.js from CDN
 */
function loadChartJsCDN() {
    // Check if Chart.js is already loaded
    if (window.Chart) {
        return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js';
    script.integrity = 'sha256-ErZ09KkZnzjpqcane4SCyyHsKAXMvID9/xwbl/Aq1pc=';
    script.crossOrigin = 'anonymous';
    
    script.onload = () => {
        Logger.log('Chart.js loaded successfully');
    };
    
    script.onerror = () => {
        Logger.error('Failed to load Chart.js');
        alert('Failed to load chart library. Please check your internet connection.');
    };
    
    document.head.appendChild(script);
}

/**
 * Initialize filter system and ensure stylesheet is loaded
 */
function initFilterSystem() {
    // Ensure the filter styles are loaded
    ensureFilterStylesLoaded();
    
    // Get dynamic filters based on custom classifications
    const customFilters = buildDynamicFilters();
    
    // Create filter system instance
    filterSystem = new FilterSystem({
        filterSection: document.getElementById('filter-section'),
        onFilterChange: handleFilterChange,
        staffData: staffData,
        standardsData: standardsData,
        // Specify to only include staff filters (not standards filters)
        includeStandardsFilters: false,
        // Use the dynamic filters that include custom classifications
        customFilters: customFilters
    });
    
    Logger.log('Enhanced Analytics filter system initialized with custom classifications');
}

/**
 * Ensure filter styles are loaded
 */
function ensureFilterStylesLoaded() {
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
 * Initialize the drill-down filter system
 */
function initDrilldownFilterSystem() {
    // Get dynamic filter fields based on current available columns
    const filterFields = getDynamicFilterFields();
    
    // If no data is loaded, generate sample data
    if (staffData.length === 0) {
        Logger.log('No staff data found, loading example data');
        const sampleData = generateSampleData();
        staffData = sampleData.staff;
        standardsData = sampleData.standards;
        groupsData = sampleData.groups;
        assignmentsData = sampleData.assignments;
        
        // Save to storage
        Storage.save('staff', staffData);
        Storage.save('standards', standardsData);
        Storage.save('groups', groupsData);
        Storage.save('assignments', assignmentsData);
        
        // Update filter system
        if (filterSystem) {
            filterSystem.updateData({
                staffData: staffData,
                standardsData: standardsData
            });
        }
    }
    
    // Get container element
    const drilldownContainer = document.getElementById('drilldown-filter-container');
    
    if (!drilldownContainer) {
        Logger.error('Drill-down filter container not found');
        return;
    }
    
    console.log('Drill-down container found, initializing filter system', drilldownContainer);
    
    // Create and reset container to ensure clean state
    drilldownContainer.innerHTML = '<div class="drill-down-container-wrapper"></div>';
    const wrapper = drilldownContainer.querySelector('.drill-down-container-wrapper');
    
    if (!wrapper) {
        Logger.error('Failed to create wrapper element');
        return;
    }
    
    // Create drill-down filter system instance
    try {
        drilldownFilterSystem = new DrilldownFilterSystem({
            container: wrapper,
            staffData: staffData,
            filterFields: filterFields,
            onFilterChange: handleDrilldownFilterChange,
            filterSystem: filterSystem  // Pass reference to main filter system
        });
        Logger.log('Drill-down filter system initialized successfully');
    } catch (error) {
        Logger.error(`Failed to initialize drill-down filter system: ${error.message}`);
        console.error('Error details:', error);
    }
}

/**
 * Get dynamic filter fields based on current available columns
 * @returns {Array} Array of filter field objects
 */
function getDynamicFilterFields() {
    // Get all filter fields from the buildDynamicFilters function
    const filters = buildDynamicFilters();
    
    // Create a list of all fields from staff and classification filters
    const staffFields = filters.staff.map(field => ({
        id: field.id,
        name: field.name
    }));
    
    const classificationFields = filters.classification.map(field => ({
        id: field.id,
        name: field.name
    }));
    
    // Combine all fields
    return [...staffFields, ...classificationFields];
}

/**
 * Handle changes from the drill-down filter system
 * @param {Array} filteredStaff - Filtered staff data
 */
function handleDrilldownFilterChange(filteredStaff) {
    // Find active chart and its current data category
    const activeChartContainer = document.querySelector('.chart-wrapper');
    let chartId = null;
    
    if (activeChartContainer) {
        const chartActionButtons = activeChartContainer.querySelectorAll('.chart-actions button');
        if (chartActionButtons && chartActionButtons.length > 0) {
            chartId = chartActionButtons[0].dataset.chartId;
        }
    }
    
    // If we have a chart ID, get its configuration to preserve category
    let chartDataCategory = null;
    if (chartId) {
        const chartConfigs = ChartSystem.getChartConfigurations();
        const chartConfig = chartConfigs.find(c => c.id === chartId);
        if (chartConfig && chartConfig.dataCategory) {
            chartDataCategory = chartConfig.dataCategory;
            Logger.log(`Preserving chart data category during drilldown: ${chartDataCategory}`);
        }
    }
    
    // Get existing filtered standards from the main filter system
    const filteredData = filterSystem.getFilteredData();
    const filteredStandards = filteredData.filteredStandards;
    
    // Update the chart with filtered data, preserving data category
    updateActiveChartWithFilteredData({
        filteredStaff: filteredStaff,
        filteredStandards: filteredStandards,
        currentFilter: filteredData.currentFilter,
        chartDataCategory: chartDataCategory // Pass category to preserve
    });
    
    // Update staff data table
    renderStaffDataTable(filteredStaff);
}

/**
 * Initialize the standards tree
 */
function initStandardsTree() {
    const treeContainer = document.getElementById('standards-tree');
    
    if (!treeContainer) return;
    
    // Add search box above the tree
    const searchContainer = document.createElement('div');
    searchContainer.className = 'standards-search-container mb-2';
    searchContainer.innerHTML = `
        <div class="search-input-container">
            <input type="text" id="standards-search" class="standards-search" placeholder="Search standards...">
            <button id="clear-search" class="clear-search-btn" style="display: none;">&times;</button>
        </div>
    `;
    treeContainer.parentNode.insertBefore(searchContainer, treeContainer);
    
    // Add event listener for search input
    const searchInput = document.getElementById('standards-search');
    const clearButton = document.getElementById('clear-search');
    
    searchInput.addEventListener('input', (event) => {
        const searchTerm = event.target.value.toLowerCase().trim();
        filterStandardsTree(searchTerm);
        
        // Toggle clear button visibility
        clearButton.style.display = searchTerm ? 'block' : 'none';
    });
    
    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        filterStandardsTree('');
        clearButton.style.display = 'none';
        searchInput.focus();
    });
    
    // Build a hierarchical structure from flat standards array
    const standardsTree = buildStandardsTree(standardsData);
    
    // Group standards by their groups
    const standardsByGroup = {};
    const ungroupedStandards = [];
    
    // Organize top-level standards by groups
    Object.values(standardsTree).forEach(standard => {
        if (!standard.parent_code) { // Top-level standards only
            if (standard.group) {
                if (!standardsByGroup[standard.group]) {
                    standardsByGroup[standard.group] = [];
                }
                standardsByGroup[standard.group].push(standard);
            } else {
                ungroupedStandards.push(standard);
            }
        }
    });
    
    // Sort groups alphabetically
    const sortedGroups = Object.keys(standardsByGroup).sort();
    
    // Generate tree HTML
    let treeHtml = '<ul class="tree-root">';
    
    // Add grouped standards
    sortedGroups.forEach(group => {
        const topLevelStandards = standardsByGroup[group];
        
        treeHtml += `
            <li class="tree-group">
                <div class="tree-group-header">
                    <span class="tree-toggle">-</span>
                    <span class="tree-group-name">${group}</span>
                    <label class="checkbox-container">
                        <input type="checkbox" class="group-checkbox" data-group="${group}" checked>
                        <span class="checkmark"></span>
                    </label>
                </div>
                <ul class="tree-children">
        `;
        
        // Add standards in this group with their hierarchy
        topLevelStandards.forEach(standard => {
            treeHtml += renderStandardNode(standard, standardsTree);
        });
        
        treeHtml += '</ul></li>';
    });
    
    // Add ungrouped standards
    if (ungroupedStandards.length > 0) {
        treeHtml += `
            <li class="tree-group">
                <div class="tree-group-header">
                    <span class="tree-toggle">-</span>
                    <span class="tree-group-name">Ungrouped Standards</span>
                    <label class="checkbox-container">
                        <input type="checkbox" class="group-checkbox" data-group="ungrouped" checked>
                        <span class="checkmark"></span>
                    </label>
                </div>
                <ul class="tree-children">
        `;
        
        ungroupedStandards.forEach(standard => {
            treeHtml += renderStandardNode(standard, standardsTree);
        });
        
        treeHtml += '</ul></li>';
    }
    
    treeHtml += '</ul>';
    
    // Set the tree HTML
    treeContainer.innerHTML = treeHtml;
    
    // Add event listeners for tree toggles
    treeContainer.querySelectorAll('.tree-toggle').forEach(toggle => {
        toggle.addEventListener('click', (event) => {
            const groupHeader = event.target.closest('.tree-group-header, .tree-item-content');
            const treeChildren = groupHeader.nextElementSibling;
            
            if (treeChildren && treeChildren.classList.contains('tree-children') || treeChildren.classList.contains('tree-item-children')) {
                if (treeChildren.style.display === 'none') {
                    treeChildren.style.display = 'block';
                    toggle.textContent = '-';
                } else {
                    treeChildren.style.display = 'none';
                    toggle.textContent = '+';
                }
            }
        });
    });
    
    // Add event listeners for group checkboxes
    treeContainer.querySelectorAll('.group-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (event) => {
            const group = event.target.dataset.group;
            const isChecked = event.target.checked;
            const treeGroup = event.target.closest('.tree-group');
            
            // Update all standards in this group
            treeGroup.querySelectorAll('.standard-checkbox').forEach(standardCheckbox => {
                standardCheckbox.checked = isChecked;
            });
            
            // Update charts based on selected standards
            updateChartsBasedOnSelectedStandards();
        });
    });
    
    // Add event listeners for standard checkboxes
    treeContainer.querySelectorAll('.standard-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            // Update charts based on selected standards
            updateChartsBasedOnSelectedStandards();
            
            // Update parent group checkbox based on children
            const treeItem = checkbox.closest('.tree-item');
            const treeGroup = treeItem.closest('.tree-group');
            const groupCheckbox = treeGroup.querySelector('.group-checkbox');
            const standardCheckboxes = treeGroup.querySelectorAll('.standard-checkbox');
            const allChecked = Array.from(standardCheckboxes).every(cb => cb.checked);
            const anyChecked = Array.from(standardCheckboxes).some(cb => cb.checked);
            
            groupCheckbox.checked = anyChecked;
            groupCheckbox.indeterminate = anyChecked && !allChecked;
            
            // Update parent standard checkbox if this is a child standard
            updateParentCheckboxes(checkbox);
        });
    });
}

/**
 * Build a hierarchical tree from flat standards array
 * @param {Array} standards - Flat array of standards
 * @returns {Object} - Hierarchical structure of standards by code
 */
function buildStandardsTree(standards) {
    // Create a map of standards by code
    const standardsMap = {};
    standards.forEach(standard => {
        standardsMap[standard.code] = { ...standard };
    });
    
    return standardsMap;
}

/**
 * Render a standard node and its children recursively
 * @param {Object} standard - Standard to render
 * @param {Object} standardsMap - Map of all standards by code
 * @returns {string} - HTML for this standard and its children
 */
function renderStandardNode(standard, standardsMap) {
    // Check if standard has children
    const hasChildren = Array.isArray(standard.children) && standard.children.length > 0;
    
    // Create HTML for this standard
    let html = `
        <li class="tree-item" data-code="${standard.code}">
            <div class="tree-item-content">
                ${hasChildren ? '<span class="tree-toggle">-</span>' : '<span class="tree-toggle-placeholder"></span>'}
                <span class="tree-item-name">${standard.code}: ${standard.name}</span>
                <label class="checkbox-container">
                    <input type="checkbox" class="standard-checkbox" data-code="${standard.code}" checked>
                    <span class="checkmark"></span>
                </label>
            </div>
    `;
    
    // Add children if any
    if (hasChildren) {
        html += `<ul class="tree-item-children">`;
        
        standard.children.forEach(childCode => {
            const childStandard = standardsMap[childCode];
            if (childStandard) {
                html += renderStandardNode(childStandard, standardsMap);
            }
        });
        
        html += `</ul>`;
    }
    
    html += `</li>`;
    
    return html;
}

/**
 * Update parent checkbox states based on child selections
 * @param {HTMLElement} checkbox - Child checkbox that was changed
 */
function updateParentCheckboxes(checkbox) {
    const treeItem = checkbox.closest('.tree-item');
    const parentTreeItem = treeItem.parentElement.closest('.tree-item');
    
    if (parentTreeItem) {
        const parentCheckbox = parentTreeItem.querySelector('.standard-checkbox');
        const siblingCheckboxes = Array.from(
            treeItem.parentElement.querySelectorAll(':scope > .tree-item > .tree-item-content > .checkbox-container > .standard-checkbox')
        );
        
        const allChecked = siblingCheckboxes.every(cb => cb.checked);
        const anyChecked = siblingCheckboxes.some(cb => cb.checked);
        
        parentCheckbox.checked = anyChecked;
        parentCheckbox.indeterminate = anyChecked && !allChecked;
        
        // Recursively update parents
        updateParentCheckboxes(parentCheckbox);
    }
}

/**
 * Filter standards tree based on search term
 * @param {string} searchTerm - Term to search for
 */
function filterStandardsTree(searchTerm) {
    const treeGroups = document.querySelectorAll('.tree-group');
    
    if (!searchTerm) {
        // If no search term, show all groups but keep them collapsed
        treeGroups.forEach(group => {
            group.style.display = 'block';
            const items = group.querySelectorAll('.tree-item');
            items.forEach(item => item.style.display = 'block');
        });
        return;
    }
    
    // Process each group
    treeGroups.forEach(group => {
        const items = group.querySelectorAll('.tree-item');
        let hasVisibleItems = false;
        
        // Check each item in this group
        items.forEach(item => {
            const itemText = item.querySelector('.tree-item-name').textContent.toLowerCase();
            const itemVisible = itemText.includes(searchTerm);
            
            item.style.display = itemVisible ? 'block' : 'none';
            
            if (itemVisible) {
                hasVisibleItems = true;
            }
        });
        
        // Show/hide the group based on whether it has visible items
        group.style.display = hasVisibleItems ? 'block' : 'none';
        
        // If group has visible items, expand it
        if (hasVisibleItems) {
            const treeChildren = group.querySelector('.tree-children');
            const toggleIcon = group.querySelector('.tree-toggle');
            
            if (treeChildren) {
                treeChildren.style.display = 'block';
                toggleIcon.textContent = '-';
            }
        }
    });
}

/**
 * Select all standards in the tree
 */
function selectAllStandards() {
    document.querySelectorAll('.standard-checkbox, .group-checkbox').forEach(checkbox => {
        checkbox.checked = true;
        checkbox.indeterminate = false;
    });
    
    updateChartsBasedOnSelectedStandards();
}

/**
 * Deselect all standards in the tree
 */
function deselectAllStandards() {
    document.querySelectorAll('.standard-checkbox, .group-checkbox').forEach(checkbox => {
        checkbox.checked = false;
        checkbox.indeterminate = false;
    });
    
    updateChartsBasedOnSelectedStandards();
}

/**
 * Update charts based on selected standards
 */
function updateChartsBasedOnSelectedStandards() {
    // Get selected standard codes
    const selectedStandards = [];
    document.querySelectorAll('.standard-checkbox:checked').forEach(checkbox => {
        selectedStandards.push(checkbox.dataset.code);
    });
    
    // Filter standards data
    const filteredStandards = standardsData.filter(standard => 
        selectedStandards.includes(standard.code)
    );
    
    // Find active chart and its current data category
    const activeChartContainer = document.querySelector('.chart-wrapper');
    let chartId = null;
    
    if (activeChartContainer) {
        const chartActionButtons = activeChartContainer.querySelectorAll('.chart-actions button');
        if (chartActionButtons && chartActionButtons.length > 0) {
            chartId = chartActionButtons[0].dataset.chartId;
        }
    }
    
    // If we have a chart ID, get its configuration to preserve category
    let chartDataCategory = null;
    if (chartId) {
        const chartConfigs = ChartSystem.getChartConfigurations();
        const chartConfig = chartConfigs.find(c => c.id === chartId);
        if (chartConfig && chartConfig.dataCategory) {
            chartDataCategory = chartConfig.dataCategory;
            Logger.log(`Preserving chart data category during standards selection: ${chartDataCategory}`);
        }
    }
    
    // Get the current filtered data with all other filters applied
    const currentFilteredData = filterSystem.getFilteredData();
    
    // Create a combined filtered data object
    const combinedFilteredData = {
        filteredStaff: currentFilteredData.filteredStaff,
        filteredStandards: filteredStandards,
        currentFilter: currentFilteredData.currentFilter,
        chartDataCategory: chartDataCategory // Pass category to preserve
    };
    
    // Update the standards count display
    updateStandardsCountDisplay(selectedStandards.length);
    
    // Call filter change handler to update charts
    handleFilterChange(combinedFilteredData);
    
    Logger.log(`Updated charts with ${selectedStandards.length} selected standards`);
}

/**
 * Initialize chart system
 */
function initChartSystem() {
    // Once Chart.js is loaded, initialize the chart system
    const checkChartLoaded = setInterval(() => {
        if (window.Chart) {
            clearInterval(checkChartLoaded);
            
            // Register the custom plugin for lazy loading
            Chart.register({
                id: 'lazyLoad',
                afterRender: function(chart) {
                    const lazyLoadPlugin = chart.options.plugins.lazyLoad;
                    if (!lazyLoadPlugin || !lazyLoadPlugin.enabled) return;
                    
                    // Add scroll event listener to the chart canvas for lazy loading
                    if (!chart.canvas._lazyScrollHandlerRegistered) {
                        const scrollHandler = function() {
                            // First, ensure chart and canvas still exist in the DOM
                            if (!chart || !chart.canvas || !document.body.contains(chart.canvas)) {
                                // If the canvas has been removed, clean up event listeners
                                window.removeEventListener('scroll', scrollHandler);
                                const chartContainer = chart.canvas?._scrollContainer;
                                if (chartContainer) {
                                    chartContainer.removeEventListener('scroll', scrollHandler);
                                }
                                return;
                            }
                            
                            try {
                                const rect = chart.canvas.getBoundingClientRect();
                                const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
                                
                                if (isVisible) {
                                    // If the user has scrolled to the bottom area of the chart, load more data
                                    if (window.scrollY + window.innerHeight > rect.bottom - 100) {
                                        if (lazyLoadPlugin.onScroll && typeof lazyLoadPlugin.onScroll === 'function') {
                                            lazyLoadPlugin.onScroll(chart);
                                        }
                                    }
                                }
                            } catch (error) {
                                // If there's any error, remove the scroll handler
                                console.warn('Error in scroll handler, removing listener:', error);
                                window.removeEventListener('scroll', scrollHandler);
                                const chartContainer = chart.canvas?._scrollContainer;
                                if (chartContainer) {
                                    chartContainer.removeEventListener('scroll', scrollHandler);
                                }
                            }
                        };
                        
                        // Add window scroll event listener
                        window.addEventListener('scroll', scrollHandler);
                        
                        // Also trigger on chart scroll if the chart has a scrollable container
                        const chartContainer = chart.canvas.closest('.chart-wrapper');
                        if (chartContainer) {
                            chartContainer.addEventListener('scroll', scrollHandler);
                            // Store reference to container for cleanup
                            chart.canvas._scrollContainer = chartContainer;
                        }
                        
                        // Create cleanup function
                        chart.canvas._cleanupScrollHandlers = function() {
                            window.removeEventListener('scroll', scrollHandler);
                            const container = chart.canvas?._scrollContainer;
                            if (container) {
                                container.removeEventListener('scroll', scrollHandler);
                            }
                            delete chart.canvas._scrollContainer;
                            delete chart.canvas._lazyScrollHandlerRegistered;
                            delete chart.canvas._cleanupScrollHandlers;
                        };
                        
                        // Add destroy callback to chart
                        const originalDestroy = chart.destroy;
                        chart.destroy = function() {
                            if (chart.canvas && chart.canvas._cleanupScrollHandlers) {
                                chart.canvas._cleanupScrollHandlers();
                            }
                            return originalDestroy.apply(this, arguments);
                        };
                        
                        // Mark as registered to avoid duplicate handlers
                        chart.canvas._lazyScrollHandlerRegistered = true;
                    }
                }
            });
            
            ChartSystem.init({
                chartContainer: document.getElementById('main-chart-container'),
                timelineContainer: document.getElementById('timeline-container'),
                onFilterChange: handleFilterChange
            });
            
            // Create default chart
            createDefaultChart();
            
            // Render staff data table
            renderStaffDataTable(filterSystem.getFilteredData().filteredStaff);
            
            // Initialize filter testing panel if enabled
            if (config.showFilterTestPanel) {
                initFilterTesting();
            }
            
            // Add event listener for the chart container to handle data category changes
            document.getElementById('main-chart-container').addEventListener('click', function(e) {
                // Check if the click was on a save chart button
                if (e.target.closest('.save-chart-btn')) {
                    const chartId = e.target.closest('.save-chart-btn').dataset.chartId;
                    showSaveChartDialog(chartId);
                }
            });
            
            // Add event listener for chart container to handle category selector changes
            document.getElementById('main-chart-container').addEventListener('change', function(e) {
                if (e.target.id === 'data-category-selector') {
                    const chartId = e.target.dataset.chartId;
                    const newCategory = e.target.value;
                    changeChartDataCategory(chartId, newCategory);
                }
            });
            
            // Add MutationObserver to add data category selector when a new chart is created
            const chartContainerObserver = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        // Check if the chart header was added
                        const chartHeader = document.querySelector('.chart-header');
                        if (chartHeader && !chartHeader.querySelector('#data-category-selector')) {
                            addDataCategorySelector(chartHeader);
                        }
                    }
                });
            });
            
            chartContainerObserver.observe(document.getElementById('main-chart-container'), { childList: true, subtree: true });
            
            // Final check to ensure data category selector exists
            setTimeout(() => {
                console.log('Final check for Group By selector');
                const chartHeader = document.querySelector('.chart-header');
                if (chartHeader && !chartHeader.querySelector('#data-category-selector')) {
                    console.log('Adding Group By selector in final check');
                    addDataCategorySelector(chartHeader);
                }
            }, 800);
        }
    }, 100);
}

/**
 * Change the data category for a chart and update it
 * @param {String} chartId - ID of the chart to update
 * @param {String} newCategory - New data category to use
 */
function changeChartDataCategory(chartId, newCategory) {
    // Get the filtered data
    const filteredData = filterSystem.getFilteredData();
    
    // Generate new chart data based on the selected category
    let chartData;
    
    if (newCategory === 'auto') {
        chartData = generateChartData(filteredData);
    } else {
        chartData = generateCustomChartData(filteredData, newCategory);
    }
    
    // IMPORTANT: First ensure the category is saved to the config
    // Get existing chart configurations
    const chartConfigs = ChartSystem.getChartConfigurations();
    const chartConfig = chartConfigs.find(c => c.id === chartId);
    if (chartConfig) {
        chartConfig.dataCategory = newCategory;
    }
    
    // Update the chart
    ChartSystem.updateChart(chartId, { 
        data: chartData,
        dataCategory: newCategory
    });
    
    // Update the selector value if it exists
    const categorySelector = document.querySelector(`#data-category-selector`);
    if (categorySelector && categorySelector.value !== newCategory) {
        categorySelector.value = newCategory;
    }
    
    Logger.log(`Changed chart ${chartId} data category to ${newCategory}`);
}

/**
 * Handle filter change event
 * @param {Object} data - Filtered data
 */
function handleFilterChange(data) {
    // Always preserve chart data category if it was provided
    const chartDataCategory = data.chartDataCategory;
    
    // Log filter change with data category info
    Logger.log(`Filter change: ${data.filteredStaff.length} staff, ${data.filteredStandards.length} standards${chartDataCategory ? ', preserving category: ' + chartDataCategory : ''}`);
    
    // Update drill-down filter system with new staff data if available
    if (drilldownFilterSystem) {
        drilldownFilterSystem.updateData(data.filteredStaff);
    }
    
    // Generate or update the active chart with filtered data
    // Pass through the chart data category if it was provided
    updateActiveChartWithFilteredData({
        ...data,
        chartDataCategory: chartDataCategory
    });
    
    // Highlight active filters
    highlightActiveFilters(filterSystem.currentFilter);
    
    // Update standards count display
    updateStandardsCountDisplay(data.filteredStandards.length);
    
    // Render staff data table
    renderStaffDataTable(data.filteredStaff);
}

/**
 * Update standards count display
 * @param {number} count - Number of filtered standards
 */
function updateStandardsCountDisplay(count) {
    const sidebar = document.querySelector('.standards-sidebar');
    if (!sidebar) return;
    
    // Check if count element exists, create if not
    let countElement = sidebar.querySelector('.standards-count');
    if (!countElement) {
        countElement = document.createElement('div');
        countElement.className = 'standards-count';
        sidebar.querySelector('.sidebar-header').appendChild(countElement);
    }
    
    // Update count
    countElement.textContent = `Selected: ${count} standards`;
}

/**
 * Render staff data table with filtered staff
 * @param {Array} filteredStaff - Filtered staff data
 */
function renderStaffDataTable(filteredStaff) {
    const container = document.getElementById('staff-data-container');
    
    if (!container || !filteredStaff) return;
    
    // Get staff achievement counts
    const staffAchievements = calculateStaffAchievements(filteredStaff);
    
    // Get column headers based on staff data and custom classifications
    const columnHeaders = getStaffTableColumns(filteredStaff);
    
    // Create table HTML
    let tableHtml = `
        <h3 class="staff-table-header">Staff Data (${filteredStaff.length})</h3>
        <div class="table-scroll-wrapper">
            <table class="staff-data-table">
                <thead>
                    <tr>
                        ${columnHeaders.map(col => `<th>${col.name}</th>`).join('')}
                        <th>Achievements</th>
                        <th>Completion Rate</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add rows for each staff member
    filteredStaff.forEach(staff => {
        const achievements = staffAchievements[staff.id] || { achieved: 0, total: 0 };
        const completionRate = achievements.total > 0 
            ? Math.round((achievements.achieved / achievements.total) * 100) 
            : 0;
            
        tableHtml += `
            <tr>
                ${columnHeaders.map(col => `<td>${staff[col.id] || '-'}</td>`).join('')}
                <td>${achievements.achieved} / ${achievements.total}</td>
                <td>${completionRate}%</td>
            </tr>
        `;
    });
    
    tableHtml += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = tableHtml;
}

/**
 * Get staff table columns based on available data
 * @param {Array} staffData - Staff data array
 * @returns {Array} Array of column objects with id and name
 */
function getStaffTableColumns(staffData) {
    // Always include these core columns
    const coreColumns = [
        { id: 'name', name: 'Name' },
        { id: 'id', name: 'ID' }
    ];
    
    // Standard classification columns
    const standardColumns = [
        { id: 'phase', name: 'Phase' },
        { id: 'year_group', name: 'Year Group' },
        { id: 'department', name: 'Department' },
        { id: 'overseas_thai', name: 'Overseas/Thai' }
    ];
    
    // Get custom classifications from storage
    const customClassifications = Storage.load('custom_classifications', []);
    const customColumns = customClassifications.map(classification => ({
        id: classification.id,
        name: classification.name
    }));
    
    // Only include columns that actually have data
    const availableColumns = [...coreColumns];
    
    // Check which standard columns have data in at least one staff record
    standardColumns.forEach(col => {
        if (staffData.some(staff => staff[col.id])) {
            availableColumns.push(col);
        }
    });
    
    // Check which custom columns have data in at least one staff record
    customColumns.forEach(col => {
        if (staffData.some(staff => staff[col.id])) {
            availableColumns.push(col);
        }
    });
    
    return availableColumns;
}

/**
 * Calculate achievement counts for each staff member
 * @param {Array} filteredStaff - Filtered staff data
 * @returns {Object} - Object with staff ID as key and achievement counts as value
 */
function calculateStaffAchievements(filteredStaff) {
    const staffIDs = filteredStaff.map(staff => staff.id);
    const filteredStandards = filterSystem.getFilteredData().filteredStandards;
    const standardCodes = filteredStandards.map(standard => standard.code);
    
    // Initialize result object
    const result = {};
    
    // Initialize achievement counts for each staff
    staffIDs.forEach(staffId => {
        result[staffId] = { achieved: 0, total: 0 };
    });
    
    // Count achievements
    for (const staffId of staffIDs) {
        // Total standards applicable to this staff
        result[staffId].total = standardCodes.length;
        
        // Count achieved standards
        for (const standardCode of standardCodes) {
            const assignment = assignmentsData.find(
                a => a.staff_id === staffId && a.standard_code === standardCode
            );
            
            if (assignment && assignment.achieved) {
                result[staffId].achieved += 1;
            }
        }
    }
    
    return result;
}

/**
 * Create a default chart for first-time users
 */
function createDefaultChart() {
    console.log('Creating default chart');
    // Get currently filtered staff and standards
    const filteredData = drilldownFilterSystem.getFilteredStaff();
    const chartData = generateChartData({ 
        filteredStaff: filteredData,
        filteredStandards: standardsData
    });
    
    // Set default chart colors
    const defaultColors = [
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 99, 132, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(255, 159, 64, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 205, 86, 0.8)',
        'rgba(201, 203, 207, 0.8)'
    ];
    
    const chartConfig = {
        id: 'default_chart_' + Date.now(),
        title: 'Standards Achievement Overview',
        type: 'bar',
        data: chartData,
        created: new Date().toISOString(),
        dataCategory: 'auto'
    };
    
    // Add the chart to the system
    ChartSystem.createChart(chartConfig);
    console.log('Default chart created, checking for chart header');
    
    // Add the data category selector to the chart header
    // Use a slightly longer timeout to ensure chart is fully rendered
    setTimeout(() => {
        const chartHeader = document.querySelector('.chart-header');
        console.log('Found chart header:', chartHeader);
        if (chartHeader) {
            const existingSelector = chartHeader.querySelector('#data-category-selector');
            console.log('Existing selector:', existingSelector);
            if (!existingSelector) {
                console.log('Adding data category selector to chart header');
                addDataCategorySelector(chartHeader);
            }
        } else {
            console.log('Chart header not found after delay');
        }
    }, 300);
}

/**
 * Generate data for lazy-loaded staff name charts
 * @param {Array} filteredStaff - Filtered staff list
 * @returns {Object} - Chart data object
 */
function generateLazyLoadedNameData(filteredStaff) {
    // Sort staff by name
    const sortedStaff = [...filteredStaff].sort((a, b) => a.name.localeCompare(b.name));
    
    // Calculate achievements for all staff (needed for lazy loading)
    const staffAchievements = calculateStaffAchievements(sortedStaff);
    
    // Initially only load first 20 staff
    const initialCount = Math.min(20, sortedStaff.length);
    const initialStaff = sortedStaff.slice(0, initialCount);
    
    // Calculate completion rates
    const labels = initialStaff.map(staff => staff.name);
    const data = initialStaff.map(staff => {
        const achievements = staffAchievements[staff.id] || { achieved: 0, total: 0 };
        return achievements.total > 0 
            ? Math.round((achievements.achieved / achievements.total) * 100) 
            : 0;
    });
    
    // Generate a set of colors based on department or other groupable property
    const backgroundColors = [];
    const borderColors = [];
    
    for (const staff of initialStaff) {
        // Try to associate staff with a group color if possible
        let color = null;
        
        // If we know which standard group the staff member belongs to or works with most
        if (staff.primary_group) {
            const group = groupsData.find(g => g.name === staff.primary_group);
            if (group && group.color) {
                color = group.color;
            }
        } 
        // Or try by department
        else if (staff.department) {
            // For departments, we can try to find a group that might be related by first letter
            const firstChar = staff.department.charAt(0).toUpperCase();
            const group = groupsData.find(g => g.code === firstChar);
            if (group && group.color) {
                color = group.color;
            }
        }
        
        if (color) {
            backgroundColors.push(hexToRGBA(color, 0.7));
            borderColors.push(hexToRGBA(color, 1));
        } else {
            // Default colors as fallback - use a rotating pattern
            const defaultColors = [
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 99, 132, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(255, 159, 64, 0.8)',
                'rgba(153, 102, 255, 0.8)',
                'rgba(255, 205, 86, 0.8)',
                'rgba(201, 203, 207, 0.8)'
            ];
            
            const index = backgroundColors.length % defaultColors.length;
            backgroundColors.push(defaultColors[index]);
            borderColors.push(defaultColors[index].replace('0.8', '1'));
        }
    }
    
    // Create the chart data with special lazy loading info
    return {
        labels: labels,
        datasets: [{
            label: 'Completion Rate (%)',
            data: data,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1
        }],
        lazyLoadData: {
            type: 'staff_names',
            staff: sortedStaff,
            staffAchievements: staffAchievements,
            currentIndex: initialCount
        }
    };
}

/**
 * Generate chart data based on filtered data
 * @param {Object} filteredData - Data returned from filter system
 * @returns {Object} - Chart data
 */
function generateChartData(filteredData) {
    const { filteredStaff, filteredStandards } = filteredData;
    
    if (isSplitView) {
        return generateSplitStandardsChartData(filteredData);
    }
    
    // Calculate completion rates by category
    const completionByPhase = calculateCompletionByCategory(filteredStaff, 'phase');
    const completionByYear = calculateCompletionByCategory(filteredStaff, 'year_group');
    const completionByType = calculateCompletionByCategory(filteredStaff, 'overseas_thai');
    
    // Determine best category to display based on distribution
    let labels, data;
    
    // Use the most diverse category (the one with the most unique values)
    if (Object.keys(completionByYear).length >= Object.keys(completionByPhase).length && 
        Object.keys(completionByYear).length >= Object.keys(completionByType).length) {
        labels = Object.keys(completionByYear);
        data = Object.values(completionByYear);
    } else if (Object.keys(completionByPhase).length >= Object.keys(completionByType).length) {
        labels = Object.keys(completionByPhase);
        data = Object.values(completionByPhase);
    } else {
        labels = Object.keys(completionByType);
        data = Object.values(completionByType);
    }
    
    // Use colors from standard groups if available
    const backgroundColors = [];
    const borderColors = [];
    
    // Try to map each label to a group color when possible
    // For non-group related data, use the default colors
    for (let i = 0; i < labels.length; i++) {
        // Try to find a group with matching name or code
        const group = groupsData.find(g => 
            g.name === labels[i] || 
            g.code === labels[i]
        );
        
        if (group && group.color) {
            backgroundColors.push(hexToRGBA(group.color, 0.8));
            borderColors.push(hexToRGBA(group.color, 1));
        } else {
            // Default colors as fallback
            const defaultColors = [
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 99, 132, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(255, 159, 64, 0.8)',
                'rgba(153, 102, 255, 0.8)',
                'rgba(255, 205, 86, 0.8)',
                'rgba(201, 203, 207, 0.8)'
            ];
            
            const index = i % defaultColors.length;
            backgroundColors.push(defaultColors[index]);
            borderColors.push(defaultColors[index].replace('0.8', '1'));
        }
    }
    
    return {
        labels: labels,
        datasets: [
            {
                label: 'Completion Rate (%)',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }
        ]
    };
}

/**
 * Calculate completion rates by a specific category
 * @param {Array} filteredStaff - Filtered staff data
 * @param {string} category - Category to group by (e.g., 'phase', 'year_group')
 * @returns {Object} - Object with category values as keys and completion rates as values
 */
function calculateCompletionByCategory(filteredStaff, category) {
    // Extract all unique category values, handling multiple values per staff
    const categoryValues = new Set();
    
    // First, extract all unique values including those in comma-separated lists
    filteredStaff.forEach(staff => {
        const value = staff[category] || 'Uncategorized';
        
        // Handle comma-separated values
        if (value.includes(', ')) {
            // Split by comma and space, then trim each value
            const values = value.split(', ').map(v => v.trim());
            
            // Add each value to our set
            values.forEach(v => categoryValues.add(v));
        } else {
            // Single value
            categoryValues.add(value);
        }
    });
    
    // Convert to array
    const uniqueCategoryValues = Array.from(categoryValues);
    
    // Initialize result with zero values
    const result = {};
    uniqueCategoryValues.forEach(value => {
        result[value] = 0;
    });
    
    // Group staff by category, allowing staff to be in multiple groups
    const staffByCategory = {};
    uniqueCategoryValues.forEach(value => {
        staffByCategory[value] = filteredStaff.filter(staff => {
            const staffValue = staff[category] || 'Uncategorized';
            
            // Handle comma-separated values
            if (staffValue.includes(', ')) {
                // Split by comma and space, then trim each value
                const values = staffValue.split(', ').map(v => v.trim());
                // Check if this value is in the staff's list
                return values.includes(value);
            }
            
            // Direct comparison for single values
            return staffValue === value;
        });
    });
    
    // Calculate completion rate for each category
    for (const [value, staffList] of Object.entries(staffByCategory)) {
        const staffAchievements = calculateStaffAchievements(staffList);
        
        let totalAchieved = 0;
        let totalStandards = 0;
        
        for (const stats of Object.values(staffAchievements)) {
            totalAchieved += stats.achieved;
            totalStandards += stats.total;
        }
        
        result[value] = totalStandards > 0 
            ? Math.round((totalAchieved / totalStandards) * 100) 
            : 0;
    }
    
    return result;
}

/**
 * Update the active chart with filtered data
 * @param {Object} filteredData - Filtered data
 */
function updateActiveChartWithFilteredData(filteredData) {
    // Find the active chart ID
    const activeChartContainer = document.querySelector('.chart-wrapper');
    if (!activeChartContainer) {
        Logger.log('No active chart found to update');
        return;
    }
    
    const chartActionButtons = activeChartContainer.querySelectorAll('.chart-actions button');
    if (!chartActionButtons || chartActionButtons.length === 0) {
        Logger.log('No chart action buttons found');
        return;
    }
    
    const chartId = chartActionButtons[0].dataset.chartId;
    if (!chartId) {
        Logger.log('No chart ID found');
        return;
    }
    
    // IMPORTANT: Find the existing chart configuration first
    const existingConfig = ChartSystem.getChartConfigurations().find(config => config.id === chartId);
    
    // Determine the data category to use - prioritize preserving the existing category
    let effectiveCategory;
    
    // 1. If explicitly provided in the function call, use that as highest priority
    if (filteredData.chartDataCategory) {
        effectiveCategory = filteredData.chartDataCategory;
        Logger.log(`Using explicitly provided chart data category: ${effectiveCategory}`);
    } 
    // 2. Use the existing chart's dataCategory if available (second priority)
    else if (existingConfig && existingConfig.dataCategory) {
        effectiveCategory = existingConfig.dataCategory;
        Logger.log(`Using existing chart data category: ${effectiveCategory}`);
    }
    // 3. Only check the selector if we haven't found a category yet
    else {
        const categorySelector = activeChartContainer.querySelector('#data-category-selector');
        effectiveCategory = categorySelector ? categorySelector.value : 'auto';
        Logger.log(`Using selector chart data category: ${effectiveCategory}`);
    }
    
    // Generate new chart data based on the data category
    let chartData;
    if (effectiveCategory === 'auto') {
        chartData = generateChartData(filteredData);
    } else {
        chartData = generateCustomChartData(filteredData, effectiveCategory);
    }
    
    // Log statistics about filtered data 
    Logger.log(`Filtered data: ${filteredData.filteredStaff.length} staff, ${filteredData.filteredStandards.length} standards`);
    
    // Update the chart
    Logger.log(`Updating chart ${chartId} with new data using category: ${effectiveCategory}`);
    ChartSystem.updateChart(chartId, { 
        data: chartData,
        // Store filter information with the chart
        filters: filteredData.currentFilter,
        // IMPORTANT: Always preserve the data category
        dataCategory: effectiveCategory
    });
    
    // Update the selector value to reflect the category being used
    const categorySelector = activeChartContainer.querySelector('#data-category-selector');
    if (categorySelector && categorySelector.value !== effectiveCategory) {
        categorySelector.value = effectiveCategory;
    }
}

/**
 * Show dialog to create a new chart
 */
function showCreateChartDialog() {
    // Get dynamic filter fields for the data category dropdown
    const dataCategories = getDataCategoryOptions();
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex'; // Ensure modal displays properly
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Create New Chart</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="chart-title">Chart Title</label>
                    <input type="text" id="chart-title" class="form-control" 
                           value="New Chart" placeholder="Enter chart title">
                </div>
                <div class="form-group">
                    <label for="chart-type">Chart Type</label>
                    <select id="chart-type" class="form-control">
                        <option value="bar">Bar Chart</option>
                        <option value="pie">Pie Chart</option>
                        <option value="line">Line Chart</option>
                        <option value="doughnut">Doughnut Chart</option>
                        <option value="polarArea">Polar Area Chart</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="data-category">Data Category</label>
                    <select id="data-category" class="form-control">
                        <option value="auto">Auto-select best category</option>
                        ${dataCategories.map(category => 
                            `<option value="${category.id}">${category.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <button class="button create-chart-btn">Create Chart</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('.close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.querySelector('.create-chart-btn').addEventListener('click', () => {
        const title = document.getElementById('chart-title').value.trim() || 'New Chart';
        const type = document.getElementById('chart-type').value;
        const category = document.getElementById('data-category').value;
        
        createCustomChart(title, type, category);
        document.body.removeChild(modal);
    });
    
    // Show modal
    setTimeout(() => {
        modal.classList.add('show');
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
        document.getElementById('chart-title').focus();
    }, 50);
}

/**
 * Get data category options for dropdowns
 * @returns {Array} Array of category objects with id and name
 */
function getDataCategoryOptions() {
    // Get all filter fields from the buildDynamicFilters function
    const filters = buildDynamicFilters();
    
    // Always include name at the start
    const baseCategories = [
        { id: 'name', name: 'Name' }
    ];
    
    // Get classification categories from our filters
    const classificationCategories = filters.classification.map(field => ({
        id: field.id,
        name: field.name
    }));
    
    // Combine all categories
    return [...baseCategories, ...classificationCategories];
}

/**
 * Add a data category selector to the chart header
 * @param {HTMLElement} chartHeader - Chart header element
 */
function addDataCategorySelector(chartHeader) {
    // Get dynamic data categories
    const dataCategories = [
        { id: 'auto', name: 'Auto (Best Fit)' },
        ...getDataCategoryOptions()
    ];
    
    // Create selector element
    const selector = document.createElement('select');
    selector.id = 'data-category-selector';
    selector.className = 'chart-category-selector';
    
    // Get current chart ID
    const chartId = chartHeader.querySelector('.chart-actions button').dataset.chartId;
    
    // Find chart configuration to get current data category
    let currentCategory = 'auto';
    if (chartId) {
        const chartConfigs = ChartSystem.getChartConfigurations();
        const chartConfig = chartConfigs.find(c => c.id === chartId);
        if (chartConfig && chartConfig.dataCategory) {
            currentCategory = chartConfig.dataCategory;
        }
    }
    
    // Add options
    dataCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.text = category.name;
        option.selected = category.id === currentCategory;
        selector.appendChild(option);
    });
    
    // Create container
    const container = document.createElement('div');
    container.className = 'chart-category-container';
    container.innerHTML = '<label>Group By:</label>';
    container.appendChild(selector);
    
    // Insert before chart actions
    chartHeader.insertBefore(container, chartHeader.querySelector('.chart-actions'));
    
    // Add change event listener
    selector.addEventListener('change', (event) => {
        if (chartId) {
            changeChartDataCategory(chartId, event.target.value);
        }
    });
}

/**
 * Generate custom chart data based on specific category
 * @param {Object} filteredData - Filtered data
 * @param {string} category - Category to group by
 * @returns {Object} - Chart data
 */
function generateCustomChartData(filteredData, category) {
    // For split view, call the split standards function with the custom category
    if (isSplitView) {
        return generateSplitStandardsChartData(filteredData, category);
    }
    
    const { filteredStaff } = filteredData;
    
    // Special handling for name category which can have many values
    if (category === 'name') {
        return generateLazyLoadedNameData(filteredStaff);
    }
    
    // Calculate completion rates by the specified category
    const completionByCategory = calculateCompletionByCategory(filteredStaff, category);
    
    const labels = Object.keys(completionByCategory);
    const data = Object.values(completionByCategory);
    
    // Use colors from standard groups if available
    const backgroundColors = [];
    const borderColors = [];
    
    // Try to map each label to a group color when possible
    for (let i = 0; i < labels.length; i++) {
        // For group-related categories, try to find matching group color
        let group = null;
        
        if (category === 'group') {
            // Direct match by group name
            group = groupsData.find(g => g.name === labels[i]);
        } else if (category.includes('group') || category === 'code') {
            // Try to find by first letter of the code
            if (labels[i] && labels[i].length > 0) {
                const firstChar = labels[i].charAt(0).toUpperCase();
                group = groupsData.find(g => g.code === firstChar);
            }
        }
        
        if (group && group.color) {
            backgroundColors.push(hexToRGBA(group.color, 0.8));
            borderColors.push(hexToRGBA(group.color, 1));
        } else {
            // Default colors as fallback
            const defaultColors = [
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 99, 132, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(255, 159, 64, 0.8)',
                'rgba(153, 102, 255, 0.8)',
                'rgba(255, 205, 86, 0.8)',
                'rgba(201, 203, 207, 0.8)'
            ];
            
            const index = i % defaultColors.length;
            backgroundColors.push(defaultColors[index]);
            borderColors.push(defaultColors[index].replace('0.8', '1'));
        }
    }
    
    return {
        labels: labels,
        datasets: [
            {
                label: 'Completion Rate (%)',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }
        ]
    };
}

/**
 * Create chart options based on chart type
 * @param {string} type - Chart type
 * @param {string} title - Chart title
 * @returns {Object} - Chart options
 */
function createChartOptions(type, title) {
    const baseOptions = {
        plugins: {
            title: {
                display: true,
                text: title,
                font: {
                    size: 16
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `${context.dataset.label}: ${context.raw}%`;
                    }
                }
            },
            // Add custom plugin for lazy loading
            lazyLoad: {
                enabled: true,
                onScroll: function(chart) {
                    const lazyData = chart.data._lazyLoadData;
                    if (!lazyData || !lazyData.enabled || lazyData.currentIndex >= lazyData.allStaff.length) {
                        return false; // No more data to load
                    }
                    
                    // Load next batch of staff
                    const nextIndex = Math.min(lazyData.currentIndex + lazyData.pageSize, lazyData.allStaff.length);
                    const newStaff = lazyData.allStaff.slice(lazyData.currentIndex, nextIndex);
                    
                    // Add to existing data
                    for (const staff of newStaff) {
                        // Calculate completion rate
                        const achievements = lazyData.staffAchievements[staff.id] || { achieved: 0, total: 0 };
                        const completionRate = achievements.total > 0 
                            ? Math.round((achievements.achieved / achievements.total) * 100) 
                            : 0;
                        
                        // Add to chart
                        chart.data.labels.push(staff.name);
                        chart.data.datasets[0].data.push(completionRate);
                        
                        // Add colors (cycling through the color array)
                        const colorIndex = chart.data.labels.length % 7; // 7 colors in our array
                        const colors = [
                            'rgba(54, 162, 235, 0.8)',
                            'rgba(255, 99, 132, 0.8)',
                            'rgba(75, 192, 192, 0.8)',
                            'rgba(255, 159, 64, 0.8)',
                            'rgba(153, 102, 255, 0.8)',
                            'rgba(255, 205, 86, 0.8)',
                            'rgba(201, 203, 207, 0.8)'
                        ];
                        chart.data.datasets[0].backgroundColor.push(colors[colorIndex]);
                        chart.data.datasets[0].borderColor.push(colors[colorIndex].replace('0.8', '1'));
                    }
                    
                    // Update current index
                    lazyData.currentIndex = nextIndex;
                    
                    // Update chart
                    chart.update();
                    return true; // Data was loaded
                }
            }
        }
    };
    
    // Add specific options based on chart type
    switch (type) {
        case 'bar':
            return {
                ...baseOptions,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Category'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Completion Rate (%)'
                        },
                        max: 100
                    }
                },
                // For split view, we need to adjust the bar width and configuration
                ...(isSplitView && {
                    plugins: {
                        ...baseOptions.plugins,
                        legend: {
                            display: true,
                            position: 'right',
                            labels: {
                                boxWidth: 12,
                                font: {
                                    size: 10
                                }
                            }
                        }
                    }
                })
            };
        
        case 'line':
            return {
                ...baseOptions,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Completion Rate (%)'
                        },
                        max: 100
                    }
                },
                elements: {
                    line: {
                        tension: 0.4
                    },
                    point: {
                        radius: 5,
                        hoverRadius: 7
                    }
                }
            };
            
        case 'pie':
        case 'doughnut':
            // Split view is not ideal for pie/doughnut charts
            // Possibly show a message or convert to bar chart if isSplitView is true
            return {
                ...baseOptions,
                plugins: {
                    ...baseOptions.plugins,
                    legend: {
                        position: 'right'
                    }
                },
                cutout: type === 'doughnut' ? '50%' : undefined
            };
            
        case 'polarArea':
            return {
                ...baseOptions,
                plugins: {
                    ...baseOptions.plugins,
                    legend: {
                        position: 'right'
                    }
                },
                scales: {
                    r: {
                        max: 100,
                        ticks: {
                            stepSize: 20
                        }
                    }
                }
            };
            
        default:
            return baseOptions;
    }
}

/**
 * Show dialog to open saved charts
 */
function showOpenChartDialog() {
    // Get saved charts
    const savedCharts = ChartSystem.getSavedCharts();
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex'; // Ensure modal displays properly
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Open Saved Chart</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                ${savedCharts.length === 0 
                    ? '<p>No saved charts found. Create and save a chart first.</p>' 
                    : ''}
                <div class="saved-charts-list">
                    ${savedCharts.map((chart, index) => `
                        <div class="saved-chart-item" data-index="${index}">
                            <div class="saved-chart-info">
                                <h4>${chart.savedName || chart.title}</h4>
                                <p>Type: ${chart.type} | Saved: ${formatDate(chart.savedAt)}</p>
                            </div>
                            <button class="button open-chart-btn" data-index="${index}">Open</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('.close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.querySelectorAll('.open-chart-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const index = parseInt(event.target.dataset.index);
            if (!isNaN(index) && index >= 0 && index < savedCharts.length) {
                openSavedChart(savedCharts[index]);
                document.body.removeChild(modal);
            }
        });
    });
    
    // Show modal
    setTimeout(() => {
        modal.classList.add('show');
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
    }, 50);
}

/**
 * Open a saved chart
 * @param {Object} savedChart - Saved chart configuration
 */
function openSavedChart(savedChart) {
    // Get current filtered data
    const currentFilteredData = filterSystem.getFilteredData();
    
    // Decide whether to use saved filters or current filters
    // For now, we'll use current filters to allow users to see saved charts with their current filtering
    const useCurrentFilters = true;
    let chartData;
    
    // Generate appropriate chart data
    if (useCurrentFilters) {
        // Use current filters but saved chart type/category
        if (savedChart.dataCategory && savedChart.dataCategory !== 'auto') {
            chartData = generateCustomChartData(currentFilteredData, savedChart.dataCategory);
        } else {
            chartData = generateChartData(currentFilteredData);
        }
    } else {
        // TODO: In a future enhancement, we could restore the saved filters as well
        // This would require setting the filter UI state to match the saved filters
    }
    
    // Create a new chart based on the saved configuration
    const config = {
        ...savedChart,
        data: chartData,
        // Store current filter state
        filters: currentFilteredData.currentFilter,
        isActive: true
    };
    
    // Create the chart
    const chartId = ChartSystem.createChart(config);
    Logger.log(`Opened saved chart: ${savedChart.savedName || savedChart.title} (${chartId})`);
    
    // Re-apply filters if present in saved chart
    if (savedChart.filters) {
        highlightActiveFilters(savedChart.filters);
    }
    
    // Add the data category selector after the chart has been created
    setTimeout(() => {
        const chartHeader = document.querySelector('.chart-header');
        if (chartHeader && !chartHeader.querySelector('#data-category-selector')) {
            addDataCategorySelector(chartHeader);
            // Set value if dataCategory is available in saved chart
            if (savedChart.dataCategory) {
                const selector = chartHeader.querySelector('#data-category-selector');
                if (selector) {
                    selector.value = savedChart.dataCategory;
                }
            }
        }
    }, 100);
    
    return chartId;
}

/**
 * Format a date for display
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date
 */
function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Highlight active filters in the UI
 * @param {Object} currentFilter - Current filter state
 */
function highlightActiveFilters(currentFilter) {
    // Reset all filter item highlights
    document.querySelectorAll('.filter-item').forEach(item => {
        item.classList.remove('has-active-filters');
    });
    
    // Add highlight to filter items with active filters
    for (const field in currentFilter) {
        if (Array.isArray(currentFilter[field]) && currentFilter[field].length > 0) {
            const filterItem = document.querySelector(`.filter-item label[for="filter-${field}"]`).closest('.filter-item');
            if (filterItem) {
                filterItem.classList.add('has-active-filters');
            }
        }
    }
}

/**
 * This function initializes the filter system testing panel
 * to verify include/exclude filtering works correctly
 */
function initFilterTesting() {
    const container = document.createElement('div');
    container.className = 'filter-testing-panel mt-2';
    container.innerHTML = `
        <h4>Filter System Test Panel</h4>
        <div class="filter-test-controls">
            <div class="filter-test-row">
                <button id="test-include-filter" class="button button-small">Add Include Filter</button>
                <button id="test-exclude-filter" class="button button-small button-secondary">Add Exclude Filter</button>
                <button id="test-clear-filters" class="button button-small">Clear Filters</button>
            </div>
            <div class="filter-test-status mt-1">
                <b>Filter Status:</b> <span id="filter-test-message">No filters applied</span>
            </div>
        </div>
    `;
    
    document.querySelector('.charts-section').appendChild(container);
    
    // Add event listeners for test buttons
    document.getElementById('test-include-filter').addEventListener('click', () => {
        // Add a test include filter for Primary phase
        const field = 'phase';
        const value = 'Primary';
        const mode = 'include';
        
        // Call filter system's addFilterTag method
        filterSystem.addFilterTag(field, value, mode);
        
        // Update status
        document.getElementById('filter-test-message').textContent = 
            'Added INCLUDE filter for Phase = Primary';
    });
    
    document.getElementById('test-exclude-filter').addEventListener('click', () => {
        // Add a test exclude filter for Year 3
        const field = 'year_group';
        const value = 'Year 3';
        const mode = 'exclude';
        
        // Call filter system's addFilterTag method
        filterSystem.addFilterTag(field, value, mode);
        
        // Update status
        document.getElementById('filter-test-message').textContent = 
            'Added EXCLUDE filter for Year Group = Year 3';
    });
    
    document.getElementById('test-clear-filters').addEventListener('click', () => {
        // Clear all filters
        filterSystem.clearFilters();
        
        // Update status
        document.getElementById('filter-test-message').textContent = 'All filters cleared';
    });
}

/**
 * Handle split view toggle
 * @param {Event} event - Change event
 */
function handleSplitViewToggle(event) {
    isSplitView = event.target.checked;
    Logger.log(`Split view toggled: ${isSplitView}`);
    
    // Update the toggle label
    const toggleLabel = document.querySelector('.toggle-label');
    if (toggleLabel) {
        toggleLabel.textContent = isSplitView ? 'Split Standards View' : 'Total View';
    }
    
    // Update the active chart to reflect the new view
    const filteredData = filterSystem.getFilteredData();
    updateActiveChartWithFilteredData(filteredData);
}

/**
 * Generate chart data with standards split into individual datasets
 * @param {Object} filteredData - Data returned from filter system
 * @param {string} customCategory - Optional custom category for grouping
 * @returns {Object} - Chart data for split standards view
 */
function generateSplitStandardsChartData(filteredData, customCategory = null) {
    const { filteredStaff, filteredStandards } = filteredData;
    
    // Use provided category or year_group as default category for the x-axis
    const categoryField = customCategory || 'year_group';
    
    // Get unique category values
    const categoryValues = [...new Set(filteredStaff.map(staff => staff[categoryField] || 'Uncategorized'))];
    
    // Generate datasets for each standard
    const datasets = filteredStandards.map((standard, index) => {
        let color, borderColor;
        
        // If standard is part of a group, try to use the group's color
        if (standard.group) {
            const group = groupsData.find(g => g.name === standard.group);
            
            if (group && group.color) {
                // Use the group's color directly with some transparency for the background
                color = hexToRGBA(group.color, 0.7);
                borderColor = hexToRGBA(group.color, 1.0);
            } else {
                // Fallback to hue-based color if no group color found
                const hue = getStandardHue(standard);
                color = `hsla(${hue}, 70%, 60%, 0.7)`;
                borderColor = `hsla(${hue}, 70%, 50%, 1)`;
            }
        } else {
            // For ungrouped standards, use the hue-based approach
            const hue = getStandardHue(standard);
            color = `hsla(${hue}, 70%, 60%, 0.7)`;
            borderColor = `hsla(${hue}, 70%, 50%, 1)`;
        }
        
        // Calculate completion rate for each category value for this standard
        const data = categoryValues.map(categoryValue => {
            const staffInCategory = filteredStaff.filter(staff => 
                (staff[categoryField] || 'Uncategorized') === categoryValue
            );
            
            if (staffInCategory.length === 0) return 0;
            
            // Count achievements for this standard and category
            let achievedCount = 0;
            staffInCategory.forEach(staff => {
                const assignment = assignmentsData.find(
                    a => a.staff_id === staff.id && a.standard_code === standard.code
                );
                
                if (assignment && assignment.achieved) {
                    achievedCount++;
                }
            });
            
            return Math.round((achievedCount / staffInCategory.length) * 100);
        });
        
        return {
            label: standard.code,
            data: data,
            backgroundColor: color,
            borderColor: borderColor,
            borderWidth: 1
        };
    });
    
    return {
        labels: categoryValues,
        datasets: datasets
    };
}

/**
 * Convert a hex color or hue value to RGBA
 * @param {string|number} input - Hex color string or hue value (0-360)
 * @param {number} opacity - Opacity value (0-1)
 * @returns {string} - RGBA color string
 */
function hexToRGBA(input, opacity) {
    // If input is a number (hue), convert to hex
    if (typeof input === 'number') {
        // Convert HSL to RGB
        const h = input;
        const s = 0.8; // High saturation
        const l = 0.6; // Medium lightness
        
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        
        let r, g, b;
        if (h < 60) {
            [r, g, b] = [c, x, 0];
        } else if (h < 120) {
            [r, g, b] = [x, c, 0];
        } else if (h < 180) {
            [r, g, b] = [0, c, x];
        } else if (h < 240) {
            [r, g, b] = [0, x, c];
        } else if (h < 300) {
            [r, g, b] = [x, 0, c];
        } else {
            [r, g, b] = [c, 0, x];
        }
        
        const rgb = [
            Math.round((r + m) * 255),
            Math.round((g + m) * 255),
            Math.round((b + m) * 255)
        ];
        
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
    }
    
    // Handle hex string
    try {
        // Remove # if present
        const hex = input.replace(/^#/, '');
        
        // Parse the hex values
        let r, g, b;
        if (hex.length === 3) {
            r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
            g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
            b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
        } else {
            r = parseInt(hex.substr(0, 2), 16);
            g = parseInt(hex.substr(2, 2), 16);
            b = parseInt(hex.substr(4, 2), 16);
        }
        
        // Return rgba string
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    } catch (e) {
        // Fallback to a default color if parsing fails
        return `rgba(54, 162, 235, ${opacity})`;
    }
}

/**
 * Generate a consistent hue for a standard based on its code or group
 * @param {Object} standard - Standard object
 * @returns {number} - Hue value (0-360)
 */
function getStandardHue(standard) {
    // If standard is part of a group, base the color on the group
    if (standard.group) {
        // Find the group in groupsData
        const group = groupsData.find(g => g.name === standard.group);
        
        if (group && group.color) {
            // Get the level for variation
            const level = standard.code.split('.').length - 1;
            // Convert hex color to HSL
            return hexToHue(group.color, level);
        }
        
        // Fallback to the old method if group not found or no color
        const firstChar = standard.group.charAt(0).toUpperCase();
        const baseHue = (firstChar.charCodeAt(0) - 65) * 30 % 360; // Spread groups across the color wheel
        
        // If the standard has a code with a level, add a slight variation
        const level = standard.code.split('.').length - 1;
        return (baseHue + level * 5) % 360;
    }
    
    // For ungrouped standards, use the code's first character
    const firstChar = standard.code.charAt(0).toUpperCase();
    return (firstChar.charCodeAt(0) * 15) % 360;
}

/**
 * Convert hex color to hue component of HSL
 * @param {string} hex - Hex color code
 * @param {number} level - Level of the standard for subtle variations
 * @returns {number} - Hue value (0-360)
 */
function hexToHue(hex, level = 0) {
    // Remove # if present
    hex = hex.replace(/^#/, '');
    
    // Parse the hex values
    let r, g, b;
    if (hex.length === 3) {
        r = parseInt(hex.charAt(0) + hex.charAt(0), 16) / 255;
        g = parseInt(hex.charAt(1) + hex.charAt(1), 16) / 255;
        b = parseInt(hex.charAt(2) + hex.charAt(2), 16) / 255;
    } else {
        r = parseInt(hex.substr(0, 2), 16) / 255;
        g = parseInt(hex.substr(2, 2), 16) / 255;
        b = parseInt(hex.substr(4, 2), 16) / 255;
    }
    
    // Calculate min and max
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    
    // Calculate hue
    let h;
    if (max === min) {
        h = 0; // achromatic
    } else {
        const d = max - min;
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h = h * 60;
    }
    
    // Add a small variation based on the provided level
    return (h + level * 5) % 360;
}

/**
 * Load example data for testing and demonstration
 */
function loadExampleData() {
    if (confirm('This will replace any existing data with example data. Are you sure you want to continue?')) {
        // Clear existing data first
        clearAllData();
        
        // Generate sample data
        const sampleData = generateSampleData();
        
        // Save to storage
        Storage.save('staff', sampleData.staff);
        Storage.save('standards', sampleData.standards);
        Storage.save('groups', sampleData.groups);
        Storage.save('assignments', sampleData.assignments);
        
        // Update local variables
        staffData = sampleData.staff;
        standardsData = sampleData.standards;
        groupsData = sampleData.groups;
        assignmentsData = sampleData.assignments;
        
        // Update filter system
        filterSystem.updateData({
            staffData: staffData,
            standardsData: standardsData
        });
        
        // Update drill-down filter system
        if (drilldownFilterSystem) {
            drilldownFilterSystem.updateData(staffData);
        }
        
        // Rebuild standards tree
        initStandardsTree();
        
        // Show success message
        alert('Example data loaded successfully!');
    }
}

/**
 * Remove all example data and reset the application state
 */
function removeExampleData() {
    if (confirm('This will remove all data including staff, standards, and saved charts. Are you sure you want to continue?')) {
        clearAllData();
        
        // Show success message
        alert('All data has been removed successfully!');
    }
}

/**
 * Clear all application data
 */
function clearAllData() {
    // Clear all data from storage
    Storage.delete('staff');
    Storage.delete('standards');
    Storage.delete('groups');
    Storage.delete('assignments');
    Storage.delete('saved_charts');
    
    // Clear saved charts
    localStorage.removeItem('saved_charts');
    
    // Reset local variables
    staffData = [];
    standardsData = [];
    groupsData = [];
    assignmentsData = [];
    
    // Update filter system
    filterSystem.updateData({
        staffData: staffData,
        standardsData: standardsData
    });
    
    // Update drill-down filter system
    if (drilldownFilterSystem) {
        drilldownFilterSystem.updateData(staffData);
    }
    
    // Rebuild standards tree
    initStandardsTree();
    
    // Clear charts
    if (ChartSystem && ChartSystem.cleanup) {
        ChartSystem.cleanup();
        initChartSystem();
    }
}

/**
 * Generate sample data for testing
 * @returns {Object} - Object containing arrays of sample data
 */
function generateSampleData() {
    // Sample groups - 5 groups with different colors
    const sampleGroups = [
        { id: 1, name: 'Teaching Standards', code: 'A', color: '#3498db' },
        { id: 2, name: 'Classroom Management', code: 'B', color: '#2ecc71' },
        { id: 3, name: 'Professional Development', code: 'C', color: '#9b59b6' },
        { id: 4, name: 'Student Assessment', code: 'D', color: '#e67e22' },
        { id: 5, name: 'Digital Competency', code: 'E', color: '#e74c3c' }
    ];
    
    // Sample standards - organized in a complex hierarchical structure
    // For each group: 2-5 parent standards, each with 2-5 children, and 0-4 grandchildren for each child
    const sampleStandards = [
        // Group A: Teaching Standards
        { id: 101, code: 'A.1', name: 'Lesson Planning', description: 'Creates well-structured lesson plans with clear objectives', group: 'Teaching Standards', level: 1, parent_code: null, children: ['A.1.1', 'A.1.2', 'A.1.3'] },
        { id: 102, code: 'A.1.1', name: 'Learning Objectives', description: 'Defines clear learning objectives for all lessons', group: 'Teaching Standards', level: 2, parent_code: 'A.1', children: ['A.1.1.1', 'A.1.1.2'] },
        { id: 103, code: 'A.1.1.1', name: 'SMART Objectives', description: 'Creates specific, measurable, achievable objectives', group: 'Teaching Standards', level: 3, parent_code: 'A.1.1', children: [] },
        { id: 104, code: 'A.1.1.2', name: 'Differentiated Objectives', description: 'Adapts objectives for different ability levels', group: 'Teaching Standards', level: 3, parent_code: 'A.1.1', children: [] },
        { id: 105, code: 'A.1.2', name: 'Resource Preparation', description: 'Prepares appropriate resources for all planned activities', group: 'Teaching Standards', level: 2, parent_code: 'A.1', children: ['A.1.2.1', 'A.1.2.2'] },
        { id: 106, code: 'A.1.2.1', name: 'Digital Resources', description: 'Incorporates relevant digital resources', group: 'Teaching Standards', level: 3, parent_code: 'A.1.2', children: [] },
        { id: 107, code: 'A.1.2.2', name: 'Physical Materials', description: 'Prepares physical materials efficiently', group: 'Teaching Standards', level: 3, parent_code: 'A.1.2', children: [] },
        { id: 108, code: 'A.1.3', name: 'Time Management', description: 'Allocates appropriate time for each activity', group: 'Teaching Standards', level: 2, parent_code: 'A.1', children: [] },
        
        { id: 109, code: 'A.2', name: 'Teaching Delivery', description: 'Delivers content effectively with appropriate methods', group: 'Teaching Standards', level: 1, parent_code: null, children: ['A.2.1', 'A.2.2', 'A.2.3'] },
        { id: 110, code: 'A.2.1', name: 'Clarity of Explanation', description: 'Explains concepts clearly using appropriate language', group: 'Teaching Standards', level: 2, parent_code: 'A.2', children: ['A.2.1.1'] },
        { id: 111, code: 'A.2.1.1', name: 'Visual Aids', description: 'Uses effective visual aids to support explanations', group: 'Teaching Standards', level: 3, parent_code: 'A.2.1', children: [] },
        { id: 112, code: 'A.2.2', name: 'Student Engagement', description: 'Engages students actively in the learning process', group: 'Teaching Standards', level: 2, parent_code: 'A.2', children: [] },
        { id: 113, code: 'A.2.3', name: 'Questioning Techniques', description: 'Uses effective questioning to promote deeper thinking', group: 'Teaching Standards', level: 2, parent_code: 'A.2', children: ['A.2.3.1', 'A.2.3.2'] },
        { id: 114, code: 'A.2.3.1', name: 'Wait Time', description: 'Allows appropriate wait time after questions', group: 'Teaching Standards', level: 3, parent_code: 'A.2.3', children: [] },
        { id: 115, code: 'A.2.3.2', name: 'Question Differentiation', description: 'Tailors questions to different ability levels', group: 'Teaching Standards', level: 3, parent_code: 'A.2.3', children: [] },
        
        { id: 116, code: 'A.3', name: 'Curriculum Knowledge', description: 'Demonstrates strong knowledge of subject curriculum', group: 'Teaching Standards', level: 1, parent_code: null, children: ['A.3.1', 'A.3.2'] },
        { id: 117, code: 'A.3.1', name: 'Subject Expertise', description: 'Shows depth of subject knowledge', group: 'Teaching Standards', level: 2, parent_code: 'A.3', children: [] },
        { id: 118, code: 'A.3.2', name: 'Curriculum Integration', description: 'Connects learning across curriculum areas', group: 'Teaching Standards', level: 2, parent_code: 'A.3', children: [] },
        
        // Group B: Classroom Management
        { id: 201, code: 'B.1', name: 'Student Behavior', description: 'Manages student behavior effectively', group: 'Classroom Management', level: 1, parent_code: null, children: ['B.1.1', 'B.1.2', 'B.1.3'] },
        { id: 202, code: 'B.1.1', name: 'Positive Reinforcement', description: 'Uses positive reinforcement to encourage good behavior', group: 'Classroom Management', level: 2, parent_code: 'B.1', children: ['B.1.1.1', 'B.1.1.2'] },
        { id: 203, code: 'B.1.1.1', name: 'Verbal Praise', description: 'Uses specific, meaningful verbal praise', group: 'Classroom Management', level: 3, parent_code: 'B.1.1', children: [] },
        { id: 204, code: 'B.1.1.2', name: 'Reward Systems', description: 'Implements effective reward systems', group: 'Classroom Management', level: 3, parent_code: 'B.1.1', children: [] },
        { id: 205, code: 'B.1.2', name: 'Behavior Interventions', description: 'Implements appropriate interventions for disruptive behavior', group: 'Classroom Management', level: 2, parent_code: 'B.1', children: [] },
        { id: 206, code: 'B.1.3', name: 'Classroom Rules', description: 'Establishes and enforces clear classroom rules', group: 'Classroom Management', level: 2, parent_code: 'B.1', children: [] },
        
        { id: 207, code: 'B.2', name: 'Learning Environment', description: 'Creates a positive and productive learning environment', group: 'Classroom Management', level: 1, parent_code: null, children: ['B.2.1', 'B.2.2'] },
        { id: 208, code: 'B.2.1', name: 'Physical Space', description: 'Arranges physical space to support learning activities', group: 'Classroom Management', level: 2, parent_code: 'B.2', children: ['B.2.1.1'] },
        { id: 209, code: 'B.2.1.1', name: 'Seating Arrangements', description: 'Uses appropriate seating arrangements for activities', group: 'Classroom Management', level: 3, parent_code: 'B.2.1', children: [] },
        { id: 210, code: 'B.2.2', name: 'Classroom Climate', description: 'Fosters a positive emotional climate', group: 'Classroom Management', level: 2, parent_code: 'B.2', children: ['B.2.2.1'] },
        { id: 211, code: 'B.2.2.1', name: 'Student Relationships', description: 'Builds positive relationships between students', group: 'Classroom Management', level: 3, parent_code: 'B.2.2', children: [] },
        
        { id: 212, code: 'B.3', name: 'Time & Transitions', description: 'Manages instructional time and transitions effectively', group: 'Classroom Management', level: 1, parent_code: null, children: ['B.3.1', 'B.3.2'] },
        { id: 213, code: 'B.3.1', name: 'Transition Routines', description: 'Establishes efficient routines for transitions', group: 'Classroom Management', level: 2, parent_code: 'B.3', children: [] },
        { id: 214, code: 'B.3.2', name: 'Pacing', description: 'Maintains appropriate instructional pacing', group: 'Classroom Management', level: 2, parent_code: 'B.3', children: [] },
        
        // Group C: Professional Development
        { id: 301, code: 'C.1', name: 'Professional Growth', description: 'Engages in continuous professional development', group: 'Professional Development', level: 1, parent_code: null, children: ['C.1.1', 'C.1.2'] },
        { id: 302, code: 'C.1.1', name: 'Learning Reflection', description: 'Reflects on teaching practice and identifies areas for improvement', group: 'Professional Development', level: 2, parent_code: 'C.1', children: ['C.1.1.1'] },
        { id: 303, code: 'C.1.1.1', name: 'Self-Assessment', description: 'Conducts regular self-assessment of teaching practice', group: 'Professional Development', level: 3, parent_code: 'C.1.1', children: [] },
        { id: 304, code: 'C.1.2', name: 'Professional Learning', description: 'Participates in professional development opportunities', group: 'Professional Development', level: 2, parent_code: 'C.1', children: ['C.1.2.1'] },
        { id: 305, code: 'C.1.2.1', name: 'Workshops & Courses', description: 'Attends relevant workshops and courses', group: 'Professional Development', level: 3, parent_code: 'C.1.2', children: [] },
        
        { id: 306, code: 'C.2', name: 'Collaboration', description: 'Collaborates effectively with colleagues', group: 'Professional Development', level: 1, parent_code: null, children: ['C.2.1', 'C.2.2'] },
        { id: 307, code: 'C.2.1', name: 'Team Participation', description: 'Participates actively in team meetings and activities', group: 'Professional Development', level: 2, parent_code: 'C.2', children: [] },
        { id: 308, code: 'C.2.2', name: 'Resource Sharing', description: 'Shares resources and best practices with colleagues', group: 'Professional Development', level: 2, parent_code: 'C.2', children: [] },
        
        // Group D: Student Assessment
        { id: 401, code: 'D.1', name: 'Assessment Methods', description: 'Uses a variety of assessment methods to monitor student progress', group: 'Student Assessment', level: 1, parent_code: null, children: ['D.1.1', 'D.1.2', 'D.1.3'] },
        { id: 402, code: 'D.1.1', name: 'Formative Assessment', description: 'Implements effective formative assessment strategies', group: 'Student Assessment', level: 2, parent_code: 'D.1', children: ['D.1.1.1', 'D.1.1.2'] },
        { id: 403, code: 'D.1.1.1', name: 'Questioning', description: 'Uses questioning to assess understanding', group: 'Student Assessment', level: 3, parent_code: 'D.1.1', children: [] },
        { id: 404, code: 'D.1.1.2', name: 'Exit Tickets', description: 'Uses exit tickets to check for understanding', group: 'Student Assessment', level: 3, parent_code: 'D.1.1', children: [] },
        { id: 405, code: 'D.1.2', name: 'Summative Assessment', description: 'Designs appropriate summative assessments', group: 'Student Assessment', level: 2, parent_code: 'D.1', children: [] },
        { id: 406, code: 'D.1.3', name: 'Performance Assessment', description: 'Utilizes performance-based assessments', group: 'Student Assessment', level: 2, parent_code: 'D.1', children: [] },
        
        { id: 407, code: 'D.2', name: 'Feedback', description: 'Provides timely and constructive feedback to students', group: 'Student Assessment', level: 1, parent_code: null, children: ['D.2.1', 'D.2.2'] },
        { id: 408, code: 'D.2.1', name: 'Written Feedback', description: 'Provides clear written feedback on student work', group: 'Student Assessment', level: 2, parent_code: 'D.2', children: [] },
        { id: 409, code: 'D.2.2', name: 'Verbal Feedback', description: 'Gives effective verbal feedback during lessons', group: 'Student Assessment', level: 2, parent_code: 'D.2', children: ['D.2.2.1'] },
        { id: 410, code: 'D.2.2.1', name: 'One-to-One Feedback', description: 'Provides targeted individual feedback', group: 'Student Assessment', level: 3, parent_code: 'D.2.2', children: [] },
        
        // Group E: Digital Competency
        { id: 501, code: 'E.1', name: 'Digital Tools', description: 'Uses digital tools effectively to enhance teaching and learning', group: 'Digital Competency', level: 1, parent_code: null, children: ['E.1.1', 'E.1.2', 'E.1.3'] },
        { id: 502, code: 'E.1.1', name: 'Learning Platforms', description: 'Utilizes learning management systems appropriately', group: 'Digital Competency', level: 2, parent_code: 'E.1', children: ['E.1.1.1'] },
        { id: 503, code: 'E.1.1.1', name: 'Content Creation', description: 'Creates engaging digital content for learning platforms', group: 'Digital Competency', level: 3, parent_code: 'E.1.1', children: [] },
        { id: 504, code: 'E.1.2', name: 'Interactive Technology', description: 'Integrates interactive technology into lessons', group: 'Digital Competency', level: 2, parent_code: 'E.1', children: [] },
        { id: 505, code: 'E.1.3', name: 'Digital Assessment', description: 'Uses digital tools for student assessment', group: 'Digital Competency', level: 2, parent_code: 'E.1', children: [] },
        
        { id: 506, code: 'E.2', name: 'Digital Citizenship', description: 'Promotes responsible digital citizenship', group: 'Digital Competency', level: 1, parent_code: null, children: ['E.2.1', 'E.2.2'] },
        { id: 507, code: 'E.2.1', name: 'Online Safety', description: 'Teaches online safety and privacy', group: 'Digital Competency', level: 2, parent_code: 'E.2', children: [] },
        { id: 508, code: 'E.2.2', name: 'Digital Ethics', description: 'Addresses ethical use of digital resources', group: 'Digital Competency', level: 2, parent_code: 'E.2', children: ['E.2.2.1'] },
        { id: 509, code: 'E.2.2.1', name: 'Copyright Awareness', description: 'Teaches awareness of copyright and intellectual property', group: 'Digital Competency', level: 3, parent_code: 'E.2.2', children: [] }
    ];
    
    // Generate 50+ sample staff with diverse attributes
    const firstNames = [
        'Sarah', 'David', 'John', 'Maria', 'Michael', 'Emma', 'James', 'Olivia', 'William', 'Sophia',
        'Liam', 'Mia', 'Benjamin', 'Charlotte', 'Alexander', 'Amelia', 'Daniel', 'Harper', 'Matthew', 'Evelyn',
        'Supachai', 'Somchai', 'Apinya', 'Tanyarat', 'Nattapong', 'Somporn', 'Malee', 'Chai', 'Sirin', 'Aroon',
        'Priya', 'Ravi', 'Ananya', 'Rohan', 'Liu', 'Chen', 'Jin', 'Wei', 'Kimiko', 'Haruki', 'Yuki', 'Takashi',
        'Carlos', 'Ana', 'Miguel', 'Isabella', 'Mohammed', 'Fatima', 'Ahmed', 'Firdaus', 'Abdul', 'Nasreen'
    ];
    
    const lastNames = [
        'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor',
        'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson',
        'Jaidee', 'Wattana', 'Sook', 'Chaiyasong', 'Srisati', 'Sawasdee', 'Thongchai', 'Suparat', 'Chanpim', 'Sukjai',
        'Patel', 'Kumar', 'Singh', 'Shah', 'Wang', 'Li', 'Zhang', 'Liu', 'Tanaka', 'Suzuki', 'Sato', 'Watanabe',
        'Rodriguez', 'Lopez', 'Perez', 'Gonzalez', 'Ali', 'Khan', 'Hussein', 'Rahman', 'Abdullah', 'Malek'
    ];
    
    const phases = ['Primary', 'Secondary'];
    const yearGroups = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13'];
    const departments = [
        'Early Years', 'Elementary', 'Mathematics', 'Science', 'Languages', 'Thai Language', 'Social Studies',
        'Physical Education', 'Arts', 'Music', 'Drama', 'Computer Science', 'Humanities', 'English',
        'Business Studies', 'Design Technology', 'Special Education', 'Library/Media'
    ];
    const overseasThai = ['Overseas', 'Thai'];
    
    // Generate 50+ staff members
    const sampleStaff = [];
    for (let i = 1; i <= 55; i++) {
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const isThai = firstName.match(/Supachai|Somchai|Apinya|Tanyarat|Nattapong|Somporn|Malee|Chai|Sirin|Aroon/i) || 
                        lastName.match(/Jaidee|Wattana|Sook|Chaiyasong|Srisati|Sawasdee|Thongchai|Suparat|Chanpim|Sukjai/i);
        
        const phase = phases[Math.floor(Math.random() * phases.length)];
        const department = departments[Math.floor(Math.random() * departments.length)];
        
        // More realistic year group assignment based on phase
        let yearGroup;
        if (phase === 'Primary') {
            yearGroup = yearGroups[Math.floor(Math.random() * 6)]; // Year 1-6
        } else {
            yearGroup = yearGroups[6 + Math.floor(Math.random() * 7)]; // Year 7-13
        }
        
        sampleStaff.push({
            id: 1000 + i,
            name: `${firstName} ${lastName}`,
            phase: phase,
            year_group: yearGroup,
            department: department,
            overseas_thai: isThai ? 'Thai' : 'Overseas'
        });
    }
    
    // Generate sample assignments with varying achievement levels
    const sampleAssignments = [];
    let assignmentId = 1;
    
    // Create a distribution of achievements across staff and standards
    sampleStaff.forEach(staff => {
        sampleStandards.forEach(standard => {
            // Skip some standards to avoid creating too many assignments
            if (Math.random() < 0.05) return;
            
            // Use a pseudo-random approach to create a realistic distribution
            // with some patterns by department, phase, etc.
            let achieved = false;
            
            // Different groups of standards are more likely to be achieved by different staff types
            if (staff.phase === 'Primary' && standard.code.startsWith('A')) {
                achieved = Math.random() < 0.85; // Primary teachers excel at teaching standards
            } 
            else if (staff.phase === 'Secondary' && standard.code.startsWith('C')) {
                achieved = Math.random() < 0.8; // Secondary teachers excel at professional development
            }
            else if (staff.department === 'Computer Science' && standard.code.startsWith('E')) {
                achieved = Math.random() < 0.9; // Computer Science teachers excel at digital competency
            }
            else if (staff.overseas_thai === 'Thai' && standard.code.startsWith('B')) {
                achieved = Math.random() < 0.85; // Thai staff excel at classroom management
            }
            else if (standard.code.startsWith('D') && ['Mathematics', 'Science'].includes(staff.department)) {
                achieved = Math.random() < 0.85; // Maths/Science teachers excel at assessment
            }
            // Default case - roughly 70% achievement
            else {
                achieved = Math.random() < 0.7;
            }
            
            // Achievement is less likely for deeper levels of standards
            if (standard.level === 2) {
                achieved = achieved && (Math.random() < 0.8);
            } else if (standard.level === 3) {
                achieved = achieved && (Math.random() < 0.7);
            }
            
            sampleAssignments.push({
                id: assignmentId++,
                staff_id: staff.id,
                standard_code: standard.code,
                achieved: achieved,
                date_assessed: getRandomDate(),
                notes: achieved ? 
                    selectRandomNote(true) : 
                    selectRandomNote(false)
            });
        });
    });
    
    return {
        staff: sampleStaff,
        standards: sampleStandards,
        groups: sampleGroups,
        assignments: sampleAssignments
    };
}

/**
 * Get a random assessment note
 * @param {boolean} achieved - Whether the standard was achieved
 * @returns {string} - A random note
 */
function selectRandomNote(achieved) {
    const positiveNotes = [
        'Demonstrated excellent competency in this area',
        'Consistently meets this standard in practice',
        'Shows strong skills and knowledge in this area',
        'Excellent performance observed multiple times',
        'Has mastered this standard and can mentor others',
        'Implements this standard effectively in daily practice',
        'Evidence of outstanding capability in this area',
        'Regularly exceeds expectations for this standard',
        'Demonstrates best practices in this area consistently',
        'Strong example of excellence in this standard'
    ];
    
    const negativeNotes = [
        'Needs further development in this area',
        'Has shown some progress but requires more practice',
        'Requires additional support to meet this standard',
        'Working towards achieving this standard',
        'More evidence needed to demonstrate competency',
        'Has theoretical knowledge but needs practical application',
        'Development plan in place to address this area',
        'Currently below expected level for this standard',
        'Scheduled for additional training in this area',
        'Needs to prioritize improvement in this standard'
    ];
    
    const notes = achieved ? positiveNotes : negativeNotes;
    return notes[Math.floor(Math.random() * notes.length)];
}

/**
 * Generate a random date within the last year
 * @returns {string} - ISO date string
 */
function getRandomDate() {
    const now = new Date();
    const pastYear = new Date();
    pastYear.setFullYear(now.getFullYear() - 1);
    
    const randomTimestamp = pastYear.getTime() + Math.random() * (now.getTime() - pastYear.getTime());
    return new Date(randomTimestamp).toISOString();
}

// Expose the function globally to allow calling from other components
window.changeChartDataCategory = changeChartDataCategory;

/**
 * Create a custom chart
 * @param {string} title - Chart title
 * @param {string} type - Chart type
 * @param {string} category - Data category
 */
function createCustomChart(title, type, category) {
    // Get filtered data
    const filteredData = filterSystem.getFilteredData();
    
    // Generate chart data
    let chartData;
    
    if (category === 'auto') {
        chartData = generateChartData(filteredData);
    } else {
        chartData = generateCustomChartData(filteredData, category);
    }
    
    // Create chart options based on chart type
    const options = createChartOptions(type, title);
    
    // Create chart configuration
    const config = {
        type: type,
        title: title,
        data: chartData,
        options: options,
        // Store current filter state
        filters: filteredData.currentFilter,
        // Store the data category used
        dataCategory: category
    };
    
    // Create the chart
    const chartId = ChartSystem.createChart(config);
    Logger.log(`Created new chart: ${chartId} with type ${type} and category ${category}`);
    
    // Add data category selector
    setTimeout(() => {
        const chartHeader = document.querySelector('.chart-header');
        if (chartHeader && !chartHeader.querySelector('#data-category-selector')) {
            addDataCategorySelector(chartHeader);
            // Set the correct value from the category parameter
            const selector = chartHeader.querySelector('#data-category-selector');
            if (selector) {
                selector.value = category;
            }
        }
    }, 100);
    
    return chartId;
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