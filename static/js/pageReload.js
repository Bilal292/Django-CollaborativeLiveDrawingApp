// Track if the page has already been reloaded
let pageReloaded = false;

// Function to handle page visibility change
function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && !pageReloaded) {
        // Set pageReloaded to true to avoid reloading multiple times
        pageReloaded = true;

        // Reload the page
        location.reload();
    }
}

// Function to handle window focus
function handleFocus() {
    if (!pageReloaded) {
        // Set pageReloaded to true to avoid reloading multiple times
        pageReloaded = true;

        // Reload the page
        location.reload();
    }
}

// Function to handle window blur
function handleBlur() {
    // Reset pageReloaded to allow reloading on focus
    pageReloaded = false;
}

// Add event listeners
document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('focus', handleFocus);
window.addEventListener('blur', handleBlur);