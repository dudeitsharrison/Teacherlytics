/**
 * Analytics Page
 * For visualizing staff progress with dynamic charts
 */
import { Storage, Logger, Models, Validate } from '../utils/index.js';

// State management
let staffData = [];
let standardsData = [];
let groupsData = [];
let assignmentsData = [];
let chartInstances = {};
let currentFilters = { filters: {} };
let filteredStaff = [];
let filteredStandards = [];
let currentChartType = 'bar';

/**
 * Initialize the Analytics page
 * @param {HTMLElement} container - Container element for the page
 */
export function init(container) {
    Logger.log('Initializing Analytics page');
    
    // Load data
    staffData = Storage.load('staff', []);
    standardsData = Storage.load('standards', []);
    groupsData = Storage.load('groups', []);
    assignmentsData = Storage.load('assignments', []);
    
    // Initially, include all staff and standards
    filteredStaff = [...staffData];
    filteredStandards = [...standardsData];
    
    // Create page structure
    container.innerHTML = `
        <div class="analytics-page content-container">
            <h1>Analytics</h1>
            
            <div class="filter-section">
                <h3>Filters</h3>
                <div class="filter-row"></div>
            </div>
            
            <div class="charts-container">
                <div class="chart-type-selector">
                    <label>
                        <input type="radio" name="chart-type" value="bar" checked> Bar
                    </label>
                    <label>
                        <input type="radio" name="chart-type" value="pie"> Pie
                    </label>
                </div>
                <div class="chart-container">
                    <canvas id="main-chart"></canvas>
                </div>
                <div id="chart-data-table"></div>
            </div>
        </div>
    `;
    
    // Ensure the filter styles are loaded
    ensureFilterStylesLoaded();
    
    // Initialize filters
    initFilters();
    
    // Apply initial filters and generate chart
    applyFilters();
    updateChart();
    
    // Add event listeners
    setupEventListeners();
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
 * Set up event listeners
 */
function setupEventListeners() {
    // Add event listeners for filter changes
    document.querySelectorAll('.filter-select').forEach(select => {
        select.addEventListener('change', () => {
            applyFilters();
            updateChart();
        });
    });
    
    // Add event listeners for chart type changes
    document.querySelectorAll('input[name="chart-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentChartType = e.target.value;
            updateChart();
        });
    });
}

/**
 * Initialize filters
 */
function initFilters() {
    const filterRow = document.querySelector('.filter-row');
    
    // Create filter elements based on staff profile properties
    const filterItems = [
        { id: 'phase', name: 'Phase', type: 'dropdown', options: Models.Staff.phaseOptions },
        { id: 'overseas_thai', name: 'Overseas/Thai', type: 'dropdown', options: Models.Staff.overseasThaiOptions },
        { id: 'year_group', name: 'Year Group', type: 'dropdown', options: Models.Staff.yearGroupOptions },
        { id: 'department', name: 'Department', type: 'dropdown', options: Models.Staff.departmentOptions }
    ];
    
    filterItems.forEach(item => {
        const filterItem = document.createElement('div');
        filterItem.className = 'filter-item';
        
        if (item.type === 'dropdown') {
            filterItem.innerHTML = `
                <label for="filter-${item.id}">${item.name}:</label>
                <select id="filter-${item.id}" class="filter-select" data-field="${item.id}">
                    <option value="">All</option>
                    ${item.options.map(option => `<option value="${option}">${option}</option>`).join('')}
                </select>
            `;
        }
        
        filterRow.appendChild(filterItem);
    });
    
    // Add standard group filter
    const standardGroupFilter = document.createElement('div');
    standardGroupFilter.className = 'filter-item';
    standardGroupFilter.innerHTML = `
        <label for="filter-standard-group">Standard Group:</label>
        <select id="filter-standard-group" class="filter-select" data-field="standard-group">
            <option value="">All</option>
            ${groupsData.map(group => `<option value="${group.name}">${group.name}</option>`).join('')}
        </select>
    `;
    filterRow.appendChild(standardGroupFilter);
    
    // Add filter change listeners
    document.querySelectorAll('.filter-select').forEach(select => {
        select.addEventListener('change', (event) => {
            const field = event.target.dataset.field;
            
            if (event.target.value) {
                currentFilters.filters[field] = event.target.value;
            } else {
                delete currentFilters.filters[field];
            }
        });
    });
}

/**
 * Apply filters to get filtered data
 * @returns {Object} - Filtered data
 */
function applyFilters() {
    // First, filter staff based on staff properties
    const filteredStaff = staffData.filter(staff => {
        for (const [field, value] of Object.entries(currentFilters.filters)) {
            // Skip special filters that aren't staff properties
            if (field === 'standard-group') continue;
            
            const staffValue = staff[field];
            
            // Handle comma-separated values (like multiple phases)
            if (staffValue && staffValue.includes(', ')) {
                const values = staffValue.split(', ').map(v => v.trim());
                if (!values.includes(value)) {
                    return false;
                }
            } else if (staffValue !== value) {
                return false;
            }
        }
        return true;
    });
    
    // Get staff IDs for the filtered staff
    const staffIds = filteredStaff.map(staff => staff.id);
    
    // Filter assignments by staff IDs
    let filteredAssignments = assignmentsData.filter(assignment => 
        staffIds.includes(assignment.staff_id)
    );
    
    // Filter by standard group if specified
    if (currentFilters.filters['standard-group']) {
        const standardsInGroup = standardsData.filter(
            standard => standard.group === currentFilters.filters['standard-group']
        ).map(standard => standard.code);
        
        filteredAssignments = filteredAssignments.filter(assignment => 
            standardsInGroup.includes(assignment.standard_code)
        );
    }
    
    // Calculate statistics
    const totalStaff = filteredStaff.length;
    const totalStandards = currentFilters.filters['standard-group'] 
        ? standardsData.filter(s => s.group === currentFilters.filters['standard-group']).length
        : standardsData.length;
    
    const achievedAssignments = filteredAssignments.filter(a => a.achieved).length;
    const totalPossibleAssignments = totalStaff * totalStandards;
    
    // Calculate achievement percentage
    let achievementPercentage = 0;
    if (totalPossibleAssignments > 0) {
        achievementPercentage = (achievedAssignments / totalPossibleAssignments) * 100;
    }
    
    return {
        totalStaff,
        totalStandards,
        achievedAssignments,
        totalPossibleAssignments,
        achievementPercentage: parseFloat(achievementPercentage.toFixed(2))
    };
}

/**
 * Generate chart based on filtered data
 */
function generateChart() {
    // Clear any existing chart
    if (chartInstances.main) {
        chartInstances.main.destroy();
    }
    
    const chartType = document.getElementById('chart-type').value;
    const canvas = document.getElementById('main-chart');
    
    // Get filtered data
    const filteredData = applyFilters();
    
    // Try to find an appropriate color based on standard groups
    let chartColor = '#3498db'; // Default color
    
    // Try to get color from selected standard group
    if (currentFilters.filters['standard-group']) {
        const groupName = currentFilters.filters['standard-group'];
        const group = groupsData.find(g => g.name === groupName);
        if (group && group.color) {
            chartColor = group.color;
        }
    }
    
    // Prepare data for display
    const displayData = {
        label: getFilterLabel(),
        color: chartColor,
        ...filteredData
    };
    
    // Generate chart based on type
    switch (chartType) {
        case 'bar':
            generateBarChart(canvas, displayData);
            break;
        case 'pie':
            generatePieChart(canvas, displayData);
            break;
        case 'line':
            generateLineChart(canvas, displayData);
            break;
    }
    
    // Generate data table
    generateDataTable(displayData);
}

/**
 * Generate bar chart
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} data - Chart data
 */
function generateBarChart(canvas, data) {
    const ctx = canvas.getContext('2d');
    
    const labels = [data.label];
    const achievementData = [data.achievementPercentage];
    const backgroundColors = [data.color];
    
    chartInstances.main = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Achievement Percentage',
                data: achievementData,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(color => adjustColor(color, -20)),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Achievement Percentage (%)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Standards Achievement by Filter'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const item = data[index];
                            return [
                                `Achievement: ${item.achievementPercentage}%`,
                                `Achieved: ${item.achievedAssignments} / ${item.totalPossibleAssignments}`,
                                `Staff: ${item.totalStaff}, Standards: ${item.totalStandards}`
                            ];
                        }
                    }
                }
            }
        }
    });
}

/**
 * Generate pie chart
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} data - Chart data
 */
function generatePieChart(canvas, data) {
    const ctx = canvas.getContext('2d');
    
    const labels = [data.label];
    const achievementData = [data.achievedAssignments];
    const backgroundColors = [data.color];
    
    chartInstances.main = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Achieved Standards',
                data: achievementData,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(color => adjustColor(color, -20)),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Standards Achievement Distribution'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const item = data[index];
                            return [
                                `Achieved: ${item.achievedAssignments} standards`,
                                `Achievement Rate: ${item.achievementPercentage}%`,
                                `Staff: ${item.totalStaff}, Standards: ${item.totalStandards}`
                            ];
                        }
                    }
                }
            }
        }
    });
}

/**
 * Generate line chart
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} data - Chart data
 */
function generateLineChart(canvas, data) {
    const ctx = canvas.getContext('2d');
    
    // For line chart, we need a time series
    // Since we don't have historical data, we'll use the current data point
    // and add some simulated points based on current achievement
    
    const baseValue = data.achievementPercentage;
    const simulatedData = [
        baseValue * 0.5,  // Start at half the current value
        baseValue * 0.7,
        baseValue * 0.9,
        baseValue,
        baseValue * 1.05   // Projected future value
    ];
    
    chartInstances.main = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Q1', 'Q2', 'Q3', 'Current', 'Projected'],
            datasets: [{
                label: data.label,
                data: simulatedData,
                borderColor: data.color,
                backgroundColor: adjustColor(data.color, 0, 0.2),
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Achievement Percentage (%)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Standards Achievement Over Time (Simulated)'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const item = data[index];
                            return [
                                `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`,
                                `Current: ${item.achievementPercentage}%`,
                                `Staff: ${item.totalStaff}, Standards: ${item.totalStandards}`
                            ];
                        }
                    }
                }
            }
        }
    });
}

/**
 * Generate data table with results
 * @param {Object} data - Data for the table
 */
function generateDataTable(data) {
    const tableContainer = document.getElementById('chart-data-table');
    
    tableContainer.innerHTML = `
        <h3>Data Summary</h3>
        <table class="table">
            <thead>
                <tr>
                    <th>Filter</th>
                    <th>Staff</th>
                    <th>Standards</th>
                    <th>Achieved</th>
                    <th>Total Possible</th>
                    <th>Achievement %</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${data.label}</td>
                    <td>${data.totalStaff}</td>
                    <td>${data.totalStandards}</td>
                    <td>${data.achievedAssignments}</td>
                    <td>${data.totalPossibleAssignments}</td>
                    <td>${data.achievementPercentage}%</td>
                </tr>
            </tbody>
        </table>
    `;
    
    // Add style for color dot if not already added
    if (!document.getElementById('data-table-styles')) {
        const style = document.createElement('style');
        style.id = 'data-table-styles';
        style.textContent = `
            .color-dot {
                display: inline-block;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                margin-right: 8px;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Get a readable label for the current filters
 * @returns {string} - Readable name
 */
function getFilterLabel() {
    if (Object.keys(currentFilters.filters).length === 0) {
        return 'All Staff';
    }
    
    const parts = [];
    
    if (currentFilters.filters.phase) {
        parts.push(currentFilters.filters.phase);
    }
    
    if (currentFilters.filters.department) {
        parts.push(currentFilters.filters.department);
    }
    
    if (currentFilters.filters.overseas_thai && currentFilters.filters.overseas_thai !== 'All') {
        parts.push(currentFilters.filters.overseas_thai);
    }
    
    if (currentFilters.filters.year_group) {
        parts.push(currentFilters.filters.year_group);
    }
    
    if (currentFilters.filters['standard-group']) {
        parts.push(`Standards: ${currentFilters.filters['standard-group']}`);
    }
    
    return parts.length > 0 ? parts.join(', ') : 'All Staff';
}

/**
 * Export the current chart as an image
 */
function exportChart() {
    if (!chartInstances.main) {
        alert('Please generate a chart first.');
        return;
    }
    
    const canvas = document.getElementById('main-chart');
    const chartType = document.getElementById('chart-type').value;
    
    // Create an image
    const image = canvas.toDataURL('image/png');
    
    // Create a link and click it to download
    const link = document.createElement('a');
    link.download = `staff-standards-${chartType}-chart.png`;
    link.href = image;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    Logger.log('Exported chart as image');
}

/**
 * Adjust a color's brightness
 * @param {string} color - Hex color code
 * @param {number} amount - Amount to adjust brightness
 * @param {number} alpha - Optional alpha value
 * @returns {string} - Adjusted color
 */
function adjustColor(color, amount = 0, alpha = 1) {
    // Remove # if present
    color = color.replace('#', '');
    
    // Parse to RGB
    let r = parseInt(color.substring(0, 2), 16);
    let g = parseInt(color.substring(2, 4), 16);
    let b = parseInt(color.substring(4, 6), 16);
    
    // Adjust brightness
    r = Math.max(0, Math.min(255, r + amount));
    g = Math.max(0, Math.min(255, g + amount));
    b = Math.max(0, Math.min(255, b + amount));
    
    // Return rgba or hex
    if (alpha < 1) {
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } else {
        return `#${(r).toString(16).padStart(2, '0')}${(g).toString(16).padStart(2, '0')}${(b).toString(16).padStart(2, '0')}`;
    }
}

/**
 * Helper function to convert hex to RGBA
 * @param {string} hex - Hex color string
 * @param {number} opacity - Opacity value
 * @returns {string} - RGBA color string
 */
function hexToRGBA(hex, opacity) {
    // Remove # if present
    hex = hex.replace(/^#/, '');
    
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
}

/**
 * Update the chart based on the current filters and chart type
 */
function updateChart() {
    generateChart();
} 