// Wrapper for pdf-parse to prevent test code execution
// The pdf-parse module has code that runs when there's no parent module,
// which causes issues in production builds

let pdfParse: any;

try {
  // Set module.parent to prevent test code execution
  const originalParent = module.parent;
  if (!module.parent) {
    // Fake parent to prevent test execution
    (module as any).parent = { id: 'fake-parent' };
  }
  
  pdfParse = require('pdf-parse');
  
  // Restore original parent
  if (!originalParent) {
    (module as any).parent = originalParent;
  }
} catch (error) {
  console.error('Failed to load pdf-parse:', error);
  // Provide a fallback that throws a meaningful error
  pdfParse = () => {
    throw new Error('pdf-parse module failed to load properly');
  };
}

export default pdfParse;