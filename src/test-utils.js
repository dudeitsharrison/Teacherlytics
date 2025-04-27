/**
 * Test file for utilities
 */

// Import refactored utilities
import { Models, Storage, Validate, CommonUtils } from './utils/index.js';

// Test Models
console.log('Models loaded:', !!Models);
console.log('Standard model:', !!Models.Standard);

// Create a test standard
const testStandard = Models.Standard.createDefault();
testStandard.code = 'A.1';
testStandard.name = 'Test Standard';
console.log('Created standard:', testStandard);

// Test Standard utility functions
console.log('Standard level:', Models.Standard.getLevel('A.1.2'));
console.log('Group letter:', Models.Standard.getGroupLetter('A.1.2'));

// Test Storage with error handling
try {
    // Save data to local storage
    const saveResult = Storage.save('test-key', { test: 'data' });
    console.log('Save result:', saveResult);
    
    // Load data back
    const loadResult = Storage.load('test-key', null);
    console.log('Load result:', loadResult);
    
    // Test server shorthand (should use server strategy)
    const serverSaveResult = Storage.saveToServer('server-key', { server: 'data' });
    console.log('Server save result:', serverSaveResult);
} catch (e) {
    console.error('Storage test error:', e.message);
}

// Test Validation
console.log('Validation test:');
const validationResult = Validate.requiredString('Test', 'testField');
console.log('String validation result:', validationResult);

// Test CommonUtils
console.log('CommonUtils test:');
console.log('isDefined null:', CommonUtils.isDefined(null));
console.log('isDefined object:', CommonUtils.isDefined({}));
console.log('Deep clone:', CommonUtils.deepClone({ test: 'clone' }));

console.log('All tests complete.'); 