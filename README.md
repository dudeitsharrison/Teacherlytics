# Staff Management Web Application

A comprehensive web-based system for managing staff profiles, standards, achievements, and analytics.

## Features

### Masterlog
- Editable table for staff profiles
- Dynamic columns with custom settings
- Filtering and searching
- Pagination for large datasets

### Standards
- Define and manage standards
- Group standards with customizable colors
- Collapsible standard groups

### Achievements
- Assign standards to staff members
- Track achievement status
- Filter by staff attributes

### Analytics
- Visualize staff progress
- Compare different staff groups
- Dynamic charts and filters

## Technical Details

This application is built using vanilla HTML, JavaScript, and CSS with a focus on:

- **DRY principles**: Centralized utilities and reusable components
- **Modularity**: Well-defined module boundaries with clear responsibilities
- **Scalability**: Designed for future server-side integration
- **Performance**: Optimized for handling large datasets

## Getting Started

1. Clone the repository
2. Open `index.html` in your browser

No build steps or server required - the application runs entirely in the browser using localStorage for data persistence.

## Development

### Project Structure
- `/src/utils/` - Core utilities and services
- `/src/pages/` - Page-specific modules
- `/src/styles/` - CSS stylesheets
- `/docs/` - Documentation

### Design Decisions
- Data persistence through abstracted Storage module (ready for server integration)
- Centralized logging for debugging and audit trails
- Validation utilities to ensure data integrity
- Modular architecture for maintainability

## Documentation

- See `/docs/project_metadata.md` for data models and configuration
- See `/docs/future_features.md` for planned enhancements

## Browser Support

Tested and optimized for modern browsers:
- Chrome (latest)
- Firefox (latest)
- Edge (latest)
- Safari (latest) 