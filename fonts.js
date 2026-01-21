/**
 * Avatar Banner Extension - Font Management
 * EXACT copy from v3.3.3 lines 482-603
 */

/**
 * Parse font input and return { importStatement, fontFamily }
 */
function parseFontInput(input) {
    if (!input || typeof input !== 'string' || input.trim() === '') {
        return { importStatement: '', fontFamily: '' };
    }

    const trimmed = input.trim();
    let url = null;
    let fontFamily = null;

    // Check if it contains a Google Fonts URL
    const urlMatch = trimmed.match(/https:\/\/fonts\.googleapis\.com\/css2?\?[^"'\s)]+/);

    if (urlMatch) {
        url = urlMatch[0];
        const familyMatch = url.match(/family=([^&:]+)/);
        if (familyMatch) {
            fontFamily = decodeURIComponent(familyMatch[1].replace(/\+/g, ' '));
        }
        return {
            importStatement: `@import url('${url}');`,
            fontFamily: fontFamily || ''
        };
    }

    // No URL found - treat as plain font name
    fontFamily = trimmed;
    const formattedName = fontFamily.replace(/\s+/g, '+');
    url = `https://fonts.googleapis.com/css2?family=${formattedName}&display=swap`;

    return {
        importStatement: `@import url('${url}');`,
        fontFamily: fontFamily
    };
}

/**
 * Get parsed font family name from user input (for CSS font-family property)
 */
export function getFontFamilyName(input) {
    const parsed = parseFontInput(input);
    return parsed.fontFamily;
}

/**
 * Get Google Fonts import statement from user input
 * Cache busting removed - handled by link elements for smoother loading
 */
export function getGoogleFontImport(input) {
    const parsed = parseFontInput(input);
    if (!parsed.importStatement) return '';

    // Return original @import without cache busting
    // The link elements handle cache busting when needed
    return parsed.importStatement;
}

/**
 * Force load Google Font by injecting link element (more reliable than @import)
 * Properly tracked for cleanup to prevent memory leaks
 * Only reloads if font actually changed to prevent flickering
 */
export function preloadGoogleFont(input, forceReload, ExtensionState) {
    const parsed = parseFontInput(input);
    if (!parsed.importStatement) return;

    const urlMatch = parsed.importStatement.match(/url\(['"]?([^'"]+)['"]?\)/);
    if (!urlMatch) return;

    const fontUrl = urlMatch[1];

    // Check if this font is already loaded (prevent flickering on chat changes)
    if (!forceReload && ExtensionState.currentLoadedFont === fontUrl) {
        return; // Font already loaded, skip reload
    }

    // Mark this font as loaded
    ExtensionState.currentLoadedFont = fontUrl;

    // Remove old preload if exists (cleanup old elements)
    const oldPreload = document.getElementById('avatar-banner-font-preload');
    if (oldPreload) oldPreload.remove();

    // Add preload link for faster loading
    const preload = document.createElement('link');
    preload.id = 'avatar-banner-font-preload';
    preload.rel = 'preload';
    preload.as = 'style';
    // Only use cache buster when force reloading (user changed font)
    preload.href = forceReload ?
        fontUrl + (fontUrl.includes('?') ? '&' : '?') + `_cb=${Date.now()}` :
        fontUrl;

    // Track for cleanup (CRITICAL for memory management)
    ExtensionState.cleanupFunctions.push(() => {
        const el = document.getElementById('avatar-banner-font-preload');
        if (el) el.remove();
    });

    document.head.appendChild(preload);

    // Also add direct link element (more reliable than @import in some browsers)
    const oldLink = document.getElementById('avatar-banner-font-link');
    if (oldLink) oldLink.remove();
    
    const link = document.createElement('link');
    link.id = 'avatar-banner-font-link';
    link.rel = 'stylesheet';
    // Only use cache buster when force reloading (user changed font)
    link.href = forceReload ?
        fontUrl + (fontUrl.includes('?') ? '&' : '?') + `_cb=${Date.now()}` :
        fontUrl;
    
    // Track for cleanup (CRITICAL for memory management)
    ExtensionState.cleanupFunctions.push(() => {
        const el = document.getElementById('avatar-banner-font-link');
        if (el) el.remove();
    });

    document.head.appendChild(link);
}