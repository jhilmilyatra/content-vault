/**
 * Security utilities to deter casual inspection
 * Note: This only deters casual users - cannot fully prevent dev tools access
 */

export const initSecurityMeasures = () => {
  if (import.meta.env.PROD) {
    // Disable right-click context menu
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    // Disable common dev tools shortcuts
    document.addEventListener('keydown', (e) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+I (Dev Tools)
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+C (Inspect Element)
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+S (Save Page)
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        return false;
      }
    });

    // Disable text selection on sensitive areas
    document.body.style.userSelect = 'none';
    
    // Allow text selection in inputs and textareas
    const style = document.createElement('style');
    style.textContent = `
      input, textarea, [contenteditable="true"] {
        user-select: text !important;
        -webkit-user-select: text !important;
      }
    `;
    document.head.appendChild(style);

    // Clear console periodically
    const clearConsole = () => {
      console.clear();
      console.log('%c⚠️ Stop!', 'color: red; font-size: 50px; font-weight: bold;');
      console.log('%cThis is a browser feature for developers.', 'font-size: 16px;');
      console.log('%cIf someone told you to paste something here, it\'s likely a scam.', 'font-size: 14px; color: gray;');
    };
    
    clearConsole();
    setInterval(clearConsole, 5000);

    // Detect dev tools open (basic detection)
    let devToolsOpen = false;
    const threshold = 160;
    
    const checkDevTools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        if (!devToolsOpen) {
          devToolsOpen = true;
          // Optional: redirect or show warning
          console.clear();
        }
      } else {
        devToolsOpen = false;
      }
    };
    
    setInterval(checkDevTools, 1000);
  }
};

export default initSecurityMeasures;
