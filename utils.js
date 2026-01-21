/**
 * Avatar Banner Extension - Utility Functions
 * EXACT copy from v3.3.3 lines 70-157, 459-480
 */

import { user_avatar } from '../../../personas.js';

const extensionName = 'SillyTavern-AvatarBanner';

/**
 * Get the current character's avatar path
 */
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

/**
 * Check if we're in a group chat
 */
export function isGroupChat() {
    try {
        const context = SillyTavern.getContext();
        return !!context.groupId;
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error checking group chat:', error);
        return false;
    }
}

/**
 * Get the current group object
 */
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

/**
 * Get character ID by avatar filename
 */
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

/**
 * Get character ID by name (supports chat-name extension via _originalName)
 */
export function getCharacterIdByName(name) {
    try {
        const context = SillyTavern.getContext();
        if (!context.characters) return undefined;
        // Check both name and _originalName for chat-name extension compatibility
        const index = context.characters.findIndex(c =>
            c.name === name || c._originalName === name
        );
        return index >= 0 ? index : undefined;
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error getting character by name:', error);
        return undefined;
    }
}

/**
 * Get the current user/persona avatar path
 */
export function getCurrentUserAvatar() {
    return user_avatar || null;
}

/**
 * Get full resolution URL for persona avatar
 */
export function getPersonaImageUrlFullRes(avatarFilename) {
    return `/User Avatars/${avatarFilename}?t=${Date.now()}`;
}

/**
 * Generate CSS selector-safe string from character name
 */
export function escapeCSS(str) {
    return str.replace(/["\\]/g, '\\$&');
}

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Parse hex color to RGB object
 */
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 231, g: 159, b: 168 }; // Default fallback (legacy)
}

/**
 * Convert RGB to RGBA string
 */
export function rgba(rgbObj, alpha) {
    return `rgba(${rgbObj.r}, ${rgbObj.g}, ${rgbObj.b}, ${alpha})`;
}