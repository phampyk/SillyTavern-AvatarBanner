import { user_avatar } from '../../../personas.js';

const extensionName = 'SillyTavern-AvatarBanner';

// Get the current character's avatar path
export function getCurrentCharacterAvatar() {
    try {
        const context = SillyTavern.getContext();
        if (!context.characters || context.characterId === undefined) {
            return null;
        }
        const char = context.characters[context.characterId];
        return char?.avatar || null;
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error getting character avatar:', error);
        return null;
    }
}

// Check if we're in a group chat
export function isGroupChat() {
    try {
        const context = SillyTavern.getContext();
        return !!context.groupId;
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error checking group chat:', error);
        return false;
    }
}

// Get the current group object
export function getCurrentGroup() {
    try {
        const context = SillyTavern.getContext();
        if (!context.groupId || !context.groups) {
            return null;
        }
        return context.groups.find(g => g.id === context.groupId) || null;
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error getting current group:', error);
        return null;
    }
}

// Get character ID by avatar filename
export function getCharacterIdByAvatar(avatarFilename) {
    try {
        const context = SillyTavern.getContext();
        if (!context.characters) return undefined;
        return context.characters.findIndex(c => c.avatar === avatarFilename);
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error getting character by avatar:', error);
        return undefined;
    }
}

// Get the current user/persona avatar path
export function getCurrentUserAvatar() {
    return user_avatar || null;
}

// Get full resolution URL for persona avatar
export function getPersonaImageUrlFullRes(avatarFilename) {
    return `/User Avatars/${avatarFilename}?t=${Date.now()}`;
}

// Escape HTML special characters to prevent XSS
export function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Parse color string to RGB object
export function hexToRgb(color) {
    // Return default if color is not a valid string
    if (!color || typeof color !== 'string') {
        return { r: 231, g: 159, b: 168 };
    }
    
    // Clean whitespace
    color = color.trim();

    // Handle rgb/rgba strings
    if (color.startsWith('rgb')) {
        const parts = color.match(/\d+/g);
        if (parts && parts.length >= 3) {
            return {
                r: parseInt(parts[0]),
                g: parseInt(parts[1]),
                b: parseInt(parts[2])
            };
        }
    }

    // Expand short form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const hex = color.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 231, g: 159, b: 168 }; // Default fallback
}

// Check if Moonlit Echoes theme is active (via auto-detection)
export function isMoonlitTheme(settings) {
    // Auto-detection via body classes or specific theme style elements
    const moonlitClasses = ['echostyle', 'whisperstyle', 'hushstyle', 'ripplestyle', 'tidestyle'];
    const hasMoonlitClass = moonlitClasses.some(cls => document.body.classList.contains(cls));
    const hasMoonlitStyle = !!document.getElementById('MoonlitEchosTheme-style');
    return hasMoonlitClass || hasMoonlitStyle;
}

// Validate that a string is a safe data URL for images
export function isValidImageDataUrl(str) {
    if (!str || typeof str !== 'string') return false;
    // Must start with data:image/ and contain base64 data
    return /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(str);
}

// Robust color comparison
export function areColorsEqual(color1, color2) {
    if (!color1 || !color2) return false;
    
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    
    // Check if conversion succeeded
    if (!rgb1 || !rgb2) return false;
    
    return Math.abs(rgb1.r - rgb2.r) < 3 &&
           Math.abs(rgb1.g - rgb2.g) < 3 &&
           Math.abs(rgb1.b - rgb2.b) < 3;
}
// Check if banners should be shown for current chat style
// Only Flat and Bubble styles support banners (not Document or Moonlit styles)
export function shouldShowBanner() {
    const body = document.body;
    
    const hasBubble = body.classList.contains('bubblechat');
    const hasDocument = body.classList.contains('documentstyle');
    
    // Check for Moonlit custom styles (Echo, Whisper, Hush, Ripple, Tide)
    const hasMoonlitStyle = 
        body.classList.contains('echostyle') ||
        body.classList.contains('whisperstyle') ||
        body.classList.contains('hushstyle') ||
        body.classList.contains('ripplestyle') ||
        body.classList.contains('tidestyle');
    
    // Flat is default (no bubblechat, no documentstyle, no moonlit style)
    const hasFlat = !hasBubble && !hasDocument && !hasMoonlitStyle;
    
    // Show banners for Flat or Bubble only
    return hasFlat || hasBubble;
}

// Check if Smart Dialogue Colorizer (SDC) name coloring is enabled
// Only use SDC's color for name gradient if this returns true
export function isSDCNameColoringEnabled() {
    try {
        // Check if extension_settings exists (SillyTavern global)
        if (!window.extension_settings) return false;
        
        // Check if SDC is installed
        const sdcSettings = window.extension_settings['SillyTavern-Smart-Dialogue-Colorizer'];
        if (!sdcSettings) return false;
        
        // Check if name coloring is enabled for characters
        return sdcSettings.charColorSettings?.colorNameText === true;
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error checking SDC name coloring:', error);
        return false;
    }
}
