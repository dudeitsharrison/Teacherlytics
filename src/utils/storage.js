/**
 * Storage module for data persistence
 * Uses a strategy pattern to handle different storage backends
 */

// Import Logger for tracking storage actions
import { Logger } from './logger.js';

/**
 * Check if localStorage is available
 * @returns {boolean} - True if localStorage is available
 */
const isLocalStorageAvailable = () => {
    try {
        if (typeof localStorage === 'undefined') {
            return false;
        }
        
        // Test localStorage
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
    } catch (e) {
        return false;
    }
};

// In-memory storage fallback for environments without localStorage
const memoryStorage = new Map();

/**
 * Storage strategies for different backends
 */
const StorageStrategies = {
    /**
     * Local storage strategy using browser's localStorage or memory fallback
     */
    local: {
        save: (key, data) => {
            if (isLocalStorageAvailable()) {
                localStorage.setItem(key, JSON.stringify(data));
            } else {
                // Use in-memory storage as fallback
                memoryStorage.set(key, JSON.stringify(data));
                Logger.warn(`Using in-memory storage fallback for key: ${key}`);
            }
            return data; // Return the original data for convenience
        },
        
        load: (key, defaultValue = null) => {
            let data;
            
            if (isLocalStorageAvailable()) {
                data = localStorage.getItem(key);
            } else {
                // Use in-memory storage as fallback
                data = memoryStorage.get(key);
                if (data) Logger.warn(`Retrieved from in-memory storage for key: ${key}`);
            }
            
            if (data === null || data === undefined) {
                return defaultValue;
            }
            
            return JSON.parse(data);
        },
        
        delete: (key) => {
            if (isLocalStorageAvailable()) {
                localStorage.removeItem(key);
            } else {
                memoryStorage.delete(key);
                Logger.warn(`Deleted from in-memory storage for key: ${key}`);
            }
            return true;
        },
        
        clear: () => {
            if (isLocalStorageAvailable()) {
                localStorage.clear();
            } else {
                memoryStorage.clear();
                Logger.warn('Cleared in-memory storage');
            }
            return true;
        }
    },
    
    /**
     * Server storage strategy (placeholder for future implementation)
     */
    server: {
        save: async (key, data) => {
            // Future: API call to server
            return false;
        },
        
        load: async (key, defaultValue = null) => {
            // Future: API call to server
            return defaultValue;
        },
        
        delete: async (key) => {
            // Future: API call to server
            return false;
        },
        
        clear: async () => {
            // Future: API call to server
            return false;
        }
    }
};

/**
 * Execute operation with standardized error handling and logging
 * @param {Function} operation - Function to execute
 * @param {string} operationName - Name of operation for logging
 * @param {Array} params - Parameters to pass to the operation
 * @returns {any} - Result of the operation
 */
const executeWithErrorHandling = (operation, operationName, ...params) => {
    try {
        const result = operation(...params);
        Logger.log(`${operationName} operation succeeded`);
        return result;
    } catch (e) {
        Logger.error(`${operationName} operation failed - ${e.message}`);
        return params[params.length - 1]; // Return default value as last parameter
    }
};

export const Storage = {
    /**
     * Save data to storage
     * @param {string} key - Storage key
     * @param {any} data - Data to store (will be JSON-stringified)
     * @param {string} strategy - Storage strategy ('local' or 'server')
     * @returns {Promise|boolean} - Success status
     */
    save: (key, data, strategy = 'local') => {
        Logger.log(`Saving data for key: ${key} using ${strategy} strategy`);
        const operation = StorageStrategies[strategy]?.save;
        if (!operation) {
            Logger.error(`Invalid storage strategy: ${strategy}`);
            return false;
        }
        return executeWithErrorHandling(operation, `${strategy} save for ${key}`, key, data);
    },
    
    /**
     * Load data from storage
     * @param {string} key - Storage key 
     * @param {any} defaultValue - Default value if key doesn't exist
     * @param {string} strategy - Storage strategy ('local' or 'server')
     * @returns {Promise|any} - Retrieved data or defaultValue
     */
    load: (key, defaultValue = null, strategy = 'local') => {
        Logger.log(`Loading data for key: ${key} using ${strategy} strategy`);
        const operation = StorageStrategies[strategy]?.load;
        if (!operation) {
            Logger.error(`Invalid storage strategy: ${strategy}`);
            return defaultValue;
        }
        return executeWithErrorHandling(operation, `${strategy} load for ${key}`, key, defaultValue);
    },
    
    /**
     * Delete data from storage
     * @param {string} key - Storage key
     * @param {string} strategy - Storage strategy ('local' or 'server')
     * @returns {Promise|boolean} - Success status
     */
    delete: (key, strategy = 'local') => {
        Logger.log(`Deleting data for key: ${key} using ${strategy} strategy`);
        const operation = StorageStrategies[strategy]?.delete;
        if (!operation) {
            Logger.error(`Invalid storage strategy: ${strategy}`);
            return false;
        }
        return executeWithErrorHandling(operation, `${strategy} delete for ${key}`, key);
    },
    
    /**
     * Clear all application data
     * @param {string} strategy - Storage strategy ('local' or 'server')
     * @returns {Promise|boolean} - Success status
     */
    clear: (strategy = 'local') => {
        Logger.log(`Clearing all data using ${strategy} strategy`);
        const operation = StorageStrategies[strategy]?.clear;
        if (!operation) {
            Logger.error(`Invalid storage strategy: ${strategy}`);
            return false;
        }
        return executeWithErrorHandling(operation, `${strategy} clear`);
    },
    
    /**
     * Save data to server (shorthand for save with server strategy)
     * @param {string} key - Storage key
     * @param {any} data - Data to store
     * @returns {Promise} - Promise that resolves with success status
     */
    saveToServer: (key, data) => Storage.save(key, data, 'server'),
    
    /**
     * Load data from server (shorthand for load with server strategy)
     * @param {string} key - Storage key
     * @param {any} defaultValue - Default value if key doesn't exist
     * @returns {Promise} - Promise that resolves with retrieved data
     */
    loadFromServer: (key, defaultValue = null) => Storage.load(key, defaultValue, 'server')
}; 