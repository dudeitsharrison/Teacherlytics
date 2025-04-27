/**
 * Utilities index
 * Re-exports all utility modules for convenient imports
 */

import { Logger } from './logger.js';
import { Storage } from './storage.js';
import { Validate } from './validate.js';
import ModelsObject from './models.js';
import { Router } from './router.js';
import { FilterSystem } from './FilterSystem.js';
import { ChartSystem } from './ChartSystem.js';
import { DrilldownFilterSystem } from './DrilldownFilterSystem.js';

// Add a CommonUtils export for shared utility functions
export const CommonUtils = {
    /**
     * Checks if an object is defined and not null
     * @param {any} obj - Object to check
     * @returns {boolean} - True if defined and not null
     */
    isDefined: (obj) => obj !== undefined && obj !== null,
    
    /**
     * Deep clones an object
     * @param {Object} obj - Object to clone
     * @returns {Object} - Cloned object
     */
    deepClone: (obj) => {
        if (!obj) return obj;
        return JSON.parse(JSON.stringify(obj));
    }
};

// Export the Models object 
export const Models = ModelsObject;

// Re-export everything
export { Logger, Storage, Validate, Router, FilterSystem, ChartSystem, DrilldownFilterSystem }; 