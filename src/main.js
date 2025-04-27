import { Router } from './utils/router.js';
import { Logger } from './utils/logger.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    Logger.log('Application initialized');
    
    // Set up navigation
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            Router.navigate(pageId);
        });
    });
    
    // Navigate to default page (masterlog)
    const hash = window.location.hash.substring(1) || 'masterlog';
    Router.navigate(hash);
}); 