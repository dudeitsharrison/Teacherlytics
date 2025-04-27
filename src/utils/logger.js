/**
 * Centralized logging module for tracking user actions, errors, and system events
 */
export const Logger = {
    /**
     * Log a message with specified level
     * @param {string} message - The message to log
     * @param {string} level - Log level (INFO, WARN, ERROR)
     */
    log: (message, level = 'INFO') => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${level}: ${message}`);
        
        // Store log in memory for potential export
        Logger.history.push({timestamp, level, message});
        
        // Placeholder for server-side logging
    },
    
    /**
     * Log an error message
     * @param {string} message - Error message
     */
    error: (message) => Logger.log(message, 'ERROR'),
    
    /**
     * Log a warning message
     * @param {string} message - Warning message
     */
    warn: (message) => Logger.log(message, 'WARN'),
    
    /**
     * Log history for potential export
     */
    history: [],
    
    /**
     * Export log history as JSON
     * @returns {string} - JSON string of log history
     */
    export: () => JSON.stringify(Logger.history)
}; 