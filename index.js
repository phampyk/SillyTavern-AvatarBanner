/**
 * Avatar Banner Extension for SillyTavern
 * Adds cinematic banner crops above character/user messages
 * 
 * Stores banners PER-CHARACTER in character card data using writeExtensionField
 * User/persona banners stored in extension_settings
 * 
 * @version 3.2.4
 * @compatibility Works with chat-name extension (uses _originalName for CSS selectors)
 * @feature Optional display name override for cleaner styled names (uses JS text replacement for mobile compatibility)
 * @fix Group chat font styling - aggressive CSS specificity and forced font loading with cache busting
 * @compliance Full production compliance - memory leak prevention, proper cleanup tracking, error handling
 */

import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { power_user } from '../../../power-user.js';
import { user_avatar } from '../../../personas.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';

const extensionName = 'SillyTavern-AvatarBanner';

// Namespaced state for proper cleanup (prevents memory leaks)
const ExtensionState = {
    cleanupFunctions: [],
    observer: null,
    initialized: false,
};

// Default settings (global settings only - banners stored per-character)
const defaultSettings = {
    enabled: true,
    bannerHeight: 150,
    enableUserBanners: false,
    userBanners: {}, // Only for persona banners: { [personaAvatar]: dataUrl }
    // v2 styling options
    extraStylingEnabled: false,
    fontFamily: '',
    accentColor: '#e79fa8', // Default pinkish color
    fontSize: 36, // Name text font size
    namePaddingTB: 6, // Name text padding top/bottom (px)
    namePaddingLR: 10, // Name text padding left/right (px)
    useDisplayName: false, // Use short display name instead of full card name (for CharacterName ext)
};

/**
 * Get extension settings, initializing if needed
 */
function getSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = { ...defaultSettings };
    }
    if (!extension_settings[extensionName].userBanners) {
        extension_settings[extensionName].userBanners = {};
    }
    return extension_settings[extensionName];
}

/**
 * Save settings using ST's API
 */
function saveSettings() {
    saveSettingsDebounced();
}

/**
 * Get the current character's avatar path
 */
function getCurrentCharacterAvatar() {
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
function isGroupChat() {
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
function getCurrentGroup() {
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
function getCharacterIdByAvatar(avatarFilename) {
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
function getCharacterIdByName(name) {
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
function getCurrentUserAvatar() {
    return user_avatar || null;
}

/**
 * Get full resolution URL for persona avatar
 */
function getPersonaImageUrlFullRes(avatarFilename) {
    return `/User Avatars/${avatarFilename}?t=${Date.now()}`;
}

/**
 * Get banner for a character from their card data
 */
async function getCharacterBanner(characterId) {
    try {
        const context = SillyTavern.getContext();
        const character = context.characters?.[characterId];
        return character?.data?.extensions?.[extensionName]?.banner || null;
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error getting character banner:', error);
        return null;
    }
}

/**
 * Save banner to character card data using ST's writeExtensionField
 */
async function saveCharacterBanner(characterId, bannerDataUrl) {
    try {
        const context = SillyTavern.getContext();
        const { writeExtensionField } = context;
        
        if (!writeExtensionField) {
            console.error(`[${extensionName}]`, 'writeExtensionField not available');
            toastr.error('Cannot save banner - API not available');
            return false;
        }
        
        await writeExtensionField(characterId, extensionName, { banner: bannerDataUrl });
        console.log(`[${extensionName}]`, 'Banner saved for character ID:', characterId);
        return true;
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error saving banner:', error);
        toastr.error('Failed to save banner');
        return false;
    }
}

/**
 * Remove banner from character card data
 */
async function removeCharacterBanner(characterId) {
    try {
        const context = SillyTavern.getContext();
        const { writeExtensionField } = context;
        
        if (!writeExtensionField) {
            return false;
        }
        
        await writeExtensionField(characterId, extensionName, { banner: null });
        console.log(`[${extensionName}]`, 'Banner removed for character ID:', characterId);
        return true;
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error removing banner:', error);
        return false;
    }
}

/**
 * Get banner for user/persona (stored in extension settings)
 */
function getUserBanner(avatarPath) {
    const settings = getSettings();
    return settings.userBanners[avatarPath] || null;
}

/**
 * Save banner for user/persona
 */
function saveUserBanner(avatarPath, bannerDataUrl) {
    const settings = getSettings();
    settings.userBanners[avatarPath] = bannerDataUrl;
    saveSettings();
    console.log(`[${extensionName}]`, 'User banner saved for:', avatarPath);
}

/**
 * Remove banner for user/persona
 */
function removeUserBanner(avatarPath) {
    const settings = getSettings();
    delete settings.userBanners[avatarPath];
    saveSettings();
    console.log(`[${extensionName}]`, 'User banner removed for:', avatarPath);
}

/**
 * Show popup with options to Edit or Delete banner using ST's native popup API
 */
async function showBannerOptionsPopup(displayName, onEdit, onDelete) {
    try {
        const result = await callGenericPopup(
            `<p>A banner is already configured for <b>${displayName}</b>.</p><p>What would you like to do?</p>`,
            POPUP_TYPE.CONFIRM,
            '',
            { okButton: 'Edit', cancelButton: 'Remove' }
        );
        
        if (result) {
            // Edit
            await onEdit();
        } else if (result === false) {
            // Remove - confirm first
            const confirmResult = await callGenericPopup(
                '<p>Are you sure you want to remove this banner?</p>',
                POPUP_TYPE.CONFIRM,
                '',
                { okButton: 'Yes, Remove', cancelButton: 'Cancel' }
            );
            
            if (confirmResult) {
                await onDelete();
            }
        }
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error showing banner options popup:', error);
        toastr.error('Error showing options');
    }
}

/**
 * Open the banner crop editor
 */
async function openBannerEditor(avatarPath, displayName, isUser = false, characterId = null) {
    if (!avatarPath) {
        toastr.warning('No avatar found');
        return;
    }

    try {
        // Construct avatar URL
        let avatarUrl;
        if (isUser) {
            avatarUrl = getPersonaImageUrlFullRes(avatarPath);
        } else {
            avatarUrl = `/characters/${avatarPath}`;
        }

        console.log(`[${extensionName}]`, 'Loading avatar from:', avatarUrl);

        // Fetch and convert to base64
        const response = await fetch(avatarUrl);
        if (!response.ok) {
            throw new Error(`Failed to load avatar: ${response.status}`);
        }
        const blob = await response.blob();
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        console.log(`[${extensionName}]`, 'Avatar loaded, opening crop editor');

        // Use ST's native POPUP_TYPE.CROP API (from popup.js line 358-376, 576-581)
        const croppedDataUrl = await callGenericPopup(
            `Configure banner for ${displayName}`,
            POPUP_TYPE.CROP,
            dataUrl,
            {
                cropAspect: 4, // 4:1 aspect ratio for wide banners
                cropImage: dataUrl,
                okButton: 'Save Banner',
                cancelButton: 'Cancel',
            }
        );

        if (croppedDataUrl && typeof croppedDataUrl === 'string' && croppedDataUrl.startsWith('data:')) {
            if (isUser) {
                saveUserBanner(avatarPath, croppedDataUrl);
            } else {
                await saveCharacterBanner(characterId, croppedDataUrl);
            }
            
            applyBannersToChat();
            toastr.success(`Banner saved for ${displayName}`);
        }
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error in banner editor:', error);
        toastr.error(`Failed to load avatar image: ${error.message}`);
    }
}

/**
 * Handle banner button click - show options if banner exists, otherwise open editor
 */
async function handleBannerButtonClick(avatarPath, displayName, isUser, characterId = null) {
    try {
        let existingBanner;
        
        if (isUser) {
            existingBanner = getUserBanner(avatarPath);
        } else {
            existingBanner = await getCharacterBanner(characterId);
        }
        
        if (existingBanner) {
            await showBannerOptionsPopup(
                displayName,
                () => openBannerEditor(avatarPath, displayName, isUser, characterId),
                async () => {
                    if (isUser) {
                        removeUserBanner(avatarPath);
                    } else {
                        await removeCharacterBanner(characterId);
                    }
                    applyBannersToChat();
                    toastr.info(`Banner removed for ${displayName}`);
                }
            );
        } else {
            await openBannerEditor(avatarPath, displayName, isUser, characterId);
        }
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error handling banner button click:', error);
        toastr.error('Error processing banner');
    }
}

/**
 * Create a banner element
 */
function createBannerElement(bannerDataUrl, height, mesElement) {
    const banner = document.createElement('div');
    banner.className = 'avatar-banner';
    
    const mesStyle = window.getComputedStyle(mesElement);
    const borderRadius = mesStyle.borderRadius || '0px';
    
    // Use CSS variable for height so media queries can override
    banner.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        --banner-height: ${height}px;
        height: var(--banner-height);
        background: url("${bannerDataUrl}") top center no-repeat;
        background-size: cover;
        mask-image: linear-gradient(to bottom, black 60%, rgba(0,0,0,0) 100%);
        mask-size: 100% 100%;
        mask-repeat: no-repeat;
        -webkit-mask-image: linear-gradient(to bottom, black 60%, rgba(0,0,0,0) 100%);
        -webkit-mask-size: 100% 100%;
        -webkit-mask-repeat: no-repeat;
        z-index: 1;
        pointer-events: none;
        border-top-left-radius: ${borderRadius};
        border-top-right-radius: ${borderRadius};
    `;

    return banner;
}

/**
 * Dynamic style element for per-character CSS
 */
let dynamicStyleElement = null;

/**
 * Get or create the dynamic style element for per-character rules
 */
function getDynamicStyleElement() {
    if (!dynamicStyleElement) {
        dynamicStyleElement = document.createElement('style');
        dynamicStyleElement.id = 'avatar-banner-dynamic-styles';
        document.head.appendChild(dynamicStyleElement);
    }
    return dynamicStyleElement;
}

/**
 * Generate CSS selector-safe string from character name
 */
function escapeCSS(str) {
    return str.replace(/["\\]/g, '\\$&');
}

/**
 * Parse hex color to RGB object
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 231, g: 159, b: 168 }; // Default fallback
}

/**
 * Generate rgba string from RGB object and alpha
 */
function rgba(rgb, alpha) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Parse font input and return { importStatement, fontFamily }
 */
function parseFontInput(input) {
    if (!input || input.trim() === '') {
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
 * Get Google Fonts import statement from user input with cache busting
 */
function getGoogleFontImport(input) {
    const parsed = parseFontInput(input);
    if (!parsed.importStatement) return '';
    
    // Extract URL from @import statement
    const urlMatch = parsed.importStatement.match(/url\(['"]?([^'"]+)['"]?\)/);
    if (!urlMatch) return parsed.importStatement;
    
    const fontUrl = urlMatch[1];
    // Add cache buster timestamp
    const cacheBustedUrl = fontUrl + (fontUrl.includes('?') ? '&' : '?') + `_cb=${Date.now()}`;
    
    return `@import url('${cacheBustedUrl}');`;
}

/**
 * Force load Google Font by injecting link element (more reliable than @import)
 * Properly tracked for cleanup to prevent memory leaks
 */
function preloadGoogleFont(input) {
    const parsed = parseFontInput(input);
    if (!parsed.importStatement) return;
    
    const urlMatch = parsed.importStatement.match(/url\(['"]?([^'"]+)['"]?\)/);
    if (!urlMatch) return;
    
    const fontUrl = urlMatch[1];
    
    // Remove old preload if exists (cleanup old elements)
    const oldPreload = document.getElementById('avatar-banner-font-preload');
    if (oldPreload) oldPreload.remove();
    
    // Add preload link for faster loading
    const preload = document.createElement('link');
    preload.id = 'avatar-banner-font-preload';
    preload.rel = 'preload';
    preload.as = 'style';
    preload.href = fontUrl + (fontUrl.includes('?') ? '&' : '?') + `_cb=${Date.now()}`;
    
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
    link.href = fontUrl + (fontUrl.includes('?') ? '&' : '?') + `_cb=${Date.now()}`;
    
    // Track for cleanup (CRITICAL for memory management)
    ExtensionState.cleanupFunctions.push(() => {
        const el = document.getElementById('avatar-banner-font-link');
        if (el) el.remove();
    });
    
    document.head.appendChild(link);
}

/**
 * Get the font family name from user input
 */
function getFontFamilyName(input) {
    return parseFontInput(input).fontFamily;
}

/**
 * Generate extra styling CSS for characters/personas with banners
 * @param {string} characterName - The name used for CSS selector (original card name)
 * @param {boolean} isUser - Whether this is for user messages
 * @param {object} settings - Extension settings
 * @param {string} displayName - The name to display (can be different from characterName)
 */
function generateExtraStylingCSS(characterName, isUser, settings, displayName = null) {
    const rgb = hexToRgb(settings.accentColor);
    const paddingTop = Math.max(settings.bannerHeight - 30, 50);
    const paddingTopMobile = Math.max(Math.round(settings.bannerHeight * 0.45 - 23), 20);
    const parsedFontName = getFontFamilyName(settings.fontFamily);
    const fontFamily = parsedFontName ? `"${parsedFontName}", cursive` : '"Caveat", cursive';
    const fontSize = settings.fontSize || 36;
    const fontSizeMobile = Math.max(Math.round(fontSize * 0.7), 20);
    const namePaddingTB = Number.isFinite(settings.namePaddingTB) ? settings.namePaddingTB : 6;
    const namePaddingLR = Number.isFinite(settings.namePaddingLR) ? settings.namePaddingLR : 10;
    
    let selector;
    if (isUser) {
        selector = '.mes[is_user="true"]';
    } else {
        const escapedName = escapeCSS(characterName);
        selector = `.mes[ch_name="${escapedName}"]`;
    }
    
    let css = '';
    
    // Name text styling - Use highly specific selector to override ST defaults
    css += `/* Extra Styling - Name Text */\n`;
    css += `#chat ${selector} .ch_name .name_text,\n`;
    css += `${selector} .ch_name .name_text {\n`;
    css += `    display: inline-block !important;\n`;
    css += `    font-size: ${fontSize}px !important;\n`;
    css += `    font-family: ${fontFamily} !important;\n`;
    css += `    line-height: 1.6 !important;\n`;
    css += `    text-align: left !important;\n`;
    css += `    padding: ${namePaddingTB}px ${namePaddingLR}px !important;\n`;
    css += `    margin: 0 !important;\n`;
    css += `    overflow: visible !important;\n`;
    css += `    clip: unset !important;\n`;
    css += `    clip-path: none !important;\n`;
    css += `    text-overflow: unset !important;\n`;
    css += `    white-space: normal !important;\n`;
    css += `    min-height: 1.6em !important;\n`;
    css += `    background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.8), ${rgba(rgb, 1)}) !important;\n`;
    css += `    -webkit-background-clip: text !important;\n`;
    css += `    background-clip: text !important;\n`;
    css += `    -webkit-text-fill-color: transparent !important;\n`;
    css += `    color: transparent !important;\n`;
    css += `    text-shadow: none !important;\n`;
    css += `    filter: drop-shadow(0 0 5px ${rgba(rgb, 0.3)}) drop-shadow(0 0 1px rgba(255, 255, 255, 0.3)) !important;\n`;
    css += `}\n\n`;
    
    // Ensure parent containers don't clip
    css += `${selector} .ch_name,\n`;
    css += `${selector} .mes_block,\n`;
    css += `${selector} .mesIDDisplay,\n`;
    css += `${selector} .mes_text_container {\n`;
    css += `    overflow: visible !important;\n`;
    css += `    text-overflow: unset !important;\n`;
    css += `}\n\n`;
    
    // Name text children
    css += `${selector} .name_text img,\n`;
    css += `${selector} .name_text span,\n`;
    css += `${selector} .name_text svg,\n`;
    css += `${selector} .icon-svg,\n`;
    css += `${selector} .timestamp {\n`;
    css += `    fill: currentColor;\n`;
    css += `    height: 14px;\n`;
    css += `    aspect-ratio: 1;\n`;
    css += `    place-self: unset;\n`;
    css += `    margin-right: 5px;\n`;
    css += `    white-space: nowrap;\n`;
    css += `}\n\n`;
    
    // Message buttons styling
    css += `${selector} .mes_button,\n`;
    css += `${selector} .extraMesButtons > div {\n`;
    css += `    place-self: center baseline;\n`;
    css += `    align-self: center;\n`;
    css += `    font-size: 14px;\n`;
    css += `    padding: 5px;\n`;
    css += `    margin-left: 3px;\n`;
    css += `    border-radius: 50%;\n`;
    css += `    background: linear-gradient(to bottom, ${rgba(rgb, 0.8)}, rgba(255, 255, 255, 0.5));\n`;
    css += `    color: rgba(255, 255, 255, 0.9);\n`;
    css += `    box-shadow: 0 0 5px ${rgba(rgb, 0.8)};\n`;
    css += `    transition: all 0.3s ease-in-out;\n`;
    css += `}\n\n`;
    
    // Message container styling
    const blurTintVar = isUser ? '--SmartThemeUserMesBlurTintColor' : '--SmartThemeBotMesBlurTintColor';
    
    if (isUser) {
        // USER MESSAGES: Split styling
        css += `#chat ${selector} {\n`;
        css += `    position: relative;\n`;
        css += `    padding: 15px 25px 15px 25px !important;\n`;
        css += `    background:\n`;
        css += `        linear-gradient(to bottom, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0) 90%, ${rgba(rgb, 0.5)} 100%),\n`;
        css += `        var(${blurTintVar});\n`;
        css += `    border: ${rgba(rgb, 0.7)} solid 2px !important;\n`;
        css += `    box-shadow: 3px 3px 10px ${rgba(rgb, 0.25)} !important;\n`;
        css += `}\n\n`;
        
        css += `#chat ${selector}.has-avatar-banner {\n`;
        css += `    padding-top: ${paddingTop}px !important;\n`;
        css += `}\n\n`;
        
        // Mobile
        css += `@media screen and (max-width: 768px) {\n`;
        css += `    #chat ${selector} {\n`;
        css += `        padding: 10px 15px 10px 15px !important;\n`;
        css += `    }\n`;
        css += `    #chat ${selector}.has-avatar-banner {\n`;
        css += `        padding-top: ${paddingTopMobile}px !important;\n`;
        css += `    }\n`;
        css += `    ${selector} .name_text {\n`;
        css += `        font-size: ${fontSizeMobile}px !important;\n`;
        css += `        padding: ${namePaddingTB}px ${namePaddingLR}px !important;\n`;
        css += `    }\n`;
        css += `}\n\n`;
    } else {
        // CHARACTER MESSAGES: Original behavior
        css += `#chat ${selector}.has-avatar-banner {\n`;
        css += `    position: relative;\n`;
        css += `    padding: ${paddingTop}px 25px 15px !important;\n`;
        css += `    background:\n`;
        css += `        linear-gradient(to bottom, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0) 90%, ${rgba(rgb, 0.5)} 100%),\n`;
        css += `        var(${blurTintVar});\n`;
        css += `    border: ${rgba(rgb, 0.7)} solid 2px !important;\n`;
        css += `    box-shadow: 3px 3px 10px ${rgba(rgb, 0.25)} !important;\n`;
        css += `}\n\n`;
        
        // Mobile
        css += `@media screen and (max-width: 768px) {\n`;
        css += `    #chat ${selector}.has-avatar-banner {\n`;
        css += `        padding: ${paddingTopMobile}px 15px 10px !important;\n`;
        css += `    }\n`;
        css += `    ${selector} .name_text {\n`;
        css += `        font-size: ${fontSizeMobile}px !important;\n`;
        css += `        padding: ${namePaddingTB}px ${namePaddingLR}px !important;\n`;
        css += `    }\n`;
        css += `}\n\n`;
    }
    
    return css;
}

/**
 * Update dynamic CSS rules for current chat
 */
async function updateDynamicCSS() {
    try {
        const settings = getSettings();
        const styleEl = getDynamicStyleElement();
        
        if (!settings.enabled) {
            styleEl.textContent = '';
            return;
        }
        
        const context = SillyTavern.getContext();
        const inGroupChat = isGroupChat();
        
        let css = '';
        const paddingTop = Math.max(settings.bannerHeight - 30, 50);
        const paddingTopMobile = Math.max(Math.round(settings.bannerHeight * 0.45 - 23), 20);
        
        let anyCharacterHasBanner = false;
        let charactersToProcess = [];
        
        if (inGroupChat) {
            const group = getCurrentGroup();
            if (group && group.members) {
                css += `/* Avatar Banner - Group Chat: ${group.name} */\n`;
                css += `/* Members: ${group.members.join(', ')} */\n\n`;
                
                for (const memberAvatar of group.members) {
                    const charId = getCharacterIdByAvatar(memberAvatar);
                    if (charId !== undefined && charId >= 0) {
                        const character = context.characters[charId];
                        if (character) {
                            charactersToProcess.push({
                                id: charId,
                                name: character.name,
                                avatar: character.avatar
                            });
                        }
                    }
                }
            }
        } else {
            const currentCharId = context.characterId;
            if (currentCharId !== undefined) {
                const character = context.characters?.[currentCharId];
                if (character) {
                    css += `/* Avatar Banner - Single Chat: ${character.name} */\n\n`;
                    charactersToProcess.push({
                        id: currentCharId,
                        name: character.name,
                        avatar: character.avatar
                    });
                }
            }
        }
        
        let fontImportAdded = false;
        
        // Process each character
        for (const charInfo of charactersToProcess) {
            const banner = await getCharacterBanner(charInfo.id);
            const hasBanner = !!banner;
            
            if (hasBanner) {
                anyCharacterHasBanner = true;
                
                if (!fontImportAdded && settings.extraStylingEnabled && settings.fontFamily) {
                    // Preload font for faster/more reliable loading
                    preloadGoogleFont(settings.fontFamily);
                    css += getGoogleFontImport(settings.fontFamily) + '\n\n';
                    fontImportAdded = true;
                }
            }
            
            // CRITICAL: Get character from context to check for _originalName
            const character = context.characters[charInfo.id];
            
            // For CSS selector: Use _originalName if it exists (matches DOM ch_name attribute)
            // The DOM ch_name is set from the CHARACTER CARD NAME, not the display name
            const nameForSelector = character?._originalName || character?.name || charInfo.name;
            const escapedName = escapeCSS(nameForSelector);
            
            // For display: Use character.name (the display name from CharacterName extension)
            const displayName = character?.name || charInfo.name;
            
            // Debug logging for group chats (wrapped for safety)
            if (inGroupChat && hasBanner) {
                try {
                    console.log(`[${extensionName}] Processing ${displayName}:`, {
                        originalName: character?._originalName,
                        displayName: displayName,
                        nameForSelector: nameForSelector,
                        hasBanner: hasBanner,
                        extraStyling: settings.extraStylingEnabled
                    });
                } catch (logError) {
                    // Silently fail on logging errors
                }
            }
            
            if (hasBanner) {
                css += `/* ${displayName} - Has Banner */\n`;
                css += `.mes[ch_name="${escapedName}"] .avatar {\n`;
                css += `    display: none !important;\n`;
                css += `}\n`;
                
                if (!settings.extraStylingEnabled) {
                    css += `#chat .mes[ch_name="${escapedName}"] {\n`;
                    css += `    padding: ${paddingTop}px 25px 15px !important;\n`;
                    css += `}\n`;
                    css += `@media screen and (max-width: 768px) {\n`;
                    css += `    #chat .mes[ch_name="${escapedName}"] {\n`;
                    css += `        padding: ${paddingTopMobile}px 15px 10px !important;\n`;
                    css += `    }\n`;
                    css += `}\n`;
                }
                css += `\n`;
                
                if (settings.extraStylingEnabled) {
                    // Pass nameForSelector (for CSS selector) and displayName (for text override)
                    css += generateExtraStylingCSS(nameForSelector, false, settings, displayName);
                }
            } else {
                css += `/* ${displayName} - No Banner, Show Avatar */\n`;
                css += `.mes[ch_name="${escapedName}"] .avatar {\n`;
                css += `    display: flex !important;\n`;
                css += `    visibility: visible !important;\n`;
                css += `}\n\n`;
            }
        }
        
        // User messages CSS
        if (anyCharacterHasBanner) {
            css += `/* User Messages - Banner Mode */\n`;
            css += `.mes[is_user="true"] .avatar {\n`;
            css += `    display: none !important;\n`;
            css += `}\n`;
            
            css += `.mes[is_user="true"] .ch_name,\n`;
            css += `.mes[is_user="true"] .mes_block {\n`;
            css += `    overflow: visible !important;\n`;
            css += `}\n`;
            
            css += `.mes[is_user="true"] .ch_name > .flex-container > .flex-container.alignItemsBaseline {\n`;
            css += `    flex-wrap: wrap !important;\n`;
            css += `}\n`;
            css += `.mes[is_user="true"] .ch_name .name_text {\n`;
            css += `    flex-basis: 100% !important;\n`;
            css += `}\n`;
            
            if (!settings.extraStylingEnabled) {
                css += `#chat .mes[is_user="true"].has-avatar-banner {\n`;
                css += `    padding: ${paddingTop}px 25px 15px !important;\n`;
                css += `}\n`;
                css += `@media screen and (max-width: 768px) {\n`;
                css += `    #chat .mes[is_user="true"].has-avatar-banner {\n`;
                css += `        padding: ${paddingTopMobile}px 15px 10px !important;\n`;
                css += `    }\n`;
                css += `}\n`;
            } else {
                css += generateExtraStylingCSS(null, true, settings);
            }
            css += `\n`;
        }
        
        // Mobile responsive banner height
        const mobileHeight = Math.round(settings.bannerHeight * 0.65);
        css += `/* Mobile responsive banner height */\n`;
        css += `@media screen and (max-width: 768px) {\n`;
        css += `    .avatar-banner {\n`;
        css += `        --banner-height: ${mobileHeight}px !important;\n`;
        css += `        height: var(--banner-height) !important;\n`;
        css += `    }\n`;
        css += `}\n`;
        
        styleEl.textContent = css;
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error updating dynamic CSS:', error);
    }
}

/**
 * Apply banners to all messages in the chat
 */
async function applyBannersToChat() {
    try {
        const settings = getSettings();
        
        await updateDynamicCSS();
        
        if (!settings.enabled) {
            document.querySelectorAll('.avatar-banner').forEach(el => el.remove());
            document.querySelectorAll('.mes').forEach(mes => {
                mes.classList.remove('has-avatar-banner');
            });
            return;
        }

        const context = SillyTavern.getContext();
        const messages = document.querySelectorAll('.mes');
        const inGroupChat = isGroupChat();
        
        // Build cache of character banners and info
        const bannerCache = new Map();
        const characterInfoCache = new Map(); // Store {id, name, _originalName}
        
        if (inGroupChat) {
            const group = getCurrentGroup();
            if (group && group.members) {
                for (const memberAvatar of group.members) {
                    const charId = getCharacterIdByAvatar(memberAvatar);
                    if (charId !== undefined && charId >= 0) {
                        const character = context.characters[charId];
                        if (character) {
                            const banner = await getCharacterBanner(charId);
                            const nameForLookup = character._originalName || character.name;
                            
                            bannerCache.set(nameForLookup, banner);
                            characterInfoCache.set(nameForLookup, {
                                id: charId,
                                displayName: character.name,
                                originalName: character._originalName || character.name
                            });
                            
                            // Also cache by regular name if _originalName exists
                            if (character._originalName) {
                                bannerCache.set(character.name, banner);
                                characterInfoCache.set(character.name, {
                                    id: charId,
                                    displayName: character.name,
                                    originalName: character._originalName
                                });
                            }
                        }
                    }
                }
            }
        } else {
            const currentCharId = context.characterId;
            if (currentCharId !== undefined) {
                const character = context.characters?.[currentCharId];
                if (character) {
                    const banner = await getCharacterBanner(currentCharId);
                    const nameForLookup = character._originalName || character.name;
                    
                    bannerCache.set(nameForLookup, banner);
                    characterInfoCache.set(nameForLookup, {
                        id: currentCharId,
                        displayName: character.name,
                        originalName: character._originalName || character.name
                    });
                    
                    if (character._originalName) {
                        bannerCache.set(character.name, banner);
                        characterInfoCache.set(character.name, {
                            id: currentCharId,
                            displayName: character.name,
                            originalName: character._originalName
                        });
                    }
                }
            }
        }
        
        const anyCharacterHasBanner = Array.from(bannerCache.values()).some(b => !!b);
        
        messages.forEach(mes => {
            const existingBanner = mes.querySelector('.avatar-banner');
            if (existingBanner) {
                existingBanner.remove();
            }

            const isUser = mes.getAttribute('is_user') === 'true';
            
            if (isUser) {
                if (!anyCharacterHasBanner) {
                    mes.classList.remove('has-avatar-banner');
                    return;
                }
                
                if (!settings.enableUserBanners) {
                    mes.classList.remove('has-avatar-banner');
                    return;
                }
            }

            let bannerDataUrl = null;

            if (isUser) {
                const forceAvatar = mes.getAttribute('force_avatar');
                let userAvatarPath;
                if (forceAvatar && forceAvatar.startsWith('User Avatars/')) {
                    userAvatarPath = forceAvatar.replace('User Avatars/', '');
                } else {
                    userAvatarPath = getCurrentUserAvatar();
                }
                
                if (userAvatarPath) {
                    bannerDataUrl = getUserBanner(userAvatarPath);
                }
            } else {
                const charName = mes.getAttribute('ch_name');
                if (charName) {
                    if (bannerCache.has(charName)) {
                        bannerDataUrl = bannerCache.get(charName);
                    } else {
                        const charId = getCharacterIdByName(charName);
                        if (charId !== undefined && charId >= 0) {
                            const character = context.characters[charId];
                            bannerDataUrl = character?.data?.extensions?.[extensionName]?.banner || null;
                            bannerCache.set(charName, bannerDataUrl);
                            
                            // Also add to character info cache if not present
                            if (!characterInfoCache.has(charName)) {
                                characterInfoCache.set(charName, {
                                    id: charId,
                                    displayName: character.name,
                                    originalName: character._originalName || character.name
                                });
                            }
                        }
                    }
                    
                    // Replace displayed name if useDisplayName is enabled and extra styling is on
                    if (settings.useDisplayName && settings.extraStylingEnabled && bannerDataUrl) {
                        const charInfo = characterInfoCache.get(charName);
                        if (charInfo && charInfo.displayName && charInfo.originalName !== charInfo.displayName) {
                            const nameTextEl = mes.querySelector('.name_text');
                            if (nameTextEl && nameTextEl.textContent.trim() === charInfo.originalName) {
                                nameTextEl.textContent = charInfo.displayName;
                            }
                        }
                    } else {
                        // Restore original name if feature is disabled
                        const charInfo = characterInfoCache.get(charName);
                        if (charInfo && charInfo.displayName && charInfo.originalName !== charInfo.displayName) {
                            const nameTextEl = mes.querySelector('.name_text');
                            if (nameTextEl && nameTextEl.textContent.trim() === charInfo.displayName) {
                                nameTextEl.textContent = charInfo.originalName;
                            }
                        }
                    }
                }
            }

            if (bannerDataUrl) {
                const banner = createBannerElement(bannerDataUrl, settings.bannerHeight, mes);
                mes.style.position = 'relative';
                mes.insertBefore(banner, mes.firstChild);
                mes.classList.add('has-avatar-banner');
            } else {
                mes.classList.remove('has-avatar-banner');
            }
        });
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error applying banners to chat:', error);
    }
}

/**
 * Add button to character editor panel (with proper cleanup tracking)
 */
function addCharacterEditorButton() {
    // Setup event handler with cleanup tracking (once)
    if (!ExtensionState.charClickHandlerBound) {
        const handler = async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                const context = SillyTavern.getContext();
                const characterId = context.characterId;
                const avatarPath = getCurrentCharacterAvatar();
                const charName = context.characters?.[characterId]?.name || 'Character';
                
                if (avatarPath && characterId !== undefined) {
                    await handleBannerButtonClick(avatarPath, charName, false, characterId);
                } else {
                    toastr.warning('No character avatar found');
                }
            } catch (error) {
                console.error(`[${extensionName}]`, 'Error in character banner button:', error);
            }
        };
        
        jQuery(document).on('click', '#avatar_banner_button', handler);
        ExtensionState.charClickHandlerBound = true;
        
        // Track for cleanup
        ExtensionState.cleanupFunctions.push(() => {
            jQuery(document).off('click', '#avatar_banner_button', handler);
            ExtensionState.charClickHandlerBound = false;
        });
    }

    // Don't add button if it already exists
    if (document.getElementById('avatar_banner_button')) {
        return;
    }

    const buttonsBlock = document.querySelector('#avatar_controls .form_create_bottom_buttons_block');
    if (!buttonsBlock) {
        return;
    }

    const button = document.createElement('div');
    button.id = 'avatar_banner_button';
    button.className = 'menu_button fa-solid fa-panorama interactable';
    button.title = 'Configure Avatar Banner';
    button.setAttribute('data-i18n', '[title]Configure Avatar Banner');
    button.setAttribute('tabindex', '0');
    button.setAttribute('role', 'button');

    const deleteButton = buttonsBlock.querySelector('#delete_button');
    if (deleteButton) {
        buttonsBlock.insertBefore(button, deleteButton);
    } else {
        buttonsBlock.appendChild(button);
    }
}

/**
 * Add button to persona panel (with proper cleanup tracking)
 */
function addPersonaPanelButton() {
    // Setup event handler with cleanup tracking (once)
    if (!ExtensionState.personaClickHandlerBound) {
        const handler = async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                const userAvatar = user_avatar;
                const userName = power_user.personas[userAvatar] || power_user.name || 'User';
                
                if (userAvatar && userAvatar !== 'none') {
                    await handleBannerButtonClick(userAvatar, userName, true);
                } else {
                    toastr.warning('No persona avatar set');
                }
            } catch (error) {
                console.error(`[${extensionName}]`, 'Error in persona banner button:', error);
            }
        };
        
        jQuery(document).on('click', '#persona_banner_button', handler);
        ExtensionState.personaClickHandlerBound = true;
        
        // Track for cleanup
        ExtensionState.cleanupFunctions.push(() => {
            jQuery(document).off('click', '#persona_banner_button', handler);
            ExtensionState.personaClickHandlerBound = false;
        });
    }

    // Don't add button if it already exists
    if (document.getElementById('persona_banner_button')) {
        return;
    }

    const buttonsBlock = document.querySelector('#persona_controls .persona_controls_buttons_block');
    if (!buttonsBlock) {
        return;
    }

    const button = document.createElement('div');
    button.id = 'persona_banner_button';
    button.className = 'menu_button fa-solid fa-panorama interactable';
    button.title = 'Configure Persona Banner';
    button.setAttribute('data-i18n', '[title]Configure Persona Banner');
    button.setAttribute('tabindex', '0');
    button.setAttribute('role', 'button');

    const deleteButton = buttonsBlock.querySelector('#persona_delete_button');
    if (deleteButton) {
        buttonsBlock.insertBefore(button, deleteButton);
    } else {
        buttonsBlock.appendChild(button);
    }
}

/**
 * Create and inject the settings panel HTML
 * (Keeping ALL your original styling features)
 */
function createSettingsPanel() {
    const settings = getSettings();
    const disabledClass = settings.extraStylingEnabled ? '' : 'disabled';
    
    const settingsHtml = `
    <div class="avatar-banner-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Avatar Banners</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="avatar-banner-grid-row">
                    <label class="checkbox_label flexnowrap" for="avatar_banner_enabled">
                        <input type="checkbox" id="avatar_banner_enabled" ${settings.enabled ? 'checked' : ''}>
                        <span>Enable Avatar Banners</span>
                        <div class="fa-solid fa-circle-info opacity50p" title="Configure banners using the panorama button in character/persona panels."></div>
                    </label>
                    <label class="checkbox_label flexnowrap" for="avatar_banner_extra_styling">
                        <input type="checkbox" id="avatar_banner_extra_styling" ${settings.extraStylingEnabled ? 'checked' : ''}>
                        <span>Enable Extra Styling</span>
                        <div class="fa-solid fa-circle-info opacity50p" title="Adds custom styling for name text, buttons, and message containers."></div>
                    </label>
                </div>
                
                <div class="avatar-banner-grid-row">
                    <label class="checkbox_label flexnowrap" for="avatar_banner_user_enabled">
                        <input type="checkbox" id="avatar_banner_user_enabled" ${settings.enableUserBanners ? 'checked' : ''}>
                        <span>Enable Persona Banners</span>
                        <div class="fa-solid fa-circle-info opacity50p" title="When enabled, persona messages will also show banners if configured."></div>
                    </label>
                    <label class="checkbox_label flexnowrap ${disabledClass}" for="avatar_banner_use_display_name" id="avatar_banner_display_name_row">
                        <input type="checkbox" id="avatar_banner_use_display_name" ${settings.useDisplayName ? 'checked' : ''}>
                        <span>Use Display Name</span>
                        <div class="fa-solid fa-circle-info opacity50p" title="Show short display name instead of full card name (e.g. 'Bo' instead of 'Bo ║ Teenage Dirtbag'). Only works with extra styling enabled."></div>
                    </label>
                </div>
                
                <div class="avatar-banner-grid-row">
                    <div class="avatar-banner-inline ${disabledClass}" id="avatar_banner_color_row">
                        <span>Accent Color</span>
                        <div class="fa-solid fa-circle-info opacity50p" title="Used for borders, shadows, gradients, and text effects"></div>
                        <toolcool-color-picker id="avatar_banner_color" color="${settings.accentColor || '#e79fa8'}"></toolcool-color-picker>
                    </div>
                    <div style="min-height: 1px;"></div>
                </div>
                
                <div class="avatar-banner-font-row ${disabledClass}" id="avatar_banner_font_row">
                    <span>Font Family</span>
                    <div class="fa-solid fa-circle-info opacity50p" title="Enter a font name (e.g. Caveat) or paste the full @import from Google Fonts for special fonts"></div>
                    <input type="text" id="avatar_banner_font" class="text_pole" placeholder="Font name or @import url(...)" value="${settings.fontFamily || ''}">
                </div>
                
                <div class="avatar-banner-grid-row">
                    <div class="alignitemscenter flex-container flexFlowColumn flexBasis48p flexGrow flexShrink gap0">
                        <small>
                            <span>Banner Size</span>
                            <div class="fa-solid fa-circle-info opacity50p" title="Height of the banner image in pixels"></div>
                        </small>
                        <input class="neo-range-slider" type="range" id="avatar_banner_height" min="80" max="300" step="1" value="${settings.bannerHeight}">
                        <input class="neo-range-input" type="number" min="80" max="300" step="1" id="avatar_banner_height_counter" value="${settings.bannerHeight}">
                    </div>
                    <div class="alignitemscenter flex-container flexFlowColumn flexBasis48p flexGrow flexShrink gap0 ${disabledClass}" id="avatar_banner_fontsize_row">
                        <small>
                            <span>Font Size</span>
                            <div class="fa-solid fa-circle-info opacity50p" title="Size of the character/persona name text"></div>
                        </small>
                        <input class="neo-range-slider" type="range" id="avatar_banner_fontsize" min="16" max="72" step="1" value="${settings.fontSize || 36}">
                        <input class="neo-range-input" type="number" min="16" max="72" step="1" id="avatar_banner_fontsize_counter" value="${settings.fontSize || 36}">
                    </div>
                </div>

                <div class="avatar-banner-grid-row ${disabledClass}" id="avatar_banner_namepadding_row">
                    <div class="alignitemscenter flex-container flexFlowColumn flexBasis48p flexGrow flexShrink gap0">
                        <small>
                            <span>Name Padding (T/B)</span>
                            <div class="fa-solid fa-circle-info opacity50p" title="Top/bottom padding for the name text (px)"></div>
                        </small>
                        <input class="neo-range-slider" type="range" id="avatar_banner_namepad_tb" min="0" max="40" step="1" value="${Number.isFinite(settings.namePaddingTB) ? settings.namePaddingTB : 6}">
                        <input class="neo-range-input" type="number" min="0" max="40" step="1" id="avatar_banner_namepad_tb_counter" value="${Number.isFinite(settings.namePaddingTB) ? settings.namePaddingTB : 6}">
                    </div>
                    <div class="alignitemscenter flex-container flexFlowColumn flexBasis48p flexGrow flexShrink gap0">
                        <small>
                            <span>Name Padding (L/R)</span>
                            <div class="fa-solid fa-circle-info opacity50p" title="Left/right padding for the name text (px)"></div>
                        </small>
                        <input class="neo-range-slider" type="range" id="avatar_banner_namepad_lr" min="0" max="60" step="1" value="${Number.isFinite(settings.namePaddingLR) ? settings.namePaddingLR : 10}">
                        <input class="neo-range-input" type="number" min="0" max="60" step="1" id="avatar_banner_namepad_lr_counter" value="${Number.isFinite(settings.namePaddingLR) ? settings.namePaddingLR : 10}">
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    const extensionsSettings = document.getElementById('extensions_settings');
    if (extensionsSettings) {
        const container = document.createElement('div');
        container.innerHTML = settingsHtml;
        extensionsSettings.appendChild(container);

        // Attach event listeners (ALL YOUR ORIGINAL FUNCTIONALITY)
        document.getElementById('avatar_banner_enabled').addEventListener('change', (e) => {
            const settings = getSettings();
            settings.enabled = e.target.checked;
            saveSettings();
            applyBannersToChat();
        });

        document.getElementById('avatar_banner_user_enabled').addEventListener('change', (e) => {
            const settings = getSettings();
            settings.enableUserBanners = e.target.checked;
            saveSettings();
            applyBannersToChat();
        });

        const heightSlider = document.getElementById('avatar_banner_height');
        const heightCounter = document.getElementById('avatar_banner_height_counter');
        
        const updateBannerHeight = (value) => {
            const settings = getSettings();
            settings.bannerHeight = parseInt(value, 10);
            saveSettings();
            applyBannersToChat();
        };
        
        heightSlider.addEventListener('input', (e) => {
            heightCounter.value = e.target.value;
            updateBannerHeight(e.target.value);
        });
        
        heightCounter.addEventListener('input', (e) => {
            heightSlider.value = e.target.value;
            updateBannerHeight(e.target.value);
        });
        
        const fontSizeSlider = document.getElementById('avatar_banner_fontsize');
        const fontSizeCounter = document.getElementById('avatar_banner_fontsize_counter');
        
        const updateFontSize = (value) => {
            const settings = getSettings();
            settings.fontSize = parseInt(value, 10);
            saveSettings();
            applyBannersToChat();
        };
        
        fontSizeSlider.addEventListener('input', (e) => {
            fontSizeCounter.value = e.target.value;
            updateFontSize(e.target.value);
        });
        
        fontSizeCounter.addEventListener('input', (e) => {
            fontSizeSlider.value = e.target.value;
            updateFontSize(e.target.value);
        });

        const namePadTbSlider = document.getElementById('avatar_banner_namepad_tb');
        const namePadTbCounter = document.getElementById('avatar_banner_namepad_tb_counter');
        const namePadLrSlider = document.getElementById('avatar_banner_namepad_lr');
        const namePadLrCounter = document.getElementById('avatar_banner_namepad_lr_counter');

        const updateNamePaddingTB = (value) => {
            const settings = getSettings();
            settings.namePaddingTB = parseInt(value, 10);
            saveSettings();
            applyBannersToChat();
        };

        const updateNamePaddingLR = (value) => {
            const settings = getSettings();
            settings.namePaddingLR = parseInt(value, 10);
            saveSettings();
            applyBannersToChat();
        };

        if (namePadTbSlider && namePadTbCounter) {
            namePadTbSlider.addEventListener('input', (e) => {
                namePadTbCounter.value = e.target.value;
                updateNamePaddingTB(e.target.value);
            });

            namePadTbCounter.addEventListener('input', (e) => {
                namePadTbSlider.value = e.target.value;
                updateNamePaddingTB(e.target.value);
            });
        }

        if (namePadLrSlider && namePadLrCounter) {
            namePadLrSlider.addEventListener('input', (e) => {
                namePadLrCounter.value = e.target.value;
                updateNamePaddingLR(e.target.value);
            });

            namePadLrCounter.addEventListener('input', (e) => {
                namePadLrSlider.value = e.target.value;
                updateNamePaddingLR(e.target.value);
            });
        }
        
        document.getElementById('avatar_banner_extra_styling').addEventListener('change', (e) => {
            const settings = getSettings();
            settings.extraStylingEnabled = e.target.checked;
            saveSettings();
            
            const fontRow = document.getElementById('avatar_banner_font_row');
            const colorRow = document.getElementById('avatar_banner_color_row');
            const fontSizeRow = document.getElementById('avatar_banner_fontsize_row');
            const namePaddingRow = document.getElementById('avatar_banner_namepadding_row');
            const displayNameRow = document.getElementById('avatar_banner_display_name_row');
            
            if (e.target.checked) {
                fontRow.classList.remove('disabled');
                colorRow.classList.remove('disabled');
                fontSizeRow.classList.remove('disabled');
                namePaddingRow?.classList.remove('disabled');
                displayNameRow?.classList.remove('disabled');
            } else {
                fontRow.classList.add('disabled');
                colorRow.classList.add('disabled');
                fontSizeRow.classList.add('disabled');
                namePaddingRow?.classList.add('disabled');
                displayNameRow?.classList.add('disabled');
            }
            
            applyBannersToChat();
        });
        
        document.getElementById('avatar_banner_font').addEventListener('input', (e) => {
            const settings = getSettings();
            settings.fontFamily = e.target.value.trim();
            saveSettings();
            applyBannersToChat();
        });
        
        document.getElementById('avatar_banner_use_display_name').addEventListener('change', (e) => {
            const settings = getSettings();
            settings.useDisplayName = e.target.checked;
            saveSettings();
            applyBannersToChat();
        });
        
        const colorPicker = document.getElementById('avatar_banner_color');
        if (colorPicker) {
            colorPicker.addEventListener('change', (e) => {
                const settings = getSettings();
                const color = e.detail?.hex || colorPicker.color;
                if (color) {
                    settings.accentColor = color;
                    saveSettings();
                    applyBannersToChat();
                }
            });
        }
    }
}

/**
 * Inject required CSS styles
 */
function injectStyles() {
    if (document.getElementById('avatar-banner-styles')) {
        return;
    }
    
    const style = document.createElement('style');
    style.id = 'avatar-banner-styles';
    style.textContent = `
        .mes.has-avatar-banner {
            position: relative;
            overflow: visible !important;
        }
        
        .mes.has-avatar-banner .mes_block,
        .mes.has-avatar-banner .mes_text,
        .mes.has-avatar-banner .ch_name,
        .mes.has-avatar-banner .avatar {
            position: relative;
            z-index: 2;
        }
        
        .mes.has-avatar-banner .ch_name,
        .mes.has-avatar-banner .mes_block {
            overflow: visible !important;
        }
        
        .mes.has-avatar-banner .ch_name > .flex-container > .flex-container.alignItemsBaseline {
            flex-wrap: wrap !important;
        }
        .mes.has-avatar-banner .ch_name .name_text {
            flex-basis: 100% !important;
        }
        
        .avatar-banner-settings .inline-drawer-content {
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding-bottom: 10px;
        }
        
        .avatar-banner-settings .checkbox_label {
            display: inline-flex !important;
            align-items: center;
            gap: 6px;
            cursor: pointer;
        }
        
        .avatar-banner-settings .checkbox_label input[type="checkbox"] {
            flex-shrink: 0;
            margin: 0;
        }
        
        .avatar-banner-grid-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        
        .avatar-banner-font-row {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .avatar-banner-font-row input[type="text"].text_pole {
            flex: 1;
            margin: 0;
        }
        
        .avatar-banner-inline {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .avatar-banner-inline.disabled,
        .avatar-banner-font-row.disabled,
        .avatar-banner-grid-row .disabled {
            opacity: 0.5;
            pointer-events: none;
        }
        
        .avatar-banner-grid-row input[type="text"].text_pole {
            margin: 0;
        }
        
        #avatar_banner_button,
        #persona_banner_button {
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Setup optimized MutationObserver for UI panels (with cleanup tracking)
 */
function setupMutationObserver() {
    if (ExtensionState.observer) {
        return; // Already setup
    }
    
    const observer = new MutationObserver((mutations) => {
        try {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' || mutation.type === 'attributes') {
                    const characterPopup = document.getElementById('character_popup');
                    if (characterPopup && characterPopup.style.display !== 'none') {
                        addCharacterEditorButton();
                    }
                    
                    const personaDrawer = document.querySelector('#persona-management-button .drawer-content');
                    if (personaDrawer && personaDrawer.classList.contains('openDrawer')) {
                        requestAnimationFrame(() => addPersonaPanelButton());
                    }
                }
            }
        } catch (error) {
            console.error(`[${extensionName}]`, 'Error in MutationObserver:', error);
        }
    });
    
    const observeTargets = () => {
        const characterPopup = document.getElementById('character_popup');
        const personaButton = document.getElementById('persona-management-button');
        
        if (characterPopup) {
            observer.observe(characterPopup, {
                childList: true,
                attributes: true,
                attributeFilter: ['style'],
                subtree: false // OPTIMIZED: Don't watch deep tree
            });
        }
        
        if (personaButton) {
            observer.observe(personaButton, {
                childList: true,
                attributes: true,
                attributeFilter: ['class'],
                subtree: true
            });
        }
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observeTargets);
    } else {
        observeTargets();
    }
    
    ExtensionState.observer = observer;
    
    // Track for cleanup
    ExtensionState.cleanupFunctions.push(() => {
        if (ExtensionState.observer) {
            ExtensionState.observer.disconnect();
            ExtensionState.observer = null;
        }
    });
}

/**
 * Cleanup function for proper resource management
 * PREVENTS MEMORY LEAKS
 */
function cleanup() {
    console.log(`[${extensionName}]`, 'Cleaning up resources...');
    
    // Execute all cleanup functions
    ExtensionState.cleanupFunctions.forEach(fn => {
        try {
            fn();
        } catch (error) {
            console.error(`[${extensionName}]`, 'Error during cleanup:', error);
        }
    });
    
    ExtensionState.cleanupFunctions = [];
    
    // Remove dynamic styles
    if (dynamicStyleElement) {
        dynamicStyleElement.remove();
        dynamicStyleElement = null;
    }
    
    // Remove static styles
    const staticStyles = document.getElementById('avatar-banner-styles');
    if (staticStyles) {
        staticStyles.remove();
    }
    
    // Font preload/link elements are already tracked in cleanupFunctions above
    
    // Remove all banners from DOM
    document.querySelectorAll('.avatar-banner').forEach(el => el.remove());
    document.querySelectorAll('.mes').forEach(mes => {
        mes.classList.remove('has-avatar-banner');
    });
    
    // Remove buttons
    const charButton = document.getElementById('avatar_banner_button');
    if (charButton) charButton.remove();
    
    const personaButton = document.getElementById('persona_banner_button');
    if (personaButton) personaButton.remove();
    
    ExtensionState.initialized = false;
    
    console.log(`[${extensionName}]`, 'Cleanup complete');
}

/**
 * Initialize the extension
 */
function init() {
    if (ExtensionState.initialized) {
        console.log(`[${extensionName}]`, 'Already initialized, skipping');
        return;
    }
    
    try {
        console.log(`[${extensionName}]`, 'Initializing v3.1.0...');
        
        // Initialize settings and UI
        getSettings();
        injectStyles();
        createSettingsPanel();
        
        // Register event handlers with cleanup tracking
        const chatChangedHandler = () => {
            applyBannersToChat();
            addCharacterEditorButton();
        };
        eventSource.on(event_types.CHAT_CHANGED, chatChangedHandler);
        ExtensionState.cleanupFunctions.push(() => {
            eventSource.removeListener(event_types.CHAT_CHANGED, chatChangedHandler);
        });
        
        const messageReceivedHandler = () => {
            requestAnimationFrame(() => applyBannersToChat());
        };
        eventSource.on(event_types.MESSAGE_RECEIVED, messageReceivedHandler);
        ExtensionState.cleanupFunctions.push(() => {
            eventSource.removeListener(event_types.MESSAGE_RECEIVED, messageReceivedHandler);
        });
        
        const messageSentHandler = () => {
            requestAnimationFrame(() => applyBannersToChat());
        };
        eventSource.on(event_types.MESSAGE_SENT, messageSentHandler);
        ExtensionState.cleanupFunctions.push(() => {
            eventSource.removeListener(event_types.MESSAGE_SENT, messageSentHandler);
        });
        
        const characterEditedHandler = () => {
            addCharacterEditorButton();
        };
        eventSource.on(event_types.CHARACTER_EDITED, characterEditedHandler);
        ExtensionState.cleanupFunctions.push(() => {
            eventSource.removeListener(event_types.CHARACTER_EDITED, characterEditedHandler);
        });
        
        const settingsUpdatedHandler = () => {
            applyBannersToChat();
        };
        eventSource.on(event_types.SETTINGS_UPDATED, settingsUpdatedHandler);
        ExtensionState.cleanupFunctions.push(() => {
            eventSource.removeListener(event_types.SETTINGS_UPDATED, settingsUpdatedHandler);
        });
        
        // Setup optimized MutationObserver
        setupMutationObserver();
        
        // Initial application
        setTimeout(() => {
            applyBannersToChat();
            addCharacterEditorButton();
            addPersonaPanelButton();
        }, 1000);
        
        ExtensionState.initialized = true;
        console.log(`[${extensionName}]`, 'Initialization complete');
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error during initialization:', error);
    }
}

// jQuery ready - standard ST extension pattern
jQuery(() => {
    init();
});

// Export cleanup for extension system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { cleanup };
}

// Make cleanup available globally for manual cleanup if needed
window.AvatarBannerExtension = window.AvatarBannerExtension || {};
window.AvatarBannerExtension.cleanup = cleanup;
