/**
 * Router module for handling navigation between pages
 */
import { Logger } from './logger.js';

// Define routes with their module paths
const routes = {
    masterlog: { module: import('../pages/masterlog.js') },
    standards: { module: import('../pages/standards.js') },
    achievements: { module: import('../pages/assignments.js') },
    analytics: { module: import('../pages/analytics.js') },
    enhanced_analytics: { module: import('../pages/enhanced-analytics.js') }
};

// Keep track of the current route
let currentRoute = null;

export const Router = {
    /**
     * Configuration for pages with their module paths
     */
    pages: {
        masterlog: 'masterlog',
        standards: 'standards',
        achievements: 'assignments',
        analytics: 'analytics',
        enhanced_analytics: 'enhanced-analytics'
    },
    
    /**
     * Currently active page
     */
    currentPage: null,
    
    /**
     * Clean up the current page before navigation
     * @returns {boolean} - True if cleanup was successful
     */
    cleanupCurrentPage: async () => {
        if (!currentRoute) return true;
        
        try {
            // Get the current page module
            const module = await routes[currentRoute]?.module;
            
            // Call cleanup function if it exists
            if (module && typeof module.cleanup === 'function') {
                Logger.log(`Running cleanup for page: ${currentRoute}`);
                await module.cleanup();
            }
            return true;
        } catch (error) {
            Logger.error(`Error during cleanup: ${error.message}`);
            return false;
        }
    },
    
    /**
     * Navigate to a specific page with cleanup
     * @param {string} pageId - Page identifier (must be in Router.pages)
     * @param {Object} params - Parameters to pass to the page (optional)
     */
    navigateTo: async (pageId, params = {}) => {
        // Clean up current page first
        await Router.cleanupCurrentPage();
        
        // Then navigate to the new page
        await Router.navigate(pageId, params);
    },
    
    /**
     * Navigate to a specific page
     * @param {string} pageId - Page identifier (must be in Router.pages)
     * @param {Object} params - Parameters to pass to the page (optional)
     */
    navigate: async (pageId, params = {}) => {
        if (!Router.pages.hasOwnProperty(pageId)) {
            Logger.error(`Invalid page requested: ${pageId}`);
            pageId = 'masterlog'; // Default to masterlog on invalid page
        }
        
        // Update URL hash
        window.location.hash = pageId;
        
        // Clear current content
        const contentContainer = document.getElementById('content');
        contentContainer.innerHTML = `<div id="${pageId}-container" class="page-container"></div>`;
        
        // Update active state in navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-page') === pageId);
        });
        
        try {
            // Dynamically import the page module
            const module = await import(`../pages/${Router.pages[pageId]}.js`);
            
            // Check if module has an init function
            if (typeof module.init === 'function') {
                module.init(document.getElementById(`${pageId}-container`), params);
                Router.currentPage = pageId;
                currentRoute = pageId; // Update current route for cleanup
                Logger.log(`Navigated to page: ${pageId}`);
            } else {
                Logger.error(`Page module ${pageId} has no init function`);
            }
        } catch (e) {
            Logger.error(`Failed to load page module ${pageId}: ${e.message}`);
            contentContainer.innerHTML = `<div class="error-message">Failed to load page. See console for details.</div>`;
        }
    }
}; 