/**
 * ChartSystem Module
 * Provides a dynamic, reusable chart generation system with live-updating
 * charts, consistent filtering, and interactive features
 */

// Store chart instances
let chartInstances = {};
let chartConfigurations = [];
let activeChartId = null;
let timelineCharts = [];

// DOM element references
let chartContainer = null;
let timelineContainer = null;

/**
 * Initialize the chart system
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.chartContainer - Container for active charts
 * @param {HTMLElement} options.timelineContainer - Container for timeline charts
 * @param {Function} options.onFilterChange - Callback when filters change
 * @param {Function} options.applyFilters - Function to apply filters
 */
export function init(options) {
    chartContainer = options.chartContainer;
    timelineContainer = options.timelineContainer;
    
    // Load saved chart configurations
    loadSavedCharts();
    
    // Setup the timeline wheel
    setupTimelineWheel();
}

/**
 * Create a new chart with the given configuration
 * @param {Object} config - Chart configuration
 * @param {String} config.type - Chart type (bar, pie, line, etc.)
 * @param {String} config.title - Chart title
 * @param {Object} config.filters - Filters applied to the chart
 * @param {Array} config.data - Chart data
 * @param {Boolean} config.isActive - Whether this is the active chart
 * @returns {String} - ID of the created chart
 */
export function createChart(config) {
    const chartId = `chart-${Date.now()}`;
    
    // Initialize chart configuration
    const chartConfig = {
        id: chartId,
        type: config.type || 'bar',
        title: config.title || 'New Chart',
        filters: config.filters || {},
        data: config.data || [],
        options: config.options || {},
        consolidations: config.consolidations || [],
        isActive: config.isActive !== undefined ? config.isActive : true,
        // Store filter state as part of the chart configuration
        filterState: config.filterState || {},
        // Store data category for easier data regeneration
        dataCategory: config.dataCategory || 'auto'
    };
    
    // Add to chart configurations array
    chartConfigurations.push(chartConfig);
    
    // If active, display in main container, otherwise add to timeline
    if (chartConfig.isActive) {
        // If there's already an active chart, move it to timeline
        if (activeChartId) {
            minimizeChart(activeChartId);
        }
        activeChartId = chartId;
        renderActiveChart(chartId);
    } else {
        addToTimeline(chartId);
    }
    
    return chartId;
}

/**
 * Update an existing chart with new data or options
 * @param {String} chartId - ID of the chart to update
 * @param {Object} updates - Updates to apply to the chart
 */
export function updateChart(chartId, updates) {
    const chartIndex = chartConfigurations.findIndex(c => c.id === chartId);
    
    if (chartIndex === -1) return;
    
    // Apply updates
    Object.assign(chartConfigurations[chartIndex], updates);
    
    // Re-render the chart if it's active
    if (chartId === activeChartId) {
        renderActiveChart(chartId);
    } else if (timelineCharts.includes(chartId)) {
        updateTimelineChart(chartId);
    }
}

/**
 * Minimize the active chart to the timeline
 * @param {String} chartId - ID of the chart to minimize
 */
export function minimizeChart(chartId) {
    const chartIndex = chartConfigurations.findIndex(c => c.id === chartId);
    
    if (chartIndex === -1 || chartId !== activeChartId) return;
    
    // Update active status
    chartConfigurations[chartIndex].isActive = false;
    
    // Clear the active chart ID
    const previousActiveId = activeChartId;
    activeChartId = null;
    
    // Destroy the chart instance
    if (chartInstances[chartId]) {
        try {
            // Make sure any canvas-specific event handlers are removed
            const canvas = chartInstances[chartId].canvas;
            if (canvas && canvas._cleanupScrollHandlers) {
                canvas._cleanupScrollHandlers();
            }
            
            // Destroy the chart instance
            chartInstances[chartId].destroy();
            delete chartInstances[chartId];
        } catch (error) {
            console.warn(`Error cleaning up chart ${chartId}:`, error);
        }
    }
    
    // Add to timeline
    addToTimeline(previousActiveId);
    
    // Clear the chart container
    chartContainer.innerHTML = getEmptyChartHtml();
}

/**
 * Restore a chart from the timeline to the active view
 * @param {String} chartId - ID of the chart to restore
 */
export function restoreChart(chartId) {
    const chartIndex = chartConfigurations.findIndex(c => c.id === chartId);
    
    if (chartIndex === -1) return;
    
    // If there's already an active chart, minimize it
    if (activeChartId && activeChartId !== chartId) {
        // Explicitly clean up any event handlers
        if (chartInstances[activeChartId]) {
            try {
                const canvas = chartInstances[activeChartId].canvas;
                if (canvas && canvas._cleanupScrollHandlers) {
                    canvas._cleanupScrollHandlers();
                }
            } catch (error) {
                console.warn(`Error cleaning up active chart:`, error);
            }
        }
        minimizeChart(activeChartId);
    }
    
    // Update chart status
    chartConfigurations[chartIndex].isActive = true;
    activeChartId = chartId;
    
    // Remove from timeline
    removeFromTimeline(chartId);
    
    // Render in main container
    renderActiveChart(chartId);
}

/**
 * Save the current chart configuration with a name
 * @param {String} chartId - ID of the chart to save
 * @param {String} name - Name to save the chart as
 * @param {Boolean} isDuplicate - Whether this is a duplicate
 */
export function saveChartConfiguration(chartId, name, isDuplicate = false) {
    const chartIndex = chartConfigurations.findIndex(c => c.id === chartId);
    
    if (chartIndex === -1) return;
    
    // Get the chart configuration
    const chartConfig = { ...chartConfigurations[chartIndex] };
    
    // If duplicating, create a new ID
    if (isDuplicate) {
        chartConfig.id = `chart-${Date.now()}`;
    }
    
    // Set the saved name
    chartConfig.savedName = name;
    chartConfig.savedAt = new Date().toISOString();
    
    // Save to local storage
    const savedCharts = getSavedCharts();
    
    // Check if chart with this name already exists
    const existingIndex = savedCharts.findIndex(c => c.savedName === name);
    
    if (existingIndex !== -1 && !isDuplicate) {
        // Update existing saved chart
        savedCharts[existingIndex] = chartConfig;
    } else {
        // Add as new saved chart
        savedCharts.push(chartConfig);
    }
    
    // Save back to storage
    localStorage.setItem('saved_charts', JSON.stringify(savedCharts));
    
    return isDuplicate ? chartConfig.id : chartId;
}

/**
 * Get list of saved chart configurations
 * @returns {Array} - Array of saved chart configurations
 */
export function getSavedCharts() {
    const savedCharts = localStorage.getItem('saved_charts');
    return savedCharts ? JSON.parse(savedCharts) : [];
}

/**
 * Load saved chart configurations
 */
function loadSavedCharts() {
    const savedCharts = getSavedCharts();
    
    // Add saved charts to configurations
    savedCharts.forEach(savedConfig => {
        // Ensure the chart has a unique ID
        savedConfig.id = `chart-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        savedConfig.isActive = false;
        
        chartConfigurations.push(savedConfig);
        addToTimeline(savedConfig.id);
    });
}

/**
 * Render a chart in the main chart container
 * @param {String} chartId - ID of the chart to render
 */
function renderActiveChart(chartId) {
    const chartConfig = chartConfigurations.find(c => c.id === chartId);
    
    if (!chartConfig) return;
    
    // Create chart container HTML
    chartContainer.innerHTML = `
        <div class="chart-wrapper">
            <div class="chart-header">
                <h3>${chartConfig.title}</h3>
                <div class="chart-actions">
                    <button class="button button-icon consolidate-btn" data-chart-id="${chartId}" title="Consolidate Data">
                        <i class="fas fa-layer-group"></i>
                    </button>
                    <button class="button button-icon add-comparison-btn" data-chart-id="${chartId}" title="Add Comparison">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="button button-icon save-chart-btn" data-chart-id="${chartId}" title="Save Chart">
                        <i class="fas fa-save"></i>
                    </button>
                    <button class="button button-icon minimize-btn" data-chart-id="${chartId}" title="Minimize">
                        <i class="fas fa-compress"></i>
                    </button>
                </div>
            </div>
            <div class="chart-body">
                <canvas id="${chartId}-canvas"></canvas>
            </div>
            <div class="consolidate-options" id="${chartId}-consolidate-options" style="display: none;">
                <!-- Consolidation options will be populated dynamically -->
            </div>
        </div>
    `;
    
    // Add event listeners
    document.querySelector(`.consolidate-btn[data-chart-id="${chartId}"]`)
        .addEventListener('click', () => toggleConsolidateOptions(chartId));
        
    document.querySelector(`.add-comparison-btn[data-chart-id="${chartId}"]`)
        .addEventListener('click', () => addComparisonChart(chartId));
        
    document.querySelector(`.save-chart-btn[data-chart-id="${chartId}"]`)
        .addEventListener('click', () => showSaveChartDialog(chartId));
        
    document.querySelector(`.minimize-btn[data-chart-id="${chartId}"]`)
        .addEventListener('click', () => minimizeChart(chartId));
    
    // Create the chart
    const canvas = document.getElementById(`${chartId}-canvas`);
    createChartInstance(chartId, canvas, chartConfig);
}

/**
 * Get HTML for empty chart container
 */
function getEmptyChartHtml() {
    return `
        <div class="empty-chart-container">
            <p>No active chart. Restore one from the timeline below or create a new comparison.</p>
            <button class="button create-chart-btn">Create New Chart</button>
        </div>
    `;
}

/**
 * Create a Chart.js instance
 * @param {String} chartId - ID for the chart
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} config - Chart configuration
 */
function createChartInstance(chartId, canvas, config) {
    // Destroy previous instance if it exists
    if (chartInstances[chartId]) {
        try {
            // Ensure we properly clean up by explicitly calling destroy
            chartInstances[chartId].destroy();
            delete chartInstances[chartId];
        } catch (error) {
            console.warn(`Error destroying chart ${chartId}:`, error);
        }
    }
    
    // Create chart instance based on type
    try {
        const ctx = canvas.getContext('2d');
        
        chartInstances[chartId] = new Chart(ctx, {
            type: config.type,
            data: {
                labels: config.data.labels || [],
                datasets: config.data.datasets || []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: config.title
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                ...config.options
            }
        });
        
        return chartInstances[chartId];
    } catch (error) {
        console.error(`Failed to create chart ${chartId}:`, error);
        return null;
    }
}

/**
 * Setup the timeline wheel for minimized charts
 */
function setupTimelineWheel() {
    // Create the timeline wheel container if it doesn't exist
    if (!timelineContainer.querySelector('.timeline-wheel')) {
        timelineContainer.innerHTML = `
            <div class="timeline-wheel-container">
                <button class="timeline-scroll-btn scroll-left">&lt;</button>
                <div class="timeline-wheel"></div>
                <button class="timeline-scroll-btn scroll-right">&gt;</button>
            </div>
        `;
        
        // Add event listeners for scroll buttons
        timelineContainer.querySelector('.scroll-left').addEventListener('click', () => {
            const wheel = timelineContainer.querySelector('.timeline-wheel');
            wheel.scrollBy({ left: -200, behavior: 'smooth' });
        });
        
        timelineContainer.querySelector('.scroll-right').addEventListener('click', () => {
            const wheel = timelineContainer.querySelector('.timeline-wheel');
            wheel.scrollBy({ left: 200, behavior: 'smooth' });
        });
    }
}

/**
 * Add a chart to the timeline wheel
 * @param {String} chartId - ID of the chart to add
 */
function addToTimeline(chartId) {
    const chartConfig = chartConfigurations.find(c => c.id === chartId);
    
    if (!chartConfig || timelineCharts.includes(chartId)) return;
    
    // Add to timeline charts array
    timelineCharts.push(chartId);
    
    // Create thumbnail element
    const timelineWheel = timelineContainer.querySelector('.timeline-wheel');
    const thumbnail = document.createElement('div');
    thumbnail.className = 'chart-thumbnail';
    thumbnail.dataset.chartId = chartId;
    thumbnail.innerHTML = `
        <div class="thumbnail-header">
            <span class="thumbnail-title">${chartConfig.savedName || chartConfig.title}</span>
        </div>
        <canvas id="${chartId}-thumb"></canvas>
    `;
    
    timelineWheel.appendChild(thumbnail);
    
    // Add click event to restore chart
    thumbnail.addEventListener('click', () => restoreChart(chartId));
    
    // Create mini chart
    const thumbCanvas = document.getElementById(`${chartId}-thumb`);
    createMiniChartInstance(chartId, thumbCanvas, chartConfig);
    
    // Animate the timeline
    animateTimeline();
}

/**
 * Create a mini Chart.js instance for thumbnails
 * @param {String} chartId - ID for the chart
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} config - Chart configuration
 */
function createMiniChartInstance(chartId, canvas, config) {
    const ctx = canvas.getContext('2d');
    
    // Create a simplified version of the chart for the thumbnail
    new Chart(ctx, {
        type: config.type,
        data: {
            labels: config.data.labels || [],
            datasets: config.data.datasets || []
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            },
            scales: {
                x: {
                    display: false
                },
                y: {
                    display: false
                }
            },
            elements: {
                line: {
                    tension: 0.4
                },
                point: {
                    radius: 0
                }
            }
        }
    });
}

/**
 * Animate the timeline when a new chart is added
 */
function animateTimeline() {
    const timelineWheel = timelineContainer.querySelector('.timeline-wheel');
    
    // Scroll to the end of the timeline
    setTimeout(() => {
        timelineWheel.scrollTo({
            left: timelineWheel.scrollWidth,
            behavior: 'smooth'
        });
    }, 100);
}

/**
 * Remove a chart from the timeline
 * @param {String} chartId - ID of the chart to remove
 */
function removeFromTimeline(chartId) {
    // Remove from timeline charts array
    const index = timelineCharts.indexOf(chartId);
    if (index !== -1) {
        timelineCharts.splice(index, 1);
    }
    
    // Remove thumbnail element
    const thumbnail = timelineContainer.querySelector(`.chart-thumbnail[data-chart-id="${chartId}"]`);
    if (thumbnail) {
        thumbnail.remove();
    }
}

/**
 * Toggle the consolidate options menu
 * @param {String} chartId - ID of the chart
 */
function toggleConsolidateOptions(chartId) {
    const optionsContainer = document.getElementById(`${chartId}-consolidate-options`);
    
    // Toggle visibility
    if (optionsContainer.style.display === 'none') {
        // Populate consolidation options
        populateConsolidationOptions(chartId, optionsContainer);
        optionsContainer.style.display = 'block';
    } else {
        optionsContainer.style.display = 'none';
    }
}

/**
 * Populate consolidation options for a chart
 * @param {String} chartId - ID of the chart
 * @param {HTMLElement} container - Container to populate
 */
function populateConsolidationOptions(chartId, container) {
    const chartConfig = chartConfigurations.find(c => c.id === chartId);
    
    if (!chartConfig) return;
    
    // Get automatic consolidation suggestions based on chart data
    const suggestions = detectConsolidationOptions(chartConfig);
    
    // Build HTML for options
    let optionsHtml = '<h4>Consolidate Data</h4><ul class="consolidation-list">';
    
    suggestions.forEach(suggestion => {
        const isActive = chartConfig.consolidations.includes(suggestion.id);
        optionsHtml += `
            <li>
                <label class="consolidation-option ${isActive ? 'active' : ''}">
                    <input type="checkbox" data-consolidation-id="${suggestion.id}" 
                           ${isActive ? 'checked' : ''}>
                    ${suggestion.label}
                </label>
            </li>
        `;
    });
    
    optionsHtml += '</ul>';
    
    // Add a button to apply consolidations
    optionsHtml += `
        <div class="consolidation-actions">
            <button class="button apply-consolidation-btn" data-chart-id="${chartId}">Apply</button>
            <button class="button button-secondary clear-consolidation-btn" data-chart-id="${chartId}">Clear All</button>
        </div>
    `;
    
    container.innerHTML = optionsHtml;
    
    // Add event listeners
    container.querySelector('.apply-consolidation-btn').addEventListener('click', () => {
        applyConsolidations(chartId);
        container.style.display = 'none';
    });
    
    container.querySelector('.clear-consolidation-btn').addEventListener('click', () => {
        clearConsolidations(chartId);
        container.style.display = 'none';
    });
}

/**
 * Detect possible consolidation options based on chart data
 * @param {Object} chartConfig - Chart configuration
 * @returns {Array} - Array of consolidation options
 */
function detectConsolidationOptions(chartConfig) {
    // This would analyze the data and return possible groupings
    // For example: "All Year 3", "All Thai Teachers", "All Outclass"
    
    // Sample implementation - in a real system this would analyze actual data
    return [
        { id: 'year3', label: 'All Year 3' },
        { id: 'thai', label: 'All Thai Teachers' },
        { id: 'outclass', label: 'All Outclass' },
        { id: 'overseas', label: 'All Overseas Teachers' },
        { id: 'primary', label: 'All Primary' }
    ];
}

/**
 * Apply selected consolidations to the chart
 * @param {String} chartId - ID of the chart
 */
function applyConsolidations(chartId) {
    const chartConfig = chartConfigurations.find(c => c.id === chartId);
    
    if (!chartConfig) return;
    
    // Get all checked consolidation options
    const checkboxes = document.querySelectorAll(`#${chartId}-consolidate-options input:checked`);
    const consolidations = Array.from(checkboxes).map(cb => cb.dataset.consolidationId);
    
    // Update chart configuration
    chartConfig.consolidations = consolidations;
    
    // Update the chart
    updateChart(chartId, { consolidations });
}

/**
 * Clear all consolidations from a chart
 * @param {String} chartId - ID of the chart
 */
function clearConsolidations(chartId) {
    // Update chart configuration
    updateChart(chartId, { consolidations: [] });
    
    // Uncheck all consolidation options
    const checkboxes = document.querySelectorAll(`#${chartId}-consolidate-options input`);
    checkboxes.forEach(cb => cb.checked = false);
}

/**
 * Add a comparison chart
 * @param {String} baseChartId - ID of the base chart to compare with
 */
function addComparisonChart(baseChartId) {
    const baseConfig = chartConfigurations.find(c => c.id === baseChartId);
    
    if (!baseConfig) return;
    
    // Create a copy of the base chart configuration
    const newConfig = {
        ...baseConfig,
        id: undefined,  // Will be generated by createChart
        title: `${baseConfig.title} - Comparison`,
        isActive: true
    };
    
    // Create the new chart
    createChart(newConfig);
}

/**
 * Show the dialog to save a chart configuration
 * @param {String} chartId - ID of the chart to save
 */
function showSaveChartDialog(chartId) {
    const chartConfig = chartConfigurations.find(c => c.id === chartId);
    
    if (!chartConfig) return;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Save Chart</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="chart-name">Chart Name</label>
                    <input type="text" id="chart-name" class="form-control" 
                           value="${chartConfig.savedName || chartConfig.title}">
                </div>
                <div class="save-options">
                    <button class="button save-new-btn">Save</button>
                    <button class="button button-secondary save-duplicate-btn">Save as Duplicate</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('.close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.querySelector('.save-new-btn').addEventListener('click', () => {
        const name = document.getElementById('chart-name').value.trim();
        if (name) {
            saveChartConfiguration(chartId, name);
            document.body.removeChild(modal);
        }
    });
    
    modal.querySelector('.save-duplicate-btn').addEventListener('click', () => {
        const name = document.getElementById('chart-name').value.trim();
        if (name) {
            saveChartConfiguration(chartId, name, true);
            document.body.removeChild(modal);
        }
    });
    
    // Show modal
    setTimeout(() => {
        modal.classList.add('show');
        document.getElementById('chart-name').focus();
    }, 50);
}

/**
 * Update a chart in the timeline
 * @param {String} chartId - ID of the chart to update
 */
function updateTimelineChart(chartId) {
    const chartConfig = chartConfigurations.find(c => c.id === chartId);
    
    if (!chartConfig) return;
    
    // Update thumbnail title
    const thumbnail = timelineContainer.querySelector(`.chart-thumbnail[data-chart-id="${chartId}"]`);
    if (thumbnail) {
        const titleEl = thumbnail.querySelector('.thumbnail-title');
        if (titleEl) {
            titleEl.textContent = chartConfig.savedName || chartConfig.title;
        }
        
        // Update thumbnail chart
        const thumbCanvas = document.getElementById(`${chartId}-thumb`);
        if (thumbCanvas) {
            createMiniChartInstance(chartId, thumbCanvas, chartConfig);
        }
    }
}

/**
 * Get all chart configurations
 * @returns {Array} - Chart configurations
 */
export function getChartConfigurations() {
    return chartConfigurations;
}

/**
 * Clean up all chart instances and event listeners
 * Should be called when the application is shutting down or navigating away
 */
export function cleanup() {
    // Clean up and destroy all chart instances
    Object.keys(chartInstances).forEach(chartId => {
        try {
            const chart = chartInstances[chartId];
            if (chart && chart.canvas && chart.canvas._cleanupScrollHandlers) {
                chart.canvas._cleanupScrollHandlers();
            }
            chart.destroy();
        } catch (error) {
            console.warn(`Error cleaning up chart ${chartId}:`, error);
        }
    });
    
    // Reset chart instances
    chartInstances = {};
    chartConfigurations = [];
    activeChartId = null;
    timelineCharts = [];
    
    // Clear containers if they exist
    if (chartContainer) chartContainer.innerHTML = '';
    if (timelineContainer) timelineContainer.innerHTML = '';
}

// Export the cleanup function
export const ChartSystem = {
    init,
    createChart,
    updateChart,
    minimizeChart,
    restoreChart,
    saveChartConfiguration,
    getSavedCharts,
    getChartConfigurations,
    cleanup
}; 