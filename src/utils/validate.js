/**
 * Validation utilities for input validation
 */
import { Logger } from './logger.js';

/**
 * Creates a validator function with common error handling
 * @param {Function} validationFn - Function containing validation logic
 * @param {string} errorMessage - Error message template 
 * @param {string} level - Log level ('error', 'warn', etc.)
 * @returns {Function} - Configured validator function
 */
const createValidator = (validationFn, errorMessage, level = 'error') => {
    return (...args) => {
        const isValid = validationFn(...args);
        if (!isValid) {
            // Replace placeholders in error message
            const formattedMessage = errorMessage.replace(/\{(\d+)\}/g, (_, index) => args[index] || '');
            Logger[level](formattedMessage);
        }
        return isValid;
    };
};

export const Validate = {
    /**
     * Validate staff ID
     * @param {string} id - Staff ID to validate
     * @param {Array<string>} existingIds - Array of existing IDs to check against
     * @returns {boolean} - True if valid and unique, false otherwise
     */
    staffId: createValidator(
        (id, existingIds = []) => {
            if (!id || typeof id !== 'string' || id.trim() === '') {
                return false;
            }
            
            if (existingIds.includes(id)) {
                return false;
            }
            
            return true;
        },
        'Invalid ID: {0} - empty, not a string, or already exists'
    ),
    
    /**
     * Validate dropdown option against allowed options
     * @param {string} value - Value to validate
     * @param {Array<string>} options - Array of allowed options
     * @returns {boolean} - True if valid, false otherwise
     */
    dropdownOption: createValidator(
        (value, options = []) => options.includes(value),
        'Invalid dropdown value: {0}',
        'warn'
    ),
    
    /**
     * Validate required string field
     * @param {string} value - Value to validate
     * @param {string} fieldName - Field name for logging
     * @returns {boolean} - True if valid, false otherwise
     */
    requiredString: createValidator(
        (value, fieldName = 'field') => value && typeof value === 'string' && value.trim() !== '',
        'Missing required {1}'
    ),
    
    /**
     * Validate object against required fields
     * @param {Object} obj - Object to validate
     * @param {Array<string>} requiredFields - Array of required field names
     * @returns {boolean} - True if valid, false otherwise
     */
    requiredFields: createValidator(
        (obj, requiredFields = []) => {
            if (!obj || typeof obj !== 'object') {
                return false;
            }
            
            const missingFields = requiredFields.filter(field => !obj[field]);
            return missingFields.length === 0;
        },
        'Missing required fields: {1}'
    ),
    
    /**
     * Direct access to createValidator for creating custom validators
     */
    createCustom: createValidator
}; 