/**
 * Standards Page
 * For defining and managing standards with grouping
 */
import { Storage, Logger, Models, Validate } from '../utils/index.js';

// Debug log to check Models object
console.log('Models loaded:', Models);
console.log('Standard.getLevel exists:', Models?.Standard?.getLevel);

// Polyfill for Models.Standard functions if they're missing
if (Models && Models.Standard) {
    // Ensure getLevel exists
    if (typeof Models.Standard.getLevel !== 'function') {
        console.log('Adding getLevel polyfill');
        Models.Standard.getLevel = (code) => {
            if (!code) return 0;
            if (typeof code !== 'string') return 0;
            const parts = code.split('.');
            return parts.length > 1 ? parts.length - 1 : 0;
        };
    }
    
    // Ensure hasChildren exists
    if (typeof Models.Standard.hasChildren !== 'function') {
        console.log('Adding hasChildren polyfill');
        Models.Standard.hasChildren = (standard) => {
            if (!standard) return false;
            return Array.isArray(standard.children) && standard.children.length > 0;
        };
    }
    
    // Ensure generateNewCode exists
    if (typeof Models.Standard.generateNewCode !== 'function') {
        console.log('Adding generateNewCode polyfill');
        Models.Standard.generateNewCode = (standards, parentCode, groupLetter) => {
            if (!Array.isArray(standards)) standards = [];
            
            if (parentCode) {
                return `${parentCode}.1`;
            } else if (groupLetter) {
                return `${groupLetter}.1`;
            }
            
            return '';
        };
    }
}

// Define standard table columns with customizable properties
const standardColumns = [
    { id: 'code', name: 'Code', width: '15%', visible: true },
    { id: 'name', name: 'Name', width: '20%', visible: true },
    { id: 'description', name: 'Description', width: '45%', visible: true },
    { id: 'actions', name: 'Actions', width: '20%', visible: true }
];

// State management
let standardsData = [];
let groupsData = [];

// Load column settings
function loadColumnSettings() {
    const savedColumns = Storage.load('standards_columns', null);
    if (savedColumns) {
        // Apply saved settings to columns
        savedColumns.forEach(savedCol => {
            const col = standardColumns.find(c => c.id === savedCol.id);
            if (col) {
                col.visible = savedCol.visible;
                col.width = savedCol.width;
            }
        });
    }
}

// Save column settings to storage
function saveColumnSettings() {
    // Create a simplified version of columns for storage
    const columnSettings = standardColumns.map(col => ({
        id: col.id,
        visible: col.visible,
        width: col.width
    }));
    
    Storage.save('standards_columns', columnSettings);
    Logger.log('Saved standards column settings');
}

/**
 * Initialize the Standards page
 * @param {HTMLElement} container - Container element for the page
 */
export function init(container) {
    Logger.log('Initializing Standards page');
    
    // Safety check for Models
    if (!Models || !Models.Standard || typeof Models.Standard.getLevel !== 'function') {
        console.error('Models.Standard.getLevel is not properly defined!', Models);
        container.innerHTML = `
            <div class="error-message">
                <h2>Error Loading Standards</h2>
                <p>There was a problem initializing the Standards module.</p>
                <p>Please refresh the page or contact support if the problem persists.</p>
            </div>
        `;
        return;
    }
    
    // Load column settings
    loadColumnSettings();
    
    // Load data
    standardsData = Storage.load('standards', []);
    groupsData = Storage.load('groups', []);
    
    // Update existing standards with level information if needed
    standardsData.forEach(standard => {
        if (standard.level === undefined) {
            standard.level = Models.Standard.getLevel(standard.code);
        }
    });
    
    // Check if we need to prompt for group creation
    const promptForGroup = groupsData.length === 0 && standardsData.length === 0;
    
    // Create page structure
    container.innerHTML = `
        <h1>Standards Management</h1>
        <div class="page-description">
            <p>Manage standards in a hierarchical system. Each group is assigned a letter (A, B, C...) 
               and all standards within that group have codes starting with that letter.</p>
        </div>
        <div class="standards-controls mb-1">
            <button id="add-standard" class="button">Add Standard</button>
            <button id="manage-groups" class="button button-secondary">Manage Groups</button>
            <button id="manage-columns" class="button button-secondary">Manage Columns</button>
        </div>
        
        ${promptForGroup ? `
            <div class="info-message">
                <p>No standard groups defined yet. Create a group to organize your standards.</p>
                <p>Each group gets a letter code (A, B, C...) and all standards in that group will 
                   have codes starting with that letter, like A.1, A.2, etc.</p>
                <button id="create-first-group" class="button mt-1">Create First Group</button>
            </div>
        ` : ''}
        
        <div id="standards-container" class="${promptForGroup ? 'hidden' : ''}">
            <div class="standards-layout">
                <div class="standards-sidebar">
                    <div class="sidebar-header">
                        <h3>Standards Tree</h3>
                        <div class="sidebar-info">
                            Drag and drop standards to reorganize the hierarchy
                        </div>
                    </div>
                    <div id="standards-tree"></div>
                </div>
                <div class="standards-content">
                    <div id="grouped-standards"></div>
                    <div id="ungrouped-standards" class="mt-1">
                        <div id="ungrouped-standards-list"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Initialize components
    if (!promptForGroup) {
        renderStandards();
        renderStandardsTree();
    }
    
    // Add event listeners
    document.getElementById('add-standard').addEventListener('click', handleAddStandard);
    document.getElementById('manage-groups').addEventListener('click', handleManageGroups);
    document.getElementById('manage-columns').addEventListener('click', handleManageColumns);
    
    if (promptForGroup) {
        document.getElementById('create-first-group').addEventListener('click', handleCreateFirstGroup);
    }
    
    // Add a demo tip for the drag and drop functionality
    if (!promptForGroup && groupsData.length > 0) {
        setTimeout(() => {
            const tipBox = document.createElement('div');
            tipBox.className = 'info-message';
            tipBox.innerHTML = `
                <p><strong>New Feature:</strong> You can now reorganize standards by dragging and dropping in the standards tree.</p>
                <ul>
                    <li>Drag a standard onto another standard to make it a child</li>
                    <li>Drag a standard onto a group header to move it to that group</li>
                </ul>
                <button class="button button-small" id="dismiss-tip">Got it</button>
            `;
            
            // Insert at the top of the content
            const contentArea = document.querySelector('.standards-content');
            contentArea.insertBefore(tipBox, contentArea.firstChild);
            
            // Add dismiss button
            document.getElementById('dismiss-tip').addEventListener('click', () => {
                tipBox.style.display = 'none';
            });
        }, 500);
    }
}

/**
 * Render all standards grouped by their groups
 * @param {string} [highlightCode] - Code of standard to highlight and ensure visible (auto-expand)
 */
function renderStandards(highlightCode = null) {
    Logger.log('Rendering standards');
    console.log('Rendering standards with highlightCode:', highlightCode);
    
    // Render grouped standards
    renderGroupedStandards(highlightCode);
    
    // Render ungrouped standards
    renderUngroupedStandards(highlightCode);
    
    // Render the standards tree in the sidebar
    renderStandardsTree(highlightCode);
    
    // Add event listeners
    addEventListeners();
}

/**
 * Render standards organized by groups
 * @param {string} [highlightCode] - Code of standard to highlight and ensure visible
 */
function renderGroupedStandards(highlightCode = null) {
    console.log('Rendering grouped standards, highlight code:', highlightCode);
    
    const container = document.getElementById('grouped-standards');
    container.innerHTML = '';
    
    // Sort groups by code
    const sortedGroups = [...groupsData].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    
    sortedGroups.forEach(group => {
        // Get ALL standards for this group (not just top-level)
        const allGroupStandards = standardsData.filter(standard => 
            standard.group === group.name
        );
        
        // Filter top-level standards for this group
        const topLevelStandards = allGroupStandards.filter(standard => 
            !standard.parent_code || standard.parent_code === ''
        );
        
        console.log(`Group ${group.name}: ${allGroupStandards.length} total standards, ${topLevelStandards.length} top-level`);
        
        if (topLevelStandards.length === 0) {
            return; // Skip empty groups
        }
        
        console.log(`Rendering group ${group.name} with ${topLevelStandards.length} top-level standards`);
        console.log('All standards in this group:', allGroupStandards);
        
        // Check if this group contains the highlighted standard
        let shouldExpandGroup = false;
        if (highlightCode) {
            const highlightedStandard = standardsData.find(s => s.code === highlightCode);
            if (highlightedStandard && highlightedStandard.group === group.name) {
                shouldExpandGroup = true;
            }
        }
        
        // Create group section
        const groupSection = document.createElement('div');
        groupSection.className = 'standard-group';
        groupSection.style.borderLeft = `5px solid ${group.color}`;
        groupSection.dataset.group = group.name || ''; // Add data attribute for navigation
        
        // Create group header
        const groupHeader = document.createElement('div');
        groupHeader.className = 'standard-group-header';
        groupHeader.innerHTML = `
            <div class="group-header-content">
                <h3 class="group-title"><span class="group-code">${group.code || ''}</span>${group.name || 'Unnamed Group'}</h3>
                <div class="group-header-description">${group.description || ''}</div>
                <div class="group-header-count">${countGroupStandards(group.name)} standards</div>
            </div>
            <div class="group-header-controls">
                <button class="button button-secondary toggle-group-collapse" data-group="${group.name}">
                    ${group.collapsed && !shouldExpandGroup ? 'Expand' : 'Collapse'}
                </button>
                <button class="button edit-group" data-group="${group.name}">Edit</button>
            </div>
        `;
        
        groupSection.appendChild(groupHeader);
        
        // Create standards list for this group
        const standardsList = document.createElement('div');
        standardsList.className = 'standards-list';
        standardsList.style.display = group.collapsed && !shouldExpandGroup ? 'none' : 'block';
        
        // Get all standards with descendants for this group
        const hierarchicalStandards = getStandardsWithDescendants(
            allGroupStandards,
            0, null
        );
        
        console.log(`Hierarchical standards for group ${group.name}:`, hierarchicalStandards);
        
        // Create table for standards in this group
        const table = document.createElement('table');
        table.className = 'table standards-table';
        table.innerHTML = createTableHeader() + '<tbody></tbody>';
        
        const tbody = table.querySelector('tbody');
        
        // Add data attributes to help with vertical connecting lines
        let lastLevelPositions = {};
        
        hierarchicalStandards.forEach((standard, index) => {
            const row = document.createElement('tr');
            row.dataset.code = standard.code;
            row.dataset.level = standard.level;
            
            // Store position information for connecting lines
            lastLevelPositions[standard.level] = index;
            row.dataset.position = index;
            
            if (index > 0) {
                // Find parent row position
                if (standard.parent_code) {
                    const parentStandard = hierarchicalStandards.find(s => s.code === standard.parent_code);
                    if (parentStandard) {
                        row.dataset.parentPosition = hierarchicalStandards.indexOf(parentStandard);
                    }
                }
            }
            
            // Add has-children attribute for styling
            if (Models.Standard.hasChildren(standard)) {
                row.dataset.hasChildren = "true";
                console.log(`Standard ${standard.code} has children:`, standard.children);
            }
            
            if (standard.level > 0) {
                row.classList.add(standard.indentClass);
            }
            
            // Check if parent standards need to be expanded
            if (highlightCode && standard.code === highlightCode) {
                // Ensure all ancestor rows are expanded
                ensureAncestorsExpanded(standard, hierarchicalStandards);
            }
            
            // Check if this standard should be hidden due to collapsed parent
            let isParentCollapsed = false;
            if (standard.level > 0 && standard.parent_code) {
                isParentCollapsed = isAnyParentCollapsed(standard.parent_code);
            }
            
            // Set initial visibility
            row.style.display = isParentCollapsed ? 'none' : '';
            
            let rowHtml = '';
            
            // Add visible columns in correct order
            standardColumns.forEach(col => {
                if (!col.visible) return;
                
                if (col.id === 'code') {
                    // Improved hierarchy display
                    let indentHtml = '';
                    
                    if (standard.level > 0) {
                        // Create indent spacing with connecting lines
                        for (let i = 0; i < standard.level; i++) {
                            const isLastLevel = i === standard.level - 1;
                            if (isLastLevel) {
                                // This is the direct connection to parent
                                indentHtml += `<span class="hierarchy-spacer">
                                    <span class="connector-vertical"></span>
                                    <span class="connector-horizontal"></span>
                                </span>`;
                            } else {
                                // This is a guide line for higher levels
                                indentHtml += `<span class="hierarchy-spacer">
                                    <span class="connector-guide"></span>
                                </span>`;
                            }
                        }
                    }
                    
                    rowHtml += `<td class="standard-cell">
                        <div class="standard-content">
                            ${indentHtml}
                            <span class="standard-code ${Models.Standard.hasChildren(standard) ? 'parent-standard' : ''}">${standard.code}</span>
                            ${Models.Standard.hasChildren(standard) ? 
                                `<span class="toggle-children" data-code="${standard.code}" title="Toggle sub-standards">
                                    <i class="expand-icon">${isStandardExpanded(standard.code, highlightCode) ? '▼' : '▶'}</i>
                                </span>` : ''}
                        </div>
                    </td>`;
                } else if (col.id === 'name') {
                    rowHtml += `<td>${standard.name}</td>`;
                } else if (col.id === 'description') {
                    rowHtml += `<td>${standard.description}</td>`;
                } else if (col.id === 'actions') {
                    rowHtml += `<td class="standard-actions">
                        <button class="button button-secondary edit-standard" data-code="${standard.code}">Edit</button>
                        <button class="button button-danger delete-standard" data-code="${standard.code}">Delete</button>
                    </td>`;
                }
            });
            
            row.innerHTML = rowHtml;
            tbody.appendChild(row);
        });
        
        standardsList.appendChild(table);
        groupSection.appendChild(standardsList);
        container.appendChild(groupSection);
        
        // Add event listeners for this group's standards
        standardsList.querySelectorAll('.edit-standard').forEach(button => {
            button.addEventListener('click', handleEditStandard);
        });
        
        standardsList.querySelectorAll('.delete-standard').forEach(button => {
            button.addEventListener('click', handleDeleteStandard);
        });
        
        standardsList.querySelectorAll('.toggle-children').forEach(toggle => {
            toggle.addEventListener('click', handleToggleChildren);
        });
        
        // Add event listeners for column settings
        standardsList.querySelectorAll('.gear-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                const columnId = e.target.dataset.column;
                const column = standardColumns.find(col => col.id === columnId);
                if (column) {
                    showColumnSettings(column);
                }
            });
        });
    });
    
    // Add event listeners for group actions
    container.querySelectorAll('.toggle-group-collapse').forEach(button => {
        button.addEventListener('click', handleToggleGroupCollapse);
    });
    
    container.querySelectorAll('.edit-group').forEach(button => {
        button.addEventListener('click', handleEditGroup);
    });
}

/**
 * Render standards that don't belong to any group
 * @param {string} [highlightCode] - Code of standard to highlight and ensure visible
 */
function renderUngroupedStandards(highlightCode = null) {
    console.log('Rendering ungrouped standards, highlight code:', highlightCode);
    
    const container = document.getElementById('ungrouped-standards-list');
    
    // Get all ungrouped standards
    const allUngroupedStandards = standardsData.filter(standard => 
        !standard.group || standard.group === ''
    );
    
    // Filter top-level ungrouped standards
    const topLevelUngrouped = allUngroupedStandards.filter(standard => 
        !standard.parent_code || standard.parent_code === ''
    );
    
    console.log(`Ungrouped standards: ${allUngroupedStandards.length} total, ${topLevelUngrouped.length} top-level`);
    
    if (topLevelUngrouped.length === 0) {
        container.innerHTML = '<p>No ungrouped standards.</p>';
        return;
    }
    
    // Create a section for ungrouped standards with consistent styling
    const ungroupedSection = document.createElement('div');
    ungroupedSection.className = 'standards-group';
    
    // Create header for ungrouped standards
    const ungroupedHeader = document.createElement('div');
    ungroupedHeader.className = 'standard-group-header';
    ungroupedHeader.innerHTML = `
        <div class="group-header-content">
            <h3 class="group-title">Ungrouped Standards</h3>
            <div class="group-header-description">Standards that don't belong to any group</div>
            <div class="group-header-count">${allUngroupedStandards.length} standards</div>
        </div>
    `;
    
    ungroupedSection.appendChild(ungroupedHeader);
    
    // Check if an ungrouped standard is being highlighted
    let hasHighlightedStandard = false;
    if (highlightCode) {
        const highlightedStandard = standardsData.find(s => s.code === highlightCode);
        if (highlightedStandard && !highlightedStandard.group) {
            hasHighlightedStandard = true;
        }
    }
    
    // Get all standards with descendants for ungrouped standards
    const hierarchicalStandards = getStandardsWithDescendants(
        allUngroupedStandards,
        0, null
    );
    
    console.log('Hierarchical ungrouped standards:', hierarchicalStandards);
    
    // Create standards list container
    const standardsList = document.createElement('div');
    standardsList.className = 'standards-list';
    
    // Create table for ungrouped standards
    const table = document.createElement('table');
    table.className = 'table standards-table';
    table.innerHTML = createTableHeader() + '<tbody></tbody>';
    
    const tbody = table.querySelector('tbody');
    
    hierarchicalStandards.forEach(standard => {
        const row = document.createElement('tr');
        row.dataset.code = standard.code;
        row.dataset.level = standard.level;
        
        // Add has-children attribute for styling
        if (Models.Standard.hasChildren(standard)) {
            row.dataset.hasChildren = "true";
        }
        
        if (standard.level > 0) {
            row.classList.add(standard.indentClass);
        }
        
        // Check if parent standards need to be expanded
        if (highlightCode && standard.code === highlightCode) {
            // Ensure all ancestor rows are expanded
            ensureAncestorsExpanded(standard, hierarchicalStandards);
        }
        
        // Check if this standard should be hidden due to collapsed parent
        let isParentCollapsed = false;
        if (standard.level > 0 && standard.parent_code) {
            isParentCollapsed = isAnyParentCollapsed(standard.parent_code);
        }
        
        // Set initial visibility
        row.style.display = isParentCollapsed ? 'none' : '';
        
        let rowHtml = '';
        
        // Add visible columns in correct order
        standardColumns.forEach(col => {
            if (!col.visible) return;
            
            if (col.id === 'code') {
                // Improved hierarchy display
                let indentHtml = '';
                
                if (standard.level > 0) {
                    // Create indent spacing with connecting lines
                    for (let i = 0; i < standard.level; i++) {
                        const isLastLevel = i === standard.level - 1;
                        if (isLastLevel) {
                            // This is the direct connection to parent
                            indentHtml += `<span class="hierarchy-spacer">
                                <span class="connector-vertical"></span>
                                <span class="connector-horizontal"></span>
                            </span>`;
                        } else {
                            // This is a guide line for higher levels
                            indentHtml += `<span class="hierarchy-spacer">
                                <span class="connector-guide"></span>
                            </span>`;
                        }
                    }
                }
                
                rowHtml += `<td class="standard-cell">
                    <div class="standard-content">
                        ${indentHtml}
                        <span class="standard-code ${Models.Standard.hasChildren(standard) ? 'parent-standard' : ''}">${standard.code}</span>
                        ${Models.Standard.hasChildren(standard) ? 
                            `<span class="toggle-children" data-code="${standard.code}" title="Toggle sub-standards">
                                <i class="expand-icon">${isStandardExpanded(standard.code, highlightCode) ? '▼' : '▶'}</i>
                            </span>` : ''}
                    </div>
                </td>`;
            } else if (col.id === 'name') {
                rowHtml += `<td>${standard.name}</td>`;
            } else if (col.id === 'description') {
                rowHtml += `<td>${standard.description}</td>`;
            } else if (col.id === 'actions') {
                rowHtml += `<td class="standard-actions">
                    <button class="button button-secondary edit-standard" data-code="${standard.code}">Edit</button>
                    <button class="button button-danger delete-standard" data-code="${standard.code}">Delete</button>
                </td>`;
            }
        });
        
        row.innerHTML = rowHtml;
        tbody.appendChild(row);
    });
    
    standardsList.appendChild(table);
    ungroupedSection.appendChild(standardsList);
    container.innerHTML = '';
    container.appendChild(ungroupedSection);
    
    // Add event listeners for standards
    standardsList.querySelectorAll('.edit-standard').forEach(button => {
        button.addEventListener('click', handleEditStandard);
    });
    
    standardsList.querySelectorAll('.delete-standard').forEach(button => {
        button.addEventListener('click', handleDeleteStandard);
    });
    
    standardsList.querySelectorAll('.toggle-children').forEach(toggle => {
        toggle.addEventListener('click', handleToggleChildren);
    });
    
    // Add event listeners for column settings
    container.querySelectorAll('.gear-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const columnId = e.target.dataset.column;
            const column = standardColumns.find(col => col.id === columnId);
            if (column) {
                showColumnSettings(column);
            }
        });
    });
}

/**
 * Show standard form for adding or editing
 * @param {Object} standard - Standard to edit (null for new)
 */
function showStandardForm(standard = null) {
    const isEdit = standard !== null;
    const title = isEdit ? 'Edit Standard' : 'Add Standard';
    
    // Filter out any standards that would create circular dependencies
    const potentialParents = standardsData.filter(s => {
        // Can't be parent to itself
        if (isEdit && s.code === standard.code) return false;
        
        // Can't add a parent that is already a descendant (would create circular reference)
        if (isEdit && isDescendantOf(s.code, standard.code)) return false;
        
        return true;
    });
    
    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'page-modal standard-form-modal';
    modal.innerHTML = `
        <div class="modal-header">
            <h2>${title}</h2>
            <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
            <form id="standard-form">
                <div class="form-group">
                    <label for="standard-group">Group:</label>
                    <select id="standard-group" ${isEdit && standard.parent_code ? 'disabled' : ''}>
                        <option value="">None</option>
                        ${groupsData.map(group => 
                            `<option value="${group.name}" data-code="${group.code}" ${isEdit && standard.group === group.name ? 'selected' : ''}>
                                ${group.code}: ${group.name}
                            </option>`
                        ).join('')}
                    </select>
                    ${isEdit && standard.parent_code ? '<small>Group is inherited from parent</small>' : ''}
                </div>
                <div class="form-group">
                    <label for="standard-parent">Parent Standard:</label>
                    <select id="standard-parent">
                        <option value="">None (Top-level)</option>
                        ${potentialParents.map(parent => 
                            `<option value="${parent.code}" ${isEdit && standard.parent_code === parent.code ? 'selected' : ''}>
                                ${parent.code} - ${parent.name}
                            </option>`
                        ).join('')}
                    </select>
                    <small>Selecting a parent will auto-generate code based on hierarchy</small>
                </div>
                <div class="form-group">
                    <label for="standard-code">Code:</label>
                    <div class="code-input-container">
                        <input type="text" id="standard-code" value="${isEdit ? standard.code : ''}" readonly>
                        <small>Code will be generated automatically based on group and parent</small>
                    </div>
                </div>
                <div class="form-group">
                    <label for="standard-level">Level in Hierarchy:</label>
                    <div class="level-indicator">
                        <span id="standard-level-display">${isEdit ? (Models.Standard.getLevel(standard.code) || 0) : 0}</span>
                        <small>Level is determined by code structure (A.1 = level 1, A.1.1 = level 2)</small>
                    </div>
                </div>
                <div class="form-group">
                    <label for="standard-name">Name:</label>
                    <input type="text" id="standard-name" value="${isEdit ? standard.name : ''}">
                </div>
                <div class="form-group">
                    <label for="standard-description">Description:</label>
                    <textarea id="standard-description">${isEdit ? standard.description : ''}</textarea>
                </div>
                ${isEdit && Models.Standard.hasChildren(standard) ? `
                <div class="form-group">
                    <label>Sub-Standards:</label>
                    <div class="sub-standards-container">
                        <div class="sub-standards-list">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                ${standard.children.map(childCode => {
                                    const child = standardsData.find(s => s.code === childCode);
                                    return child ? `
                                            <tr data-code="${child.code}">
                                                <td>${child.code}</td>
                                                <td>${child.name}</td>
                                                <td>
                                                    <button type="button" class="button button-small edit-child-standard" data-code="${child.code}">Edit</button>
                                                    <button type="button" class="button button-small move-up-standard" data-code="${child.code}" title="Move Up">↑</button>
                                                    <button type="button" class="button button-small move-down-standard" data-code="${child.code}" title="Move Down">↓</button>
                                                </td>
                                            </tr>
                                    ` : '';
                                }).join('')}
                                </tbody>
                            </table>
                        </div>
                        <div class="sub-standard-actions">
                            <button type="button" id="add-child-standard" class="button">Add Sub-Standard</button>
                        </div>
                    </div>
                </div>
                ` : ''}
                <div class="form-actions">
                    <button type="button" id="cancel-standard" class="button button-secondary">Cancel</button>
                    <button type="button" id="save-standard" class="button">Save</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners for form actions
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('#cancel-standard').addEventListener('click', closeModal);
    
    // Function to close the modal
    function closeModal() {
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
    }
    
    // Add listeners for form fields
        const groupSelect = modal.querySelector('#standard-group');
        const parentSelect = modal.querySelector('#standard-parent');
        const codeInput = modal.querySelector('#standard-code');
    const levelDisplay = modal.querySelector('#standard-level-display');
    
    // Handle group selection changes
        groupSelect.addEventListener('change', () => {
        // Only update if we're not inheriting group from parent
        if (!parentSelect.value) {
            updateCodePreview();
        }
    });
    
    // Handle parent selection changes
        parentSelect.addEventListener('change', () => {
        // If parent is selected, we inherit its group
            if (parentSelect.value) {
                const parentStandard = standardsData.find(s => s.code === parentSelect.value);
                if (parentStandard && parentStandard.group) {
                    groupSelect.value = parentStandard.group;
                groupSelect.disabled = true;
            }
        } else {
            // No parent, enable group selection
            groupSelect.disabled = false;
        }
        
        updateCodePreview();
    });
    
    // Function to update code preview based on selections
    function updateCodePreview() {
        const parentCode = parentSelect.value;
        let groupLetter = '';
        
        if (parentCode) {
            // If parent is selected, code is based on parent
            const parentStandard = standardsData.find(s => s.code === parentCode);
            if (parentStandard) {
                const newCode = Models.Standard.generateNewCode(standardsData, parentCode, null);
                codeInput.value = newCode;
                
                // Update level display
                const level = newCode ? Models.Standard.getLevel(newCode) : 0;
                levelDisplay.textContent = level;
            }
        } else {
            // Otherwise, code is based on selected group
            const selectedOption = groupSelect.options[groupSelect.selectedIndex];
            groupLetter = selectedOption ? selectedOption.dataset.code : '';
            
            if (groupLetter) {
                const newCode = Models.Standard.generateNewCode(standardsData, null, groupLetter);
                codeInput.value = newCode;
                
                // Update level display
                const level = newCode ? Models.Standard.getLevel(newCode) : 0;
                levelDisplay.textContent = level;
            } else {
                codeInput.value = '';
                levelDisplay.textContent = '0';
            }
        }
    }
    
    // Add event listeners for child standard actions
    if (isEdit && Models.Standard.hasChildren(standard)) {
        // Edit child standard
        modal.querySelectorAll('.edit-child-standard').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const childCode = e.target.dataset.code;
                const childStandard = standardsData.find(s => s.code === childCode);
                
                if (childStandard) {
                    // Close current modal
                    closeModal();
                    
                    // Open modal for child standard
                    showStandardForm(childStandard);
                }
            });
        });
        
        // Add new child standard
        const addChildButton = modal.querySelector('#add-child-standard');
        if (addChildButton) {
            addChildButton.addEventListener('click', () => {
                console.log('Add child standard button clicked for parent:', standard);
                console.log('Current standards data:', standardsData);
                
                // Create a new standard with this as parent
                const childStandard = Models.Standard.createDefault();
                childStandard.parent_code = standard.code;
                childStandard.group = standard.group; // Inherit group
                childStandard.name = "New Standard"; // Default name
                childStandard.description = ""; // Empty description
                
                // Generate code
                const newCode = Models.Standard.generateNewCode(standardsData, standard.code, null);
                childStandard.code = newCode;
                console.log(`Generated code for new child of ${standard.code}: ${newCode}`);
                
                // Set level based on code
                childStandard.level = Models.Standard.getLevel(childStandard.code);
                
                // Ensure it has an empty children array
                childStandard.children = [];
                
                // Add the standard directly to the standardsData array
                standardsData.push(childStandard);
                
                // Add to parent's children array
                if (!standard.children) {
                    standard.children = [];
                }
                standard.children.push(childStandard.code);
                
                // Update parent in standardsData
                const parentIndex = standardsData.findIndex(s => s.code === standard.code);
                if (parentIndex !== -1) {
                    standardsData[parentIndex].children = standard.children;
                }
                
                // Save to storage
                Storage.save('standards', standardsData);
                
                // Close modal
                closeModal();
                
                // Refresh view
                renderStandards(childStandard.code);
                
                Logger.log(`Added new child standard ${childStandard.code} to parent ${standard.code}`);
            });
        }
    }
    
    // Initial code update
    if (!isEdit) {
        updateCodePreview();
    }
    
    // Save standard
    modal.querySelector('#save-standard').addEventListener('click', () => {
        // Get form values
        const code = document.getElementById('standard-code').value.trim();
        const name = document.getElementById('standard-name').value.trim();
        const description = document.getElementById('standard-description').value.trim();
        const group = document.getElementById('standard-group').value;
        const parentCode = document.getElementById('standard-parent').value;
        
        console.log('Saving standard:', { code, name, description, group, parentCode, isEdit });
        
        // Validate
        if (!code) {
            alert('Standard code is required. Please select a group or parent standard.');
            return;
        }
        
        if (!name) {
            alert('Standard name is required');
            return;
        }
        
        // Ensure code follows hierarchy rules
        if (parentCode) {
            // For child standards, ensure code starts with parent code
            if (!code.startsWith(parentCode + '.')) {
                alert(`Child standard code must start with parent code (${parentCode})`);
                return;
            }
        } else if (group) {
            // For top-level standards, ensure code starts with group letter
            const groupObj = groupsData.find(g => g.name === group);
            if (groupObj && !code.startsWith(groupObj.code + '.')) {
                alert(`Standard code must start with group code (${groupObj.code})`);
                return;
            }
        }
        
        // Check for duplicate code if adding new standard
        if (!isEdit) {
            const isDuplicate = standardsData.some(s => s.code === code);
            if (isDuplicate) {
                alert(`Standard with code ${code} already exists`);
                return;
            }
        }
        
        // Calculate level based on code structure
        const level = Models.Standard.getLevel(code);
        console.log('Calculated level:', level);
        
        // Handle case where standard is moved to a new parent
        let parentReference = null;
        
        if (isEdit) {
            // Get original parent
            const originalParentCode = standard.parent_code;
            
            // If parent changed, remove from old parent's children
            if (originalParentCode !== parentCode && originalParentCode) {
                const oldParentIndex = standardsData.findIndex(s => s.code === originalParentCode);
                if (oldParentIndex !== -1 && standardsData[oldParentIndex].children) {
                    standardsData[oldParentIndex].children = standardsData[oldParentIndex].children.filter(
                        childCode => childCode !== standard.code
                    );
                    console.log(`Removed ${standard.code} from old parent ${originalParentCode}`);
                }
            }
        }
        
        // Find parent standard if exists
        if (parentCode) {
            parentReference = standardsData.find(s => s.code === parentCode);
            console.log('Parent reference:', parentReference);
        }
        
        // Save standard
        if (isEdit) {
            // Update existing standard
            const index = standardsData.findIndex(s => s.code === standard.code);
            if (index !== -1) {
                // Check if code is changing
                const codeChanged = standard.code !== code;
                const oldCode = standard.code;
                
                // Update standard properties
                standardsData[index].name = name;
                standardsData[index].description = description;
                standardsData[index].group = group;
                standardsData[index].parent_code = parentCode;
                standardsData[index].level = level;
                
                // Only change code if it's actually different
                if (codeChanged) {
                    standardsData[index].code = code;
                    
                    // Update all child standards' codes
                    updateChildrenCodes(oldCode, code);
                    
                    // Update any parent references
                    if (standard.parent_code) {
                        const parentIndex = standardsData.findIndex(s => s.code === standard.parent_code);
                        if (parentIndex !== -1) {
                            // Update the child reference in the parent
                            const childIndex = standardsData[parentIndex].children.indexOf(oldCode);
                            if (childIndex !== -1) {
                                standardsData[parentIndex].children[childIndex] = code;
                            }
                        }
                    }
                }
                
                // Add to parent's children if not already there
                if (parentReference) {
                    if (!parentReference.children) {
                        parentReference.children = [];
                    }
                    
                    // Remove old code reference if code changed
                    if (codeChanged) {
                        parentReference.children = parentReference.children.filter(c => c !== oldCode);
                    }
                    
                    // Add new code if not already present
                    if (!parentReference.children.includes(code)) {
                        parentReference.children.push(code);
                        console.log(`Added ${code} to parent's children:`, parentReference.children);
                        
                        // Update the parent reference in the standardsData array
                        const parentIndex = standardsData.findIndex(s => s.code === parentCode);
                        if (parentIndex !== -1) {
                            standardsData[parentIndex].children = parentReference.children;
                        }
                    }
                }
                
                Logger.log(`Updated standard ${code}`);
            }
        } else {
            // Create new standard
            const newStandard = {
                code,
                name,
                description,
                group,
                parent_code: parentCode,
                children: [],
                level
            };
            
            console.log('Adding new standard:', newStandard);
            standardsData.push(newStandard);
            
            // Add to parent's children array if applicable
            if (parentReference) {
                // Ensure the children array exists
                if (!parentReference.children) {
                    parentReference.children = [];
                }
                
                // Add the new code to parent's children if not already there
                if (!parentReference.children.includes(code)) {
                    parentReference.children.push(code);
                    
                    // Update the parent reference in the standardsData array
                    const parentIndex = standardsData.findIndex(s => s.code === parentCode);
                    if (parentIndex !== -1) {
                        standardsData[parentIndex].children = parentReference.children;
                    }
                    
                    console.log(`Parent ${parentCode} children after adding:`, parentReference.children);
                }
            }
            
            Logger.log(`Added new standard ${code}`);
        }
        
        // Save to storage
        Storage.save('standards', standardsData);
        console.log('Saved standardsData:', standardsData);
        
        // Close modal and refresh the view
        closeModal();
        console.log('Refreshing view with code:', code);
        renderStandards(code); // Highlight the newly created/edited standard
    });
}

/**
 * Validate a standard code format
 * @param {string} code - Code to validate
 * @param {string} parentCode - Parent code (if any)
 * @param {string} groupName - Group name (if any)
 * @returns {boolean} - True if valid
 */
function validateStandardCode(code, parentCode, groupName) {
    // Basic pattern check - allow any format with letters, numbers and dots
    // But require at least one letter followed by numbers separated by dots
    if (!/^[A-Z](\.[0-9]+)+$/.test(code)) {
        alert('Standard code must follow the pattern: Letter.Number or Parent.Number (example: A.1 or A.1.2)');
        return false;
    }
    
    // If has parent, check that code starts with parent code
    if (parentCode && !code.startsWith(parentCode + '.')) {
        alert(`Child standard code must start with parent code (${parentCode}.)`);
        return false;
    }
    
    // If in a group, check that code starts with group code (only for top-level standards)
    if (groupName && !parentCode) {
        const group = groupsData.find(g => g.name === groupName);
        if (group && group.code && !code.startsWith(group.code)) {
            alert(`Top-level standard code must start with group code (${group.code})`);
            return false;
        }
    }
    
    return true;
}

/**
 * Suggest a standard code for a group
 * @param {string} groupCode - Group code
 * @returns {string} - Suggested standard code
 */
function suggestGroupStandardCode(groupCode) {
    // Find all standards in this group
    const groupStandards = standardsData.filter(s => {
        const parts = s.code.split('.');
        return parts[0] === groupCode && parts.length === 2;
    });
    
    // Find highest number
    const maxNumber = Math.max(0, ...groupStandards.map(s => {
        const parts = s.code.split('.');
        return parseInt(parts[1], 10);
    }));
    
    // Next number
    return `${groupCode}.${maxNumber + 1}`;
}

/**
 * Update children's codes when parent code changes
 * @param {string} oldParentCode - Old parent code
 * @param {string} newParentCode - New parent code
 */
function updateChildrenCodes(oldParentCode, newParentCode) {
    Logger.log(`Updating child codes: ${oldParentCode} -> ${newParentCode}`);
    
    // Find all standards with the old parent as a prefix in their code
    standardsData.forEach(standard => {
        if (standard.code.startsWith(oldParentCode + '.')) {
            // Replace the prefix with the new parent code
            const newCode = standard.code.replace(oldParentCode, newParentCode);
            
            Logger.log(`Updating child code: ${standard.code} -> ${newCode}`);
            
            // Update references in any parents
            if (standard.parent_code === oldParentCode) {
                standard.parent_code = newParentCode;
            }
            
            // Update code
            const oldCode = standard.code;
            standard.code = newCode;
            
            // Update level based on new code structure
            standard.level = Models.Standard.getLevel(newCode);
            
            // If this is a parent itself, recursively update its children
            if (standard.children && standard.children.length > 0) {
                updateChildrenCodes(oldCode, newCode);
            }
        }
    });
}

/**
 * Show a form to add or edit a group
 * @param {Object} group - Group to edit (null for new)
 */
function showGroupForm(group = null) {
    const isEdit = group !== null;
    const title = isEdit ? 'Edit Group' : 'Add Group';
    
    console.log('showGroupForm with group:', group);
    
    // Create a default group if adding new
    if (!group) {
        group = Models.Group.createDefault();
        // Generate next available group code (A, B, C, etc.)
        group.code = Models.Group.generateNextCode(groupsData);
    }
    
    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'page-modal group-form-modal';
    modal.innerHTML = `
        <div class="modal-header">
            <h2>${title}</h2>
            <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
            <form id="group-form">
                <div class="form-group">
                    <label for="group-name">Group Name:</label>
                    <input type="text" id="group-name" value="${group.name || ''}" required>
                </div>
                <div class="form-group">
                    <label for="group-code">Group Code (A-Z):</label>
                    <input type="text" id="group-code" value="${group.code || ''}" pattern="^[A-Z]$" required>
                    <small>Single uppercase letter (A-Z)</small>
                </div>
                <div class="form-group">
                    <label for="group-description">Description:</label>
                    <textarea id="group-description">${group.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="group-color">Color:</label>
                    <input type="color" id="group-color" value="${group.color || '#ffffff'}">
                    <div class="color-options">
                        <div class="color-option" style="background-color: #f44336" data-color="#f44336"></div>
                        <div class="color-option" style="background-color: #e91e63" data-color="#e91e63"></div>
                        <div class="color-option" style="background-color: #9c27b0" data-color="#9c27b0"></div>
                        <div class="color-option" style="background-color: #673ab7" data-color="#673ab7"></div>
                        <div class="color-option" style="background-color: #3f51b5" data-color="#3f51b5"></div>
                        <div class="color-option" style="background-color: #2196f3" data-color="#2196f3"></div>
                        <div class="color-option" style="background-color: #03a9f4" data-color="#03a9f4"></div>
                        <div class="color-option" style="background-color: #00bcd4" data-color="#00bcd4"></div>
                        <div class="color-option" style="background-color: #009688" data-color="#009688"></div>
                        <div class="color-option" style="background-color: #4caf50" data-color="#4caf50"></div>
                        <div class="color-option" style="background-color: #8bc34a" data-color="#8bc34a"></div>
                        <div class="color-option" style="background-color: #cddc39" data-color="#cddc39"></div>
                        <div class="color-option" style="background-color: #ffeb3b" data-color="#ffeb3b"></div>
                        <div class="color-option" style="background-color: #ffc107" data-color="#ffc107"></div>
                        <div class="color-option" style="background-color: #ff9800" data-color="#ff9800"></div>
                        <div class="color-option" style="background-color: #ff5722" data-color="#ff5722"></div>
                        <div class="color-option" style="background-color: #795548" data-color="#795548"></div>
                        <div class="color-option" style="background-color: #607d8b" data-color="#607d8b"></div>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="button button-secondary" id="cancel-group">Cancel</button>
                    <button type="submit" class="button">${isEdit ? 'Update' : 'Add'} Group</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    document.getElementById('cancel-group').addEventListener('click', closeModal);
    modal.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', () => {
            const color = option.dataset.color;
            document.getElementById('group-color').value = color;
        });
    });
    
    // Handle form submission
    document.getElementById('group-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Get form values
        const name = document.getElementById('group-name').value.trim();
        const code = document.getElementById('group-code').value.trim().toUpperCase();
        const description = document.getElementById('group-description').value.trim();
        const color = document.getElementById('group-color').value;
        
        // Validate code format
        if (!/^[A-Z]$/.test(code)) {
            alert('Group code must be a single uppercase letter (A-Z)');
            return;
        }
        
        // Check if code is already in use (unless it's the same group being edited)
        if (!isEdit || code !== group.code) {
            const existingGroup = groupsData.find(g => g.code === code);
            if (existingGroup) {
                alert(`Group code '${code}' is already in use. Please choose another.`);
                return;
            }
        }
        
        // Create or update group
        const updatedGroup = {
            name: name,
            code: code,
            description: description,
            color: color,
            collapsed: isEdit ? group.collapsed : false
        };
        
        if (isEdit) {
            // When editing a group, also update all standards in that group
            // if the group code has changed
            if (code !== group.code) {
                // Update standard codes
                updateStandardCodesForGroup(group.name, group.code, code);
            }
            
            // Update the group in groupsData
            const groupIndex = groupsData.findIndex(g => g.name === group.name);
            if (groupIndex !== -1) {
                groupsData[groupIndex] = updatedGroup;
            }
        } else {
            // Add new group
            groupsData.push(updatedGroup);
        }
        
        // Save groups
        Storage.save('groups', groupsData);
        Logger.log(`${isEdit ? 'Updated' : 'Added'} group: ${name} (${code})`);
        
        // Close modal and refresh view
        closeModal();
        renderStandards();
    });
    
    function closeModal() {
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
    }
}

/**
 * Handle adding a new standard
 */
function handleAddStandard() {
    showStandardForm(null);
}

/**
 * Handle adding a sub-standard to a parent
 * @param {Event} event - Click event
 */
function handleAddSubStandard(event) {
    const parentCode = event.target.dataset.parentCode;
    
    if (!parentCode) {
        console.error('No parent code provided for sub-standard');
        return;
    }
    
    const parentStandard = standardsData.find(s => s.code === parentCode);
    if (parentStandard) {
        // Create a new standard with parent details filled in
        const newSubStandard = Models.Standard.createDefault();
        newSubStandard.parent_code = parentStandard.code;
        newSubStandard.group = parentStandard.group;
        
        showStandardForm(newSubStandard);
    }
}

/**
 * Handle editing a standard
 * @param {Event} event - Click event
 */
function handleEditStandard(event) {
    const code = event.target.dataset.code;
    const standard = standardsData.find(s => s.code === code);
    
    if (standard) {
        showStandardForm(standard);
    }
}

/**
 * Delete a standard
 * @param {Event} event - Click event
 */
function handleDeleteStandard(event) {
    const code = event.currentTarget.dataset.code;
    const standard = standardsData.find(s => s.code === code);
    
    if (!standard) return;
    
    // Check if standard has children
    if (standard.children && standard.children.length > 0) {
        const childrenCount = standard.children.length;
        if (!confirm(`Standard ${code} has ${childrenCount} sub-standards. Deleting it will also delete all its sub-standards. Continue?`)) {
            return;
        }
        
        // Delete recursively
        deleteStandardAndDescendants(code);
    } else {
        // Simple delete for standards without children
        if (!confirm(`Are you sure you want to delete standard ${code}?`)) {
            return;
        }
        
        deleteStandard(code);
    }
    
    // Save to storage
    Storage.save('standards', standardsData);
    Logger.log(`Deleted standard ${code}`);
    
    // Refresh view
    renderStandards();
}

/**
 * Delete a standard and update any parent-child relationships
 * @param {string} code - Code of standard to delete
 */
function deleteStandard(code) {
    const standard = standardsData.find(s => s.code === code);
    
    if (!standard) return;
    
    // If standard has a parent, remove it from parent's children array
    if (standard.parent_code) {
        const parentIndex = standardsData.findIndex(s => s.code === standard.parent_code);
        if (parentIndex !== -1) {
            standardsData[parentIndex].children = standardsData[parentIndex].children.filter(c => c !== code);
        }
    }
    
    // Remove the standard from data
    standardsData = standardsData.filter(s => s.code !== code);
}

/**
 * Delete a standard and all its descendants recursively
 * @param {string} code - Code of standard to delete
 */
function deleteStandardAndDescendants(code) {
    const standard = standardsData.find(s => s.code === code);
    
    if (!standard) return;
    
    // First delete all children recursively
    if (standard.children && standard.children.length > 0) {
        // Create a copy to avoid modification during iteration
        [...standard.children].forEach(childCode => {
            deleteStandardAndDescendants(childCode);
        });
    }
    
    // Then delete the standard itself
    deleteStandard(code);
}

/**
 * Handle creating the first group
 */
function handleCreateFirstGroup() {
    showGroupForm();
}

/**
 * Handle managing groups
 */
function handleManageGroups() {
    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'modal modal-large';
    modal.innerHTML = `
        <div class="modal-header">
            <h2>Manage Groups</h2>
            <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
            <div class="groups-controls mb-1">
                <button id="add-group" class="button">Add Group</button>
            </div>
            
            <table class="table groups-table">
                <thead>
                    <tr>
                        <th style="width: 30%">Name</th>
                        <th style="width: 40%">Description</th>
                        <th style="width: 15%">Color</th>
                        <th style="width: 15%">Actions</th>
                    </tr>
                </thead>
                <tbody id="groups-table-body"></tbody>
            </table>
            
            <div class="form-actions mt-1">
                <button type="button" id="close-groups" class="button">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Render groups table
    const tbody = modal.querySelector('#groups-table-body');
    
    if (groupsData.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="4" class="text-center">No groups defined.</td>';
        tbody.appendChild(emptyRow);
    } else {
        // Sort groups by name
        const sortedGroups = [...groupsData].sort((a, b) => a.name.localeCompare(b.name));
        
        sortedGroups.forEach(group => {
            const row = document.createElement('tr');
            row.dataset.name = group.name;
            
            row.innerHTML = `
                <td>${group.name}</td>
                <td>${group.description || ''}</td>
                <td>
                    <div class="color-preview" style="background-color: ${group.color}"></div>
                </td>
                <td>
                    <button class="button button-secondary edit-group-modal" data-name="${group.name}">Edit</button>
                    <button class="button button-danger delete-group" data-name="${group.name}">Delete</button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }
    
    // Add event listeners for modal actions
    modal.querySelector('.modal-close').addEventListener('click', () => {
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
    });
    
    modal.querySelector('#close-groups').addEventListener('click', () => {
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
    });
    
    modal.querySelector('#add-group').addEventListener('click', () => {
        // Close current modal
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
        
        // Show group form
        showGroupForm();
    });
    
    // Add event listeners for group actions
    modal.querySelectorAll('.edit-group-modal').forEach(button => {
        button.addEventListener('click', (event) => {
            const name = event.currentTarget.dataset.name;
            const group = groupsData.find(g => g.name === name);
            
            // Close current modal
            document.body.removeChild(backdrop);
            document.body.removeChild(modal);
            
            // Show group form
            if (group) {
                showGroupForm(group);
            }
        });
    });
    
    modal.querySelectorAll('.delete-group').forEach(button => {
        button.addEventListener('click', (event) => {
            const name = event.currentTarget.dataset.name;
            
            // Check if group has standards
            const groupStandards = standardsData.filter(s => s.group === name);
            
            if (groupStandards.length > 0) {
                alert(`Cannot delete group "${name}" because it contains ${groupStandards.length} standards. Please reassign or delete those standards first.`);
                return;
            }
            
            if (confirm(`Are you sure you want to delete group "${name}"?`)) {
                // Remove from data
                groupsData = groupsData.filter(g => g.name !== name);
                
                // Save to storage
                Storage.save('groups', groupsData);
                Logger.log(`Deleted group ${name}`);
                
                // Refresh groups table
                const row = tbody.querySelector(`tr[data-name="${name}"]`);
                if (row) {
                    tbody.removeChild(row);
                }
                
                // If no more groups, show empty message
                if (groupsData.length === 0) {
                    const emptyRow = document.createElement('tr');
                    emptyRow.innerHTML = '<td colspan="4" class="text-center">No groups defined.</td>';
                    tbody.appendChild(emptyRow);
                }
                
                // Refresh main view
                renderStandards();
            }
        });
    });
}

/**
 * Edit an existing group from main view
 * @param {Event} event - Click event
 */
function handleEditGroup(event) {
    const name = event.currentTarget.dataset.group;
    const group = groupsData.find(g => g.name === name);
    
    if (group) {
        showGroupForm(group);
    }
}

/**
 * Toggle collapse state for a group
 * @param {Event} event - Click event
 */
function handleToggleGroupCollapse(event) {
    const name = event.currentTarget.dataset.group;
    const group = groupsData.find(g => g.name === name);
    
    if (group) {
        // Toggle collapsed state
        group.collapsed = !group.collapsed;
        
        // Update button text
        event.currentTarget.textContent = group.collapsed ? 'Expand' : 'Collapse';
        
        // Update standards list visibility
        const groupHeader = event.currentTarget.closest('.standard-group-header');
        const standardsList = groupHeader.nextElementSibling;
        standardsList.style.display = group.collapsed ? 'none' : 'block';
        
        // Save to storage
        Storage.save('groups', groupsData);
        Logger.log(`${group.collapsed ? 'Collapsed' : 'Expanded'} group ${name}`);
    }
}

/**
 * Create table header based on column settings
 * @returns {string} HTML for table headers
 */
function createTableHeader() {
    return `
        <thead>
            <tr>
                ${standardColumns.filter(col => col.visible).map(col => 
                    `<th style="width: ${col.width}">
                        <div class="header-content">
                            <span>${col.name}</span>
                            ${col.id !== 'actions' ? `
                                <span class="column-controls">
                                    <i class="gear-icon" data-column="${col.id}">⚙</i>
                                </span>
                            ` : ''}
                        </div>
                     </th>`
                ).join('')}
            </tr>
        </thead>
    `;
}

/**
 * Show column settings for a specific column
 * @param {Object} column - Column definition
 */
function showColumnSettings(column) {
    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'page-modal column-settings-modal';
    modal.innerHTML = `
        <div class="modal-header">
            <h2>${column.name} Column Settings</h2>
            <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label for="column-width">Width:</label>
                <select id="column-width" class="form-control">
                    <option value="10%" ${column.width === '10%' ? 'selected' : ''}>10%</option>
                    <option value="15%" ${column.width === '15%' ? 'selected' : ''}>15%</option>
                    <option value="20%" ${column.width === '20%' ? 'selected' : ''}>20%</option>
                    <option value="25%" ${column.width === '25%' ? 'selected' : ''}>25%</option>
                    <option value="30%" ${column.width === '30%' ? 'selected' : ''}>30%</option>
                    <option value="40%" ${column.width === '40%' ? 'selected' : ''}>40%</option>
                    <option value="50%" ${column.width === '50%' ? 'selected' : ''}>50%</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="column-visible" ${column.visible ? 'checked' : ''}>
                    Visible
                </label>
            </div>
            
            <div class="form-actions">
                <button id="cancel-settings" class="button button-secondary">Cancel</button>
                <button id="apply-settings" class="button">Apply</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('#cancel-settings').addEventListener('click', closeModal);
    
    modal.querySelector('#apply-settings').addEventListener('click', () => {
        // Update column settings
        column.width = modal.querySelector('#column-width').value;
        column.visible = modal.querySelector('#column-visible').checked;
        
        // Save column settings
        saveColumnSettings();
        
        // Re-render components that depend on columns
        renderStandards();
        
        // Close modal
        closeModal();
    });
    
    function closeModal() {
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
    }
}

/**
 * Show column manager modal to configure all columns at once
 */
function handleManageColumns() {
    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'page-modal manage-columns-modal';
    modal.innerHTML = `
        <div class="modal-header">
            <h2>Manage Columns</h2>
            <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
            <p>Configure which columns to display and their width:</p>
            
            <table class="table">
                <thead>
                    <tr>
                        <th>Column</th>
                        <th>Visible</th>
                        <th>Width</th>
                    </tr>
                </thead>
                <tbody id="column-manager-body">
                    ${standardColumns.filter(col => col.id !== 'actions').map((col, idx) => `
                        <tr data-column-id="${col.id}">
                            <td>${col.name}</td>
                            <td>
                                <input type="checkbox" class="column-visible-checkbox" 
                                       data-column-id="${col.id}" ${col.visible ? 'checked' : ''}>
                            </td>
                            <td>
                                <select class="column-width-select" data-column-id="${col.id}">
                                    <option value="10%" ${col.width === '10%' ? 'selected' : ''}>10%</option>
                                    <option value="15%" ${col.width === '15%' ? 'selected' : ''}>15%</option>
                                    <option value="20%" ${col.width === '20%' ? 'selected' : ''}>20%</option>
                                    <option value="25%" ${col.width === '25%' ? 'selected' : ''}>25%</option>
                                    <option value="30%" ${col.width === '30%' ? 'selected' : ''}>30%</option>
                                    <option value="40%" ${col.width === '40%' ? 'selected' : ''}>40%</option>
                                    <option value="50%" ${col.width === '50%' ? 'selected' : ''}>50%</option>
                                </select>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="form-actions">
                <button id="reset-columns" class="button button-secondary">Reset to Default</button>
                <button id="save-columns" class="button">Save Changes</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    
    modal.querySelector('#reset-columns').addEventListener('click', () => {
        // Reset columns to defaults
        standardColumns[0].visible = true; // code
        standardColumns[0].width = '15%';
        
        standardColumns[1].visible = true; // name
        standardColumns[1].width = '20%';
        
        standardColumns[2].visible = true; // description
        standardColumns[2].width = '45%';
        
        standardColumns[3].visible = true; // actions
        standardColumns[3].width = '20%';
        
        // Save settings
        saveColumnSettings();
        
        // Re-render
        renderStandards();
        
        // Close modal
        closeModal();
    });
    
    modal.querySelector('#save-columns').addEventListener('click', () => {
        // Update column settings from form
        modal.querySelectorAll('.column-visible-checkbox').forEach(checkbox => {
            const columnId = checkbox.dataset.columnId;
            const column = standardColumns.find(col => col.id === columnId);
            if (column) {
                column.visible = checkbox.checked;
            }
        });
        
        modal.querySelectorAll('.column-width-select').forEach(select => {
            const columnId = select.dataset.columnId;
            const column = standardColumns.find(col => col.id === columnId);
            if (column) {
                column.width = select.value;
            }
        });
        
        // Save settings
        saveColumnSettings();
        
        // Re-render
        renderStandards();
        
        // Close modal
        closeModal();
    });
    
    function closeModal() {
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
    }
}

/**
 * Check if potential ancestor is actually an ancestor of descendant
 * @param {string} potentialAncestorCode - Code of potential ancestor
 * @param {string} descendantCode - Code of potential descendant
 * @returns {boolean} - True if ancestor is actually an ancestor
 */
function isDescendantOf(potentialAncestorCode, descendantCode) {
    // Get the standard for descendant
    const descendant = standardsData.find(s => s.code === descendantCode);
    if (!descendant || !descendant.children || descendant.children.length === 0) {
        return false;
    }
    
    // Check if potential ancestor is a direct child
    if (descendant.children.includes(potentialAncestorCode)) {
        return true;
    }
    
    // Check if potential ancestor is a descendant of any of the children
    return descendant.children.some(childCode => isDescendantOf(potentialAncestorCode, childCode));
}

/**
 * Suggest a code for a child standard based on parent code
 * @param {string} parentCode - Code of parent standard
 * @returns {string} - Suggested code for child
 */
function suggestChildCode(parentCode) {
    // Get all existing child codes for this parent
    const parent = standardsData.find(s => s.code === parentCode);
    if (!parent) return parentCode + '.1'; // Default to parent.1 if parent not found
    
    const existingChildren = parent.children || [];
    const childStandards = existingChildren.map(code => standardsData.find(s => s.code === code)).filter(Boolean);
    
    if (childStandards.length === 0) {
        // First child - use parent code plus .1
        return parentCode + '.1';
    }
    
    // Find highest number among children
    const lastSegments = childStandards.map(child => {
        const parts = child.code.split('.');
        const lastPart = parts[parts.length - 1];
        return isNaN(lastPart) ? 0 : parseInt(lastPart, 10);
    });
    
    const maxNumber = Math.max(0, ...lastSegments);
    return `${parentCode}.${maxNumber + 1}`;
}

/**
 * Get all standards with their descendants in hierarchical order
 * @param {Array} standards - Array of standards
 * @param {number} level - Current hierarchy level
 * @param {string} parentCode - Parent code to filter by
 * @returns {Array} - Ordered array of standards with level information
 */
function getStandardsWithDescendants(standards, level = 0, parentCode = null) {
    console.log(`Getting standards with descendants: level=${level}, parentCode=${parentCode}, standards.length=${standards?.length}`);
    
    const result = [];
    
    // Filter standards at current level
    const currentLevelStandards = standards.filter(s => {
        // For proper parent matching, ensure we're using consistent property names
        const standardParentCode = s.parent_code !== undefined ? s.parent_code : s.parent;
        
        if (parentCode === null) {
            return !standardParentCode || standardParentCode === '';
        } else {
            return standardParentCode === parentCode;
        }
    });
    
    console.log(`Current level standards (${level}):`, currentLevelStandards);
    
    // Sort by code
    const sortedStandards = [...currentLevelStandards].sort((a, b) => a.code.localeCompare(b.code));
    
    // Add each standard and its descendants
    sortedStandards.forEach(standard => {
        // Add current standard with level info
        const enhancedStandard = {
            ...standard,
            level,
            indentClass: `indent-level-${level}`
        };
        result.push(enhancedStandard);
        console.log(`Added standard to results: ${standard.code}, with level ${level}`);
        
        // Check for children using either children array or by finding child standards
        let hasDescendants = false;
        
        // Option 1: Standard has a children array directly
        if (standard.children && standard.children.length > 0) {
            hasDescendants = true;
            console.log(`Processing ${standard.code} children from array:`, standard.children);
        } 
        // Option 2: Find standards with this as parent
        else {
            const childStandards = standards.filter(s => {
                const childParentCode = s.parent_code !== undefined ? s.parent_code : s.parent;
                return childParentCode === standard.code;
            });
            
            if (childStandards.length > 0) {
                hasDescendants = true;
                // If standard doesn't have a children array, create one for future reference
                standard.children = childStandards.map(child => child.code);
                console.log(`Found ${childStandards.length} children for ${standard.code} by relationship:`, standard.children);
            }
        }
        
        // Add descendants if any
        if (hasDescendants) {
            const children = getStandardsWithDescendants(standards, level + 1, standard.code);
            result.push(...children);
        }
    });
    
    console.log(`Returning ${result.length} standards for level ${level}`);
    return result;
}

/**
 * Count all standards in a group including sub-standards
 * @param {string} groupName - Name of the group
 * @returns {number} - Total count of standards
 */
function countGroupStandards(groupName) {
    return standardsData.filter(s => s.group === groupName).length;
}

/**
 * Handle toggling the visibility of child standards
 * @param {Event} event - Click event
 */
function handleToggleChildren(event) {
    event.stopPropagation();
    
    const standardCode = event.currentTarget.dataset.code;
    const icon = event.currentTarget.querySelector('.expand-icon');
    const isExpanded = icon.textContent === '▼';
    
    // Toggle icon
    icon.textContent = isExpanded ? '▶' : '▼';
    
    // Find all child rows
    const table = event.currentTarget.closest('table');
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    
    // Find current row index
    const currentRowIndex = rows.findIndex(row => row.dataset.code === standardCode);
    if (currentRowIndex === -1) return;
    
    // Get collapsed standards list from storage
    let collapsedStandards = JSON.parse(localStorage.getItem('collapsed_standards') || '[]');
    
    const currentRowLevel = parseInt(rows[currentRowIndex].dataset.level || '0', 10);
    
    if (isExpanded) {
        // COLLAPSING: Hide all descendants (children, grandchildren, etc.)
        let i = currentRowIndex + 1;
        while (i < rows.length) {
            const row = rows[i];
            const rowLevel = parseInt(row.dataset.level || '0', 10);
            
            // If we hit a row with same or lower level than current, we're done with descendants
            if (rowLevel <= currentRowLevel) {
                break;
            }
            
            // Hide this descendant
            row.style.display = 'none';
            
            // When collapsing, update UI state of any visible toggles
            const childCode = row.dataset.code;
            if (childCode) {
                const childToggle = row.querySelector(`.toggle-children[data-code="${childCode}"] .expand-icon`);
                if (childToggle && childToggle.textContent === '▼') {
                    childToggle.textContent = '▶';
                    
                    // Add to collapsed list to maintain state
                    if (!collapsedStandards.includes(childCode)) {
                        collapsedStandards.push(childCode);
                    }
                }
            }
            
            i++;
        }
        
        // Add current standard to collapsed list
        if (!collapsedStandards.includes(standardCode)) {
            collapsedStandards.push(standardCode);
        }
    } else {
        // EXPANDING: Only show immediate children, not all descendants
        let i = currentRowIndex + 1;
        while (i < rows.length) {
            const row = rows[i];
            const rowLevel = parseInt(row.dataset.level || '0', 10);
            
            // If we hit a row with same or lower level than current, we're done with children
            if (rowLevel <= currentRowLevel) {
                break;
            }
            
            // Only show immediate children (level = currentLevel + 1)
            if (rowLevel === currentRowLevel + 1) {
                row.style.display = '';
            }
            
            i++;
        }
        
        // Remove current standard from collapsed list
        collapsedStandards = collapsedStandards.filter(code => code !== standardCode);
    }
    
    // Save collapsed standards state
    localStorage.setItem('collapsed_standards', JSON.stringify(collapsedStandards));
    
    Logger.log(`${isExpanded ? 'Collapsed' : 'Expanded'} standard ${standardCode} ${isExpanded ? 'and all descendants' : 'to show immediate children'}`);
}

/**
 * Check if any parent in the hierarchy is collapsed (used by general code)
 * @param {string} standardCode - Code of standard to check
 * @returns {boolean} - True if any parent is collapsed
 */
function isAnyParentCollapsed(standardCode) {
    // Get collapsed standards state from localStorage or initialize empty set
    const collapsedStandards = JSON.parse(localStorage.getItem('collapsed_standards') || '[]');
    
    // If this standard's parent is collapsed, return true
    if (collapsedStandards.includes(standardCode)) return true;
    
    // Check ancestors recursively
    const standard = standardsData.find(s => s.code === standardCode);
    if (standard && standard.parent_code) {
        return isAnyParentCollapsed(standard.parent_code);
    }
    
    return false;
}

/**
 * Check if any parent in the path is collapsed, except for the toggling parent
 * @param {string} standardCode - Code to check
 * @param {string} excludeParentCode - Parent code to exclude from check (the one being toggled)
 * @returns {boolean} - True if any parent is collapsed
 */
function isAnyParentCollapsedExcept(standardCode, excludeParentCode = null) {
    let collapsedStandards = JSON.parse(localStorage.getItem('collapsed_standards') || '[]');
    
    // Check immediate parent first
    const standard = standardsData.find(s => s.code === standardCode);
    if (!standard) return false;
    
    if (standard.parent_code) {
        // Skip the parent we're currently toggling
        if (standard.parent_code !== excludeParentCode && collapsedStandards.includes(standard.parent_code)) {
            return true;
        }
        
        // Recursively check higher parents
        return isAnyParentCollapsedExcept(standard.parent_code, excludeParentCode);
    }
    
    return false;
}

/**
 * Update standard codes for a group when its code changes
 * @param {string} groupName - Name of the group
 * @param {string} oldCode - Old code of the group
 * @param {string} newCode - New code of the group
 */
function updateStandardCodesForGroup(groupName, oldCode, newCode) {
    standardsData.forEach(standard => {
        if (standard.group === groupName) {
            if (standard.code.startsWith(oldCode)) {
                standard.code = newCode + standard.code.slice(oldCode.length);
            }
        }
    });
    
    // Save to storage
    Storage.save('standards', standardsData);
    Logger.log(`Updated standard codes for group ${groupName}`);
}

/**
 * Check if a standard should be expanded (based on highlight code)
 * @param {string} standardCode - Code of standard to check
 * @param {string} highlightCode - Code of standard being highlighted
 * @returns {boolean} - True if standard should be expanded
 */
function isStandardExpanded(standardCode, highlightCode) {
    // First check if it's in the collapsed list
    const collapsedStandards = JSON.parse(localStorage.getItem('collapsed_standards') || '[]');
    if (collapsedStandards.includes(standardCode)) {
        return false;
    }
    
    if (!highlightCode) return false;
    
    // If this is the direct parent of the highlighted standard, expand it
    const highlightedStandard = standardsData.find(s => s.code === highlightCode);
    if (highlightedStandard && highlightedStandard.parent_code === standardCode) {
        return true;
    }
    
    // Don't expand ancestors beyond the direct parent
    return false;
}

/**
 * Check if a standard is an ancestor of another
 * @param {string} ancestorCode - Potential ancestor code
 * @param {string} descendantCode - Descendant code
 * @returns {boolean} - True if ancestor
 */
function isAncestorOf(ancestorCode, descendantCode) {
    if (!ancestorCode || !descendantCode) return false;
    
    // Use iterative approach to avoid stack overflow with deep hierarchies
    let currentCode = descendantCode;
    
    while (currentCode) {
        const current = standardsData.find(s => s.code === currentCode);
        if (!current || !current.parent_code) return false;
        
        if (current.parent_code === ancestorCode) return true;
        
        // Move up the hierarchy
        currentCode = current.parent_code;
    }
    
    return false;
}

/**
 * Ensure all ancestors of a standard are expanded
 * @param {Object} standard - Standard to check
 * @param {Array} allStandards - All standards in the same group
 * @returns {boolean} - True if any ancestors were expanded
 */
function ensureAncestorsExpanded(standard, allStandards) {
    if (!standard || !standard.parent_code) return false;
    
    // Get collapsed standards state
    let collapsedStandards = JSON.parse(localStorage.getItem('collapsed_standards') || '[]');
    const originalCollapsedCount = collapsedStandards.length;
    
    try {
        // Get all ancestors
        let currentParentCode = standard.parent_code;
        const expandedAncestors = []; // Track which ancestors were expanded
        
        while (currentParentCode) {
            // Check if this parent was collapsed
            if (collapsedStandards.includes(currentParentCode)) {
                expandedAncestors.push(currentParentCode);
            }
            
            // Remove parent from collapsed list
            collapsedStandards = collapsedStandards.filter(code => code !== currentParentCode);
            
            // Get the parent standard
            const parentStandard = standardsData.find(s => s.code === currentParentCode);
            if (!parentStandard) break;
            
            // Move up the hierarchy
            currentParentCode = parentStandard.parent_code;
        }
        
        // Only save to localStorage if there were changes
        if (originalCollapsedCount !== collapsedStandards.length) {
            localStorage.setItem('collapsed_standards', JSON.stringify(collapsedStandards));
            console.log(`Expanded ancestors: ${expandedAncestors.join(', ')}`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error in ensureAncestorsExpanded:', error);
        return false;
    }
}

/**
 * Render the hierarchical standards tree in the sidebar
 * @param {string} [highlightCode] - Code of standard to highlight
 */
function renderStandardsTree(highlightCode = null) {
    const container = document.getElementById('standards-tree');
    if (!container) return;
    
    console.log('Rendering standards tree, highlight code:', highlightCode);
    console.log('Current standards data:', standardsData);
    
    // Clear previous content
    container.innerHTML = '';
    
    // Build a hierarchical tree of standards by parent-child relationship
    const standardsMap = buildStandardsTree(standardsData);
    
    // Create tree structure
    const treeRoot = document.createElement('ul');
    treeRoot.className = 'tree-root';
    
    // Sort groups by code
    const sortedGroups = [...groupsData].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    
    // Add groups first
    sortedGroups.forEach(group => {
        // Create group item
        const groupItem = document.createElement('li');
        groupItem.className = 'tree-group';
        groupItem.dataset.group = group.name || '';
        
        // Check if this group contains the highlighted standard
        let shouldExpandGroup = false;
        if (highlightCode) {
            const highlightedStandard = standardsData.find(s => s.code === highlightCode);
            if (highlightedStandard && highlightedStandard.group === group.name) {
                shouldExpandGroup = true;
                groupItem.classList.add('expanded');
            }
        }
        
        // Create group header with toggle control
        const groupHeader = document.createElement('div');
        groupHeader.className = 'tree-group-header';
        
        // Create toggle button
        const toggleSpan = document.createElement('span');
        toggleSpan.className = 'tree-toggle';
        toggleSpan.innerHTML = group.collapsed && !shouldExpandGroup ? '▶' : '▼';
        groupHeader.appendChild(toggleSpan);
        
        // Create group name span with color
        const nameSpan = document.createElement('span');
        nameSpan.className = 'tree-group-name';
        nameSpan.style.color = group.color || '#333';
        nameSpan.innerText = group.name;
        groupHeader.appendChild(nameSpan);
        
        groupItem.appendChild(groupHeader);
        
        // Create container for standards in this group
        const standardsList = document.createElement('ul');
        standardsList.className = 'tree-children';
        
        // Get top-level standards for this group
        const topLevelStandards = standardsData.filter(s => 
            s.group === group.name && 
            (!s.parent_code || s.parent_code === '')
        );
        
        // Sort standards by code
        const sortedStandards = [...topLevelStandards].sort((a, b) => 
            (a.code || '').localeCompare(b.code || '')
        );
        
        if (group.collapsed && !shouldExpandGroup) {
            standardsList.style.display = 'none';
        }
        
        // Add top-level standards recursively with their children
        sortedStandards.forEach(standard => {
            const standardItem = createStandardTreeItem(standard, highlightCode, standardsMap);
            standardsList.appendChild(standardItem);
        });
        
        groupItem.appendChild(standardsList);
        treeRoot.appendChild(groupItem);
    });
    
    // Add ungrouped standards category if any exist
    const ungroupedStandards = standardsData.filter(s => 
        !s.group && (!s.parent_code || s.parent_code === '')
    );
    
    if (ungroupedStandards.length > 0) {
        // Create ungrouped category
        const ungroupedItem = document.createElement('li');
        ungroupedItem.className = 'tree-group';
        ungroupedItem.dataset.group = 'ungrouped';
        
        // Create header
        const ungroupedHeader = document.createElement('div');
        ungroupedHeader.className = 'tree-group-header';
        
        // Create toggle button
        const toggleSpan = document.createElement('span');
        toggleSpan.className = 'tree-toggle';
        toggleSpan.innerHTML = '▼';
        ungroupedHeader.appendChild(toggleSpan);
        
        // Create name span
        const nameSpan = document.createElement('span');
        nameSpan.className = 'tree-group-name';
        nameSpan.innerText = 'Ungrouped Standards';
        ungroupedHeader.appendChild(nameSpan);
        
        ungroupedItem.appendChild(ungroupedHeader);
        
        // Create container for ungrouped standards
        const standardsList = document.createElement('ul');
        standardsList.className = 'tree-children';
        
        // Sort ungrouped standards by code
        const sortedUngrouped = [...ungroupedStandards].sort((a, b) => 
            (a.code || '').localeCompare(b.code || '')
        );
        
        // Add ungrouped standards
        sortedUngrouped.forEach(standard => {
            const standardItem = createStandardTreeItem(standard, highlightCode, standardsMap);
            standardsList.appendChild(standardItem);
        });
        
        ungroupedItem.appendChild(standardsList);
        treeRoot.appendChild(ungroupedItem);
    }
    
    container.appendChild(treeRoot);
    
    // Add event listeners for tree toggles
    container.querySelectorAll('.tree-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            // Toggle UI state
            const parentLi = e.target.closest('li');
            const childrenContainer = parentLi.querySelector(':scope > ul.tree-children, :scope > ul.tree-item-children');
            
            if (childrenContainer) {
                if (childrenContainer.style.display === 'none') {
                    childrenContainer.style.display = '';
                    e.target.innerHTML = '▼';
                    
                    // If this is a group toggle, update group state
                    const groupHeader = e.target.closest('.tree-group-header');
                    if (groupHeader) {
                        const groupName = groupHeader.parentElement.dataset.group;
                        const groupIndex = groupsData.findIndex(g => g.name === groupName);
                        if (groupIndex !== -1) {
                            groupsData[groupIndex].collapsed = false;
                            Storage.save('groups', groupsData);
                        }
                    }
                } else {
                    childrenContainer.style.display = 'none';
                    e.target.innerHTML = '▶';
                    
                    // If this is a group toggle, update group state
                    const groupHeader = e.target.closest('.tree-group-header');
                    if (groupHeader) {
                        const groupName = groupHeader.parentElement.dataset.group;
                        const groupIndex = groupsData.findIndex(g => g.name === groupName);
                        if (groupIndex !== -1) {
                            groupsData[groupIndex].collapsed = true;
                            Storage.save('groups', groupsData);
                        }
                    }
                }
            }
        });
    });
    
    // Add drag & drop support
    setupTreeDragAndDrop();
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
 * Create a tree item for a standard
 * @param {Object} standard - Standard to add
 * @param {string} [highlightCode] - Code of standard to highlight
 * @param {Object} [standardsMap] - Map of all standards by code
 * @param {number} [level=0] - Indentation level
 * @returns {HTMLElement} - Tree item element
 */
function createStandardTreeItem(standard, highlightCode = null, standardsMap = {}, level = 0) {
    const item = document.createElement('li');
    item.className = 'tree-item';
    item.dataset.code = standard.code;
    item.dataset.level = level;
    
    console.log(`Creating tree item for standard: ${standard.code}`, standard);
    
    // Make item draggable for reorganization
    item.setAttribute('draggable', 'true');
    
    // Check if this is the highlighted standard
    const isHighlighted = highlightCode && standard.code === highlightCode;
    if (isHighlighted) {
        item.classList.add('highlight-tree-item');
    }
    
    // Check if children should be expanded
    const shouldExpandChildren = isHighlighted || isStandardExpanded(standard.code, highlightCode);
    
    // Check if standard has children - either by children array or by checking for children in standardsMap
    let hasChildren = false;
    let childrenCodes = [];
    
    // Check method 1: standard has children array
    if (Array.isArray(standard.children) && standard.children.length > 0) {
        hasChildren = true;
        childrenCodes = standard.children;
    } 
    // Check method 2: find children by parent_code relationship
    else {
        const childStandards = Object.values(standardsMap).filter(s => 
            (s.parent_code === standard.code) || (s.parent === standard.code)
        );
        
        if (childStandards.length > 0) {
            hasChildren = true;
            childrenCodes = childStandards.map(s => s.code);
            
            // Store children array for future reference
            if (!standard.children) {
                standard.children = childrenCodes;
            }
        }
    }
    
    // Create item content with appropriate indentation and toggle if has children
    const itemContent = document.createElement('div');
    itemContent.className = 'tree-item-content';
    
    // Add toggle button for standards with children
    const toggleSpan = document.createElement('span');
    if (hasChildren) {
        toggleSpan.className = 'tree-toggle';
        toggleSpan.innerHTML = shouldExpandChildren ? '▼' : '▶';
    } else {
        toggleSpan.className = 'tree-toggle-placeholder';
        toggleSpan.innerHTML = '';
    }
    itemContent.appendChild(toggleSpan);
    
    // Create code display with bullet point
    const codeSpan = document.createElement('span');
    codeSpan.className = 'tree-item-code';
    codeSpan.textContent = standard.code;
    itemContent.appendChild(codeSpan);
    
    // Create name display
    const nameSpan = document.createElement('span');
    nameSpan.className = 'tree-item-name';
    nameSpan.textContent = standard.name;
    itemContent.appendChild(nameSpan);
    
    // Add action buttons
    const actionsSpan = document.createElement('span');
    actionsSpan.className = 'tree-item-actions';
    
    // Edit button
    const editButton = document.createElement('button');
    editButton.className = 'button-icon edit-standard';
    editButton.innerHTML = '<i class="fas fa-edit"></i>';
    editButton.title = 'Edit this standard';
    
    editButton.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Find the standard and show edit form
        const standardCode = standard.code;
        const standardToEdit = standardsData.find(s => s.code === standardCode);
        
        if (standardToEdit) {
            showStandardForm(standardToEdit);
        }
    });
    actionsSpan.appendChild(editButton);
    
    // Add child button
    const addChildButton = document.createElement('button');
    addChildButton.className = 'button-icon add-child-standard';
    addChildButton.innerHTML = '<i class="fas fa-plus"></i>';
    addChildButton.title = 'Add a child standard';
    
    addChildButton.addEventListener('click', (e) => {
        e.stopPropagation();
        
        const parentStandard = standard;
        
        if (parentStandard) {
            // Create a new standard with this as parent
            const childStandard = Models.Standard.createDefault();
            childStandard.parent_code = parentStandard.code;
            childStandard.group = parentStandard.group; // Inherit group
            childStandard.name = "New Standard"; // Default name
            childStandard.description = ""; // Empty description
            
            // Generate code
            childStandard.code = Models.Standard.generateNewCode(standardsData, parentStandard.code, null);
            
            // Set level based on code
            childStandard.level = Models.Standard.getLevel(childStandard.code);
            
            // Ensure it has an empty children array
            childStandard.children = [];
            
            // Add the standard directly to the standardsData array
            standardsData.push(childStandard);
            
            // Add to parent's children array
            if (!parentStandard.children) {
                parentStandard.children = [];
            }
            parentStandard.children.push(childStandard.code);
            
            // Update parent in standardsData
            const parentIndex = standardsData.findIndex(s => s.code === parentStandard.code);
            if (parentIndex !== -1) {
                standardsData[parentIndex].children = parentStandard.children;
            }
            
            // Save to storage
            Storage.save('standards', standardsData);
            
            // Refresh view
            renderStandards(childStandard.code);
            
            Logger.log(`Added new child standard ${childStandard.code} to parent ${parentStandard.code}`);
        }
    });
    actionsSpan.appendChild(addChildButton);
    
    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'button-icon delete-standard';
    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteButton.title = 'Delete this standard';
    
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (confirm(`Are you sure you want to delete the standard "${standard.code}: ${standard.name}"?`)) {
            // Check if it has children
            if (hasChildren) {
                if (confirm(`This standard has ${childrenCodes.length} child standard(s). Delete all descendants as well?`)) {
                    deleteStandardAndDescendants(standard.code);
                    renderStandards();
                }
            } else {
                // Delete the standard
                deleteStandard(standard.code);
                renderStandards();
            }
        }
    });
    actionsSpan.appendChild(deleteButton);
    
    itemContent.appendChild(actionsSpan);
    item.appendChild(itemContent);
    
    // Add click event to show this standard in the main view
    itemContent.addEventListener('click', () => {
        // Find the standard's row in the main view and scroll to it
        const standardRow = document.querySelector(`tr[data-code="${standard.code}"]`);
        if (standardRow) {
            standardRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            standardRow.classList.add('highlight-row');
            
            // Remove highlight after a short delay
            setTimeout(() => {
                standardRow.classList.remove('highlight-row');
            }, 2000);
        }
    });
    
    // Add child standards if any exist
    if (hasChildren) {
        const childrenContainer = document.createElement('ul');
        childrenContainer.className = 'tree-item-children';
        childrenContainer.style.display = shouldExpandChildren ? '' : 'none';
        
        // Sort child codes to ensure consistent order
        const sortedChildrenCodes = [...childrenCodes].sort((a, b) => a.localeCompare(b));
        
        // Add each child recursively
        sortedChildrenCodes.forEach(childCode => {
            const childStandard = standardsMap[childCode] || 
                              standardsData.find(s => s.code === childCode);
            
            if (childStandard) {
                const childItem = createStandardTreeItem(childStandard, highlightCode, standardsMap, level + 1);
                childrenContainer.appendChild(childItem);
            }
        });
        
        item.appendChild(childrenContainer);
    }
    
    return item;
}

/**
 * Adds event listeners to interactive elements
 */
function addEventListeners() {
    // Add event listeners for add standard buttons
    document.querySelectorAll('.add-standard').forEach(button => {
        button.addEventListener('click', handleAddStandard);
    });
    
    // Add event listeners for add-sub-standard buttons
    document.querySelectorAll('.add-sub-standard').forEach(button => {
        button.addEventListener('click', handleAddSubStandard);
    });
    
    // ... existing code ...
}

/**
 * Initialize drag and drop functionality for the standards tree
 */
function setupTreeDragAndDrop() {
    const treeContainer = document.getElementById('standards-tree');
    if (!treeContainer) return;
    
    // Add drag events to tree items
    treeContainer.querySelectorAll('.tree-item').forEach(item => {
        // Drag start
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item.dataset.code);
            e.dataTransfer.effectAllowed = 'move';
            item.classList.add('dragging');
        });
        
        // Drag end
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            document.querySelectorAll('.drop-target').forEach(el => {
                el.classList.remove('drop-target');
            });
        });
        
        // Define drop zones for standards and groups
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            item.classList.add('drop-target');
        });
        
        // Leave drop zone
        item.addEventListener('dragleave', () => {
            item.classList.remove('drop-target');
        });
        
        // Handle drop
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const sourceCode = e.dataTransfer.getData('text/plain');
            const targetCode = item.dataset.code;
            
            // Don't drop onto itself
            if (sourceCode === targetCode) return;
            
            const sourceStandard = standardsData.find(s => s.code === sourceCode);
            const targetStandard = standardsData.find(s => s.code === targetCode);
            
            if (sourceStandard && targetStandard) {
                // Check if this would create a circular reference
                if (isDescendantOf(sourceCode, targetCode)) {
                    alert('Cannot move a standard to one of its descendants.');
                    return;
                }
                
                // Handle the drop - make source a child of target
                moveStandardToParent(sourceStandard, targetStandard);
            }
            
            item.classList.remove('drop-target');
        });
    });
    
    // Make group headers drop targets for moving standards into groups
    treeContainer.querySelectorAll('.tree-group-header').forEach(header => {
        header.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            header.classList.add('drop-target');
        });
        
        header.addEventListener('dragleave', () => {
            header.classList.remove('drop-target');
        });
        
        header.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const sourceCode = e.dataTransfer.getData('text/plain');
            const groupName = header.closest('.tree-group').dataset.group;
            const group = groupsData.find(g => g.name === groupName);
            
            const sourceStandard = standardsData.find(s => s.code === sourceCode);
            
            if (sourceStandard && group) {
                // Move standard to this group
                moveStandardToGroup(sourceStandard, group);
            }
            
            header.classList.remove('drop-target');
        });
    });
}

/**
 * Move a standard to a new group
 * @param {Object} standard - Standard to move
 * @param {Object} group - Destination group 
 */
function moveStandardToGroup(standard, group) {
    // Don't do anything if already in this group and not a child
    if (standard.group === group.name && !standard.parent_code) return;
    
    // If this standard has a parent, remove it from parent's children
    if (standard.parent_code) {
        const parentIndex = standardsData.findIndex(s => s.code === standard.parent_code);
        if (parentIndex !== -1) {
            standardsData[parentIndex].children = standardsData[parentIndex].children.filter(
                code => code !== standard.code
            );
        }
    }
    
    const oldGroup = standard.group;
    const oldCode = standard.code;
    
    // Update group
    standard.group = group.name;
    standard.parent_code = null;
    
    // Generate new code for this standard as a top-level in the new group
    standard.code = Models.Standard.generateNewCode(standardsData, null, group.code);
    
    // Update level
    standard.level = Models.Standard.getLevel(standard.code);
    
    // Update children codes recursively
    if (standard.children && standard.children.length > 0) {
        updateChildrenCodes(oldCode, standard.code);
    }
    
    // Save to storage
    Storage.save('standards', standardsData);
    
    // Refresh the view
    renderStandards(standard.code);
    
    Logger.log(`Moved standard ${oldCode} to group ${group.name} as ${standard.code}`);
}

/**
 * Move a standard to be a child of another standard
 * @param {Object} standard - Standard to move
 * @param {Object} parent - New parent standard
 */
function moveStandardToParent(standard, parent) {
    // Don't do anything if it would create a circular reference
    if (standard.code === parent.code || isAncestorOf(standard.code, parent.code)) {
        alert('Cannot move a standard to one of its descendants');
        return;
    }
    
    // If this standard has a previous parent, remove it from that parent's children
    if (standard.parent_code) {
        const oldParentIndex = standardsData.findIndex(s => s.code === standard.parent_code);
        if (oldParentIndex !== -1) {
            standardsData[oldParentIndex].children = standardsData[oldParentIndex].children.filter(
                code => code !== standard.code
            );
        }
    }
    
    const oldCode = standard.code;
    
    // Update parent reference and group
    standard.parent_code = parent.code;
    standard.group = parent.group;
    
    // Generate new code as a child of the parent
    standard.code = Models.Standard.generateNewCode(standardsData, parent.code, null);
    
    // Update level
    standard.level = Models.Standard.getLevel(standard.code);
    
    // Add to parent's children
    const parentIndex = standardsData.findIndex(s => s.code === parent.code);
    if (parentIndex !== -1) {
        if (!standardsData[parentIndex].children) {
            standardsData[parentIndex].children = [];
        }
        standardsData[parentIndex].children.push(standard.code);
    }
    
    // Update children codes recursively
    if (standard.children && standard.children.length > 0) {
        updateChildrenCodes(oldCode, standard.code);
    }
    
    // Save to storage
    Storage.save('standards', standardsData);
    
    // Refresh the view
    renderStandards(standard.code);
    
    Logger.log(`Moved standard ${oldCode} under ${parent.code} as ${standard.code}`);
} 