/**
 * Data models for the application
 * Centralizes data structure definitions
 */

// Common utility functions
const CommonUtils = {
    /**
     * Generate next alphanumeric code 
     * @param {string} currentCode - Current code to increment
     * @param {boolean} isAlphabetic - Whether to increment alphabetically (true) or numerically (false)
     * @returns {string} - Next code in the sequence
     */
    generateNextCode: (currentCode, isAlphabetic = false) => {
        if (!currentCode) {
            return isAlphabetic ? 'A' : '1';
        }
        
        if (isAlphabetic) {
            // For alphabetic codes (A, B, C...)
            const charCode = currentCode.charCodeAt(0) + 1;
            // If we've gone past 'Z', loop back to 'A'
            return charCode > 90 ? 'A' : String.fromCharCode(charCode);
        } else {
            // For numeric codes
            const num = parseInt(currentCode, 10) || 0;
            return String(num + 1);
        }
    },
    
    /**
     * Extract segments from a dotted code (e.g., "A.1.2" -> ["A", "1", "2"])
     * @param {string} code - Code to split
     * @returns {Array} - Array of code segments
     */
    splitCode: (code) => {
        if (!code || typeof code !== 'string') return [];
        return code.split('.');
    }
};

// Create Models object
const ModelsObject = {
    /**
     * Staff profile model
     */
    Staff: {
        createDefault: () => ({
            id: '', // Unique identifier
            name: '',
            phase: 'Foundation', // Foundation, Primary, Secondary
            overseas_thai: 'All', // Overseas, Thai, All
            year_group: 'Reception', // Reception, Year1-Year13
            department: 'Outclass' // Outclass, EAL, LSA, Support Staff
        }),
        
        /**
         * Phase options
         */
        phaseOptions: ['Foundation', 'Primary', 'Secondary'],
        
        /**
         * Overseas/Thai options
         */
        overseasThaiOptions: ['Overseas', 'Thai', 'All'],
        
        /**
         * Year group options
         */
        yearGroupOptions: ['Reception', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 
                           'Year7', 'Year8', 'Year9', 'Year 10', 'Year 11', 'Year 12', 'Year 13'],
        
        /**
         * Department options
         */
        departmentOptions: ['Outclass', 'EAL', 'LSA', 'Support Staff']
    },
    
    /**
     * Standard model
     */
    Standard: {
        createDefault: () => ({
            code: '', // Unique code, e.g., A.1, A.1.1
            name: '',
            description: '',
            group: null, // Group name or null if ungrouped
            parent_code: null, // Parent standard code or null if top-level
            children: [], // Array of child standard codes
            level: 0, // Hierarchy level (0 = top level, 1 = standard, 2 = substandard, etc.)
            position: 0 // Position within its level for ordering
        }),

        /**
         * Helper to check if a standard is a child
         */
        isChild: function(standard) {
            if (!standard) return false;
            return !!standard.parent_code;
        },

        /**
         * Helper to check if a standard has children
         */
        hasChildren: function(standard) {
            if (!standard) return false;
            return Array.isArray(standard.children) && standard.children.length > 0;
        },
        
        /**
         * Get the level of a standard based on its code
         * @param {string} code - Standard code (e.g., "A.1.2")
         * @returns {number} - Level of the standard (0 = group code only, 1 = standard, 2 = substandard, etc.)
         */
        getLevel: function(code) {
            const segments = CommonUtils.splitCode(code);
            return segments.length > 1 ? segments.length - 1 : 0;
        },
        
        /**
         * Extract the group letter from a standard code
         * @param {string} code - Standard code
         * @returns {string} - Group letter or empty string if invalid
         */
        getGroupLetter: function(code) {
            if (!code || typeof code !== 'string') return '';
            const match = code.match(/^([A-Z])/);
            return match ? match[1] : '';
        },
        
        /**
         * Generate a code for a new standard at the specified level 
         * within the specified parent or group
         * @param {Array} standards - All standards
         * @param {string} parentCode - Parent code or null for top-level
         * @param {string} groupLetter - Group letter (A-Z) for top-level standards
         * @returns {string} - New code
         */
        generateNewCode: function(standards, parentCode, groupLetter) {
            console.log('Generating new code:', { standards, parentCode, groupLetter });
            
            if (!Array.isArray(standards)) {
                standards = [];
            }
            
            if (parentCode) {
                // For sub-standards, find siblings and generate next number
                const siblings = standards.filter(s => s && s.parent_code === parentCode);
                console.log('Found siblings:', siblings);
                
                if (siblings.length === 0) {
                    return `${parentCode}.1`;
                }
                
                // Extract the last segment of codes and find max
                const segments = siblings.map(s => {
                    if (!s.code) return 0;
                    const parts = CommonUtils.splitCode(s.code);
                    return parseInt(parts[parts.length - 1], 10) || 0;
                });
                
                const maxSegment = Math.max(0, ...segments);
                const newSegment = CommonUtils.generateNextCode(String(maxSegment), false);
                const newCode = `${parentCode}.${newSegment}`;
                console.log(`Generated new code for child of ${parentCode}: ${newCode}`);
                return newCode;
            } else if (groupLetter) {
                // For top-level standards, find siblings in the same group
                const siblings = standards.filter(s => 
                    s && 
                    (!s.parent_code || s.parent_code === '') &&  // Only top-level standards
                    s.code && typeof s.code === 'string' &&
                    s.code.startsWith(groupLetter + '.')  // In the specified group
                );
                
                console.log('Found top-level siblings in group:', siblings);
                
                if (siblings.length === 0) {
                    return `${groupLetter}.1`;
                }
                
                // Extract the number part and find max
                const segments = siblings.map(s => {
                    if (!s.code) return 0;
                    const parts = CommonUtils.splitCode(s.code);
                    return parseInt(parts[1], 10) || 0;
                });
                
                const maxSegment = Math.max(0, ...segments);
                const newSegment = CommonUtils.generateNextCode(String(maxSegment), false);
                const newCode = `${groupLetter}.${newSegment}`;
                console.log(`Generated new code for group ${groupLetter}: ${newCode}`);
                return newCode;
            }
            
            return '';
        }
    },
    
    /**
     * Assignment model (links staff to standards)
     */
    Assignment: {
        createDefault: (staffId = '', standardCode = '') => ({
            staff_id: staffId,
            standard_code: standardCode,
            achieved: false,
            date_achieved: null
        })
    },
    
    /**
     * Standard group model
     */
    Group: {
        createDefault: (name = '', code = '') => ({
            name: name,
            code: code, // Letter code (A, B, C, etc.)
            color: '#ffffff', // Default color (white)
            description: '',
            collapsed: false // UI state for collapsible groups
        }),
        
        /**
         * Generate the next available group code based on existing groups
         * @param {Array} existingGroups - Array of existing group objects
         * @returns {string} - Next available group code
         */
        generateNextCode: (existingGroups) => {
            if (!existingGroups || existingGroups.length === 0) {
                return 'A';
            }
            
            // Get all existing codes
            const existingCodes = existingGroups.map(group => group.code || '');
            
            // Filter out non-alphabetic single-character codes and sort them
            const validCodes = existingCodes
                .filter(code => /^[A-Z]$/.test(code))
                .sort();
            
            if (validCodes.length === 0) {
                return 'A';
            }
            
            // Get the last code and generate next one
            const lastCode = validCodes[validCodes.length - 1];
            return CommonUtils.generateNextCode(lastCode, true);
        },
        
        /**
         * Validate a group code
         * @param {string} code - Group code to validate
         * @returns {boolean} - Whether the code is valid
         */
        isValidCode: (code) => {
            return /^[A-Z]$/.test(code);
        }
    },
    
    /**
     * Default colors for standard groups
     */
    groupColors: [
        '#f44336', // Red
        '#e91e63', // Pink
        '#9c27b0', // Purple
        '#673ab7', // Deep Purple
        '#3f51b5', // Indigo
        '#2196f3', // Blue
        '#03a9f4', // Light Blue
        '#00bcd4', // Cyan
        '#009688', // Teal
        '#4caf50', // Green
        '#8bc34a', // Light Green
        '#cddc39', // Lime
        '#ffeb3b', // Yellow
        '#ffc107', // Amber
        '#ff9800', // Orange
        '#ff5722'  // Deep Orange
    ]
};

// Test that methods are correctly defined
console.log("Models.Standard.getLevel test:", typeof ModelsObject.Standard.getLevel === 'function');

// Export the ModelsObject as default export
export default ModelsObject;

// Also export as named export for backward compatibility
export const Models = ModelsObject; 