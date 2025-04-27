# Project Metadata

## Data Models

### Staff Profile
- `id`: String (unique, correlates all data)
- `name`: String
- `phase`: String (Foundation, Primary, Secondary)
- `overseas_thai`: String (Overseas, Thai, All)
- `year_group`: String (Reception, Year1-Year13)
- `department`: String (Outclass, EAL, LSA, Support Staff)

### Standard
- `code`: String (unique, e.g., A.1)
- `name`: String
- `description`: String
- `group`: String or null (group name if grouped)

### Assignment
- `staff_id`: String (references Staff.id)
- `standard_code`: String (references Standard.code)
- `achieved`: Boolean
- `date_achieved`: Date or null

### Group
- `name`: String (unique)
- `color`: String (hex color)
- `description`: String
- `collapsed`: Boolean (UI state)

## Utilities

### Logger (src/utils/logger.js)
- `log(message, level)`: Logs events with timestamp and level
- `error(message)`: Logs errors
- `warn(message)`: Logs warnings
- `history`: Array of log entries
- `export()`: Returns log history as JSON

### Storage (src/utils/storage.js)
- `save(key, data)`: Saves data to localStorage
- `load(key, defaultValue)`: Loads data from localStorage
- `delete(key)`: Deletes data from localStorage
- `clear()`: Clears all localStorage data
- `saveToServer(key, data)`: Placeholder for server-side save
- `loadFromServer(key, defaultValue)`: Placeholder for server-side load

### Validate (src/utils/validate.js)
- `staffId(id, existingIds)`: Validates staff ID for uniqueness
- `dropdownOption(value, options)`: Validates dropdown selection
- `requiredString(value, fieldName)`: Validates required string field
- `requiredFields(obj, requiredFields)`: Validates required object fields

### Router (src/utils/router.js)
- `navigate(pageId)`: Navigates to specified page
- `pages`: Object mapping page IDs to module paths
- `currentPage`: Currently active page

## Configurations

### Staff Profile Options
- **Phase Options**: Foundation, Primary, Secondary
- **Overseas/Thai Options**: Overseas, Thai, All
- **Year Group Options**: Reception, Year1, Year2, Year3, Year4, Year5, Year6, Year7, Year8, Year9, Year10, Year11, Year12, Year13
- **Department Options**: Outclass, EAL, LSA, Support Staff

### Masterlog Columns
- Name: Text input
- ID: Text input (unique)
- Phase: Dropdown (Foundation, Primary, Secondary)
- Overseas/Thai: Dropdown (Overseas, Thai, All)
- Year Group: Dropdown (Reception, Year1-Year13)
- Department: Dropdown (Outclass, EAL, LSA, Support Staff)

### Standard Group Colors
A palette of 16 predefined colors for standard groups:
- Red: #f44336
- Pink: #e91e63
- Purple: #9c27b0
- Deep Purple: #673ab7
- Indigo: #3f51b5
- Blue: #2196f3
- Light Blue: #03a9f4
- Cyan: #00bcd4
- Teal: #009688
- Green: #4caf50
- Light Green: #8bc34a
- Lime: #cddc39
- Yellow: #ffeb3b
- Amber: #ffc107
- Orange: #ff9800
- Deep Orange: #ff5722

## Future Features
- Server-side storage integration
- Single Sign-On (SSO) authentication
- User roles and permissions
- Data export/import
- Real-time collaboration
- Detailed analytics and reporting 