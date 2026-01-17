/**
 * Avatar Banner Extension for SillyTavern
 * Adds cinematic banner crops above character/user messages
 * 
 * Stores banners PER-CHARACTER in character card data using writeExtensionField
 * User/persona banners stored in extension_settings
 */

import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { power_user } from '../../../power-user.js';
import { user_avatar } from '../../../personas.js';

const extensionName = 'SillyTavern-AvatarBanner';

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
    namePaddingLR: 10 // Name text padding left/right (px)
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
    const context = SillyTavern.getContext();
    if (!context.characters || context.characterId === undefined) {
        return null;
    }
    const char = context.characters[context.characterId];
    return char?.avatar || null;
}

/**
 * Check if we're in a group chat
 */
function isGroupChat() {
    const context = SillyTavern.getContext();
    return !!context.groupId;
}

/**
 * Get the current group object
 */
function getCurrentGroup() {
    const context = SillyTavern.getContext();
    if (!context.groupId || !context.groups) {
        return null;
    }
    return context.groups.find(g => g.id === context.groupId) || null;
}

/**
 * Get character ID by avatar filename
 */
function getCharacterIdByAvatar(avatarFilename) {
    const context = SillyTavern.getContext();
    if (!context.characters) return undefined;
    return context.characters.findIndex(c => c.avatar === avatarFilename);
}

/**
 * Get character ID by name
 */
function getCharacterIdByName(name) {
    const context = SillyTavern.getContext();
    if (!context.characters) return undefined;
    const index = context.characters.findIndex(c => c.name === name);
    return index >= 0 ? index : undefined;
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
    const context = SillyTavern.getContext();
    const character = context.characters?.[characterId];
    return character?.data?.extensions?.[extensionName]?.banner || null;
}

/**
 * Save banner to character card data
 */
async function saveCharacterBanner(characterId, bannerDataUrl) {
    const context = SillyTavern.getContext();
    const { writeExtensionField } = context;
    
    if (!writeExtensionField) {
        console.error(`[${extensionName}] writeExtensionField not available`);
        toastr.error('Cannot save banner - API not available');
        return false;
    }
    
    try {
        await writeExtensionField(characterId, extensionName, { banner: bannerDataUrl });
        return true;
    } catch (error) {
        console.error(`[${extensionName}] Error saving banner:`, error);
        toastr.error('Failed to save banner');
        return false;
    }
}

/**
 * Remove banner from character card data
 */
async function removeCharacterBanner(characterId) {
    const context = SillyTavern.getContext();
    const { writeExtensionField } = context;
    
    if (!writeExtensionField) {
        return false;
    }
    
    try {
        await writeExtensionField(characterId, extensionName, { banner: null });
        return true;
    } catch (error) {
        console.error(`[${extensionName}] Error removing banner:`, error);
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
}

/**
 * Remove banner for user/persona
 */
function removeUserBanner(avatarPath) {
    const settings = getSettings();
    delete settings.userBanners[avatarPath];
    saveSettings();
}

/**
 * Show popup with options to Edit or Delete banner
 */
async function showBannerOptionsPopup(displayName, onEdit, onDelete) {
    const context = SillyTavern.getContext();
    const { Popup, POPUP_TYPE } = context;
    
    if (!Popup || !POPUP_TYPE) {
        // Fallback: just open editor
        onEdit();
        return;
    }
    
    // Use a simple confirm popup first asking if they want to remove
    const removeConfirm = new Popup(
        `Banner exists for ${displayName}`,
        POPUP_TYPE.CONFIRM,
        `<div style="text-align: center;">
            <p>A banner is already configured.</p>
            <p><b>Remove</b> the banner, or <b>Edit</b> it?</p>
        </div>`,
        {
            okButton: 'Edit',
            cancelButton: 'Remove',
        }
    );
    
    const result = await removeConfirm.show();
    
    // result is true for OK (Edit), false/null for Cancel (Remove)
    if (result === true || result === 1) {
        onEdit();
    } else if (result === false || result === 0) {
        // Confirm deletion
        const deleteConfirm = new Popup(
            'Confirm Removal',
            POPUP_TYPE.CONFIRM,
            '<p>Are you sure you want to remove this banner?</p>',
            {
                okButton: 'Yes, Remove',
                cancelButton: 'Cancel',
            }
        );
        
        const confirmResult = await deleteConfirm.show();
        if (confirmResult === true || confirmResult === 1) {
            onDelete();
        }
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

    const context = SillyTavern.getContext();
    const { Popup, POPUP_TYPE } = context;

    if (!Popup || !POPUP_TYPE) {
        toastr.error('Popup API not available');
        return;
    }

    let avatarUrl;
    if (isUser) {
        avatarUrl = getPersonaImageUrlFullRes(avatarPath);
    } else {
        avatarUrl = `/characters/${avatarPath}`;
    }

    try {
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

        const popup = new Popup(
            `Configure banner for ${displayName}`,
            POPUP_TYPE.CROP,
            '',
            {
                cropImage: dataUrl,
                cropAspect: 4,
                okButton: 'Save Banner',
                cancelButton: 'Cancel',
            }
        );

        const result = await popup.show();

        if (result && typeof result === 'string' && result.startsWith('data:')) {
            if (isUser) {
                saveUserBanner(avatarPath, result);
            } else {
                await saveCharacterBanner(characterId, result);
            }
            
            applyBannersToChat();
            toastr.success(`Banner saved for ${displayName}`);
        }
    } catch (error) {
        console.error(`[${extensionName}] Error in banner editor:`, error);
        toastr.error(`Failed to load avatar image: ${error.message}`);
    }
}

/**
 * Handle banner button click - show options if banner exists, otherwise open editor
 */
async function handleBannerButtonClick(avatarPath, displayName, isUser, characterId = null) {
    let existingBanner;
    
    if (isUser) {
        existingBanner = getUserBanner(avatarPath);
    } else {
        existingBanner = await getCharacterBanner(characterId);
    }
    
    if (existingBanner) {
        showBannerOptionsPopup(
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
        openBannerEditor(avatarPath, displayName, isUser, characterId);
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
 * Accepts multiple formats:
 * - Full @import with style tags: <style> @import url('...'); </style>
 * - Just @import: @import url('...');
 * - Just URL: https://fonts.googleapis.com/css2?family=...
 * - Just font name: Bagel Fat One
 */
function parseFontInput(input) {
    if (!input || input.trim() === '') {
        return { importStatement: '', fontFamily: '' };
    }
    
    const trimmed = input.trim();
    
    // Try to extract URL from various formats
    let url = null;
    let fontFamily = null;
    
    // Check if it contains a Google Fonts URL
    const urlMatch = trimmed.match(/https:\/\/fonts\.googleapis\.com\/css2?\?[^"'\s)]+/);
    
    if (urlMatch) {
        url = urlMatch[0];
        
        // Extract font family name from URL (family=Font+Name or family=Font+Name:...)
        const familyMatch = url.match(/family=([^&:]+)/);
        if (familyMatch) {
            // Convert URL format back to readable name (Bagel+Fat+One -> Bagel Fat One)
            fontFamily = decodeURIComponent(familyMatch[1].replace(/\+/g, ' '));
        }
        
        return {
            importStatement: `@import url('${url}');`,
            fontFamily: fontFamily || ''
        };
    }
    
    // No URL found - treat as plain font name, construct basic URL
    fontFamily = trimmed;
    const formattedName = fontFamily.replace(/\s+/g, '+');
    url = `https://fonts.googleapis.com/css2?family=${formattedName}&display=swap`;
    
    return {
        importStatement: `@import url('${url}');`,
        fontFamily: fontFamily
    };
}

/**
 * Generate Google Fonts import statement from user input
 * Wrapper for parseFontInput that returns just the import statement
 */
function getGoogleFontImport(input) {
    return parseFontInput(input).importStatement;
}

/**
 * Get the font family name from user input (for CSS font-family property)
 */
function getFontFamilyName(input) {
    return parseFontInput(input).fontFamily;
}

/**
 * Generate extra styling CSS for characters/personas with banners
 */
function generateExtraStylingCSS(characterName, isUser, settings) {
    const rgb = hexToRgb(settings.accentColor);
    const paddingTop = Math.max(settings.bannerHeight - 30, 50);
    // Non-linear formula: smaller banners need more subtraction, larger need less
    const paddingTopMobile = Math.max(Math.round(settings.bannerHeight * 0.45 - 23), 20);
    // Parse font input to get the actual font family name
    const parsedFontName = getFontFamilyName(settings.fontFamily);
    const fontFamily = parsedFontName ? `"${parsedFontName}", cursive` : '"Caveat", cursive';
    const fontSize = settings.fontSize || 36;
    const fontSizeMobile = Math.max(Math.round(fontSize * 0.7), 20); // 70% size on mobile
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
    
    // Name text styling - remove italic which can cause clipping issues
    css += `/* Extra Styling - Name Text */\n`;
    css += `${selector} .name_text {\n`;
    css += `    display: inline-block !important;\n`;
    css += `    font-size: ${fontSize}px !important;\n`;
    css += `    font-family: ${fontFamily} !important;\n`;
    css += `    line-height: 1.6;\n`;
    css += `    text-align: left;\n`;
    css += `    padding: ${namePaddingTB}px ${namePaddingLR}px !important;\n`;
    css += `    margin: 0;\n`;
    css += `    overflow: visible !important;\n`;
    css += `    clip: unset !important;\n`;
    css += `    clip-path: none !important;\n`;
    css += `    text-overflow: unset !important;\n`;
    css += `    white-space: normal !important;\n`;
    css += `    min-height: 1.6em;\n`;
    css += `    /* Gradient text color */\n`;
    css += `    background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.8), ${rgba(rgb, 1)}) !important;\n`;
    css += `    -webkit-background-clip: text !important;\n`;
    css += `    background-clip: text !important;\n`;
    css += `    -webkit-text-fill-color: transparent !important;\n`;
    css += `    color: transparent !important;\n`;
    css += `    /* Glow effect (post-render) */\n`;
    css += `    text-shadow: none !important;\n`;
    css += `    filter: drop-shadow(0 0 5px ${rgba(rgb, 0.3)}) drop-shadow(0 0 1px rgba(255, 255, 255, 0.3)) !important;\n`;
    css += `}\n\n`;
    
    // Ensure ALL parent containers don't clip - be very aggressive
    css += `${selector} .ch_name,\n`;
    css += `${selector} .mes_block,\n`;
    css += `${selector} .mesIDDisplay,\n`;
    css += `${selector} .mes_text_container {\n`;
    css += `    overflow: visible !important;\n`;
    css += `    text-overflow: unset !important;\n`;
    css += `}\n\n`;
    
    // Name text children (icons, timestamp, etc.)
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
    
    // Message container styling (with calculated padding)
    // Use appropriate blur tint color for user vs bot messages
    const blurTintVar = isUser ? '--SmartThemeUserMesBlurTintColor' : '--SmartThemeBotMesBlurTintColor';
    
    if (isUser) {
        // USER MESSAGES: Split styling
        // Base styling (background, border, side padding) applies to ALL user messages in banner mode
        css += `#chat ${selector} {\n`;
        css += `    position: relative;\n`;
        css += `    padding: 15px 25px 15px 25px !important;\n`;  // Normal padding, no banner space
        css += `    background:\n`;
        css += `        linear-gradient(to bottom, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0) 90%, ${rgba(rgb, 0.5)} 100%),\n`;
        css += `        var(${blurTintVar});\n`;
        css += `    border: ${rgba(rgb, 0.7)} solid 2px !important;\n`;
        css += `    box-shadow: 3px 3px 10px ${rgba(rgb, 0.25)} !important;\n`;
        css += `}\n\n`;
        
        // Extra top padding ONLY for messages with actual banners
        css += `#chat ${selector}.has-avatar-banner {\n`;
        css += `    padding-top: ${paddingTop}px !important;\n`;
        css += `}\n\n`;
        
        // Mobile responsive styles
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
        // CHARACTER MESSAGES: Original behavior (styling only for messages with banners)
        css += `#chat ${selector}.has-avatar-banner {\n`;
        css += `    position: relative;\n`;
        css += `    padding: ${paddingTop}px 25px 15px !important;\n`;
        css += `    background:\n`;
        css += `        linear-gradient(to bottom, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0) 90%, ${rgba(rgb, 0.5)} 100%),\n`;
        css += `        var(${blurTintVar});\n`;
        css += `    border: ${rgba(rgb, 0.7)} solid 2px !important;\n`;
        css += `    box-shadow: 3px 3px 10px ${rgba(rgb, 0.25)} !important;\n`;
        css += `}\n\n`;
        
        // Mobile responsive styles
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
 * Uses ch_name attribute to target specific characters
 * Supports both single-character and group chats
 */
async function updateDynamicCSS() {
    const settings = getSettings();
    const styleEl = getDynamicStyleElement();
    
    if (!settings.enabled) {
        styleEl.textContent = '';
        return;
    }
    
    const context = SillyTavern.getContext();
    const inGroupChat = isGroupChat();
    
    let css = '';
    
    // Calculate padding - mobile uses non-linear formula
    const paddingTop = Math.max(settings.bannerHeight - 30, 50);
    const paddingTopMobile = Math.max(Math.round(settings.bannerHeight * 0.45 - 23), 20);
    
    // Track if ANY character has a banner (determines user message styling)
    let anyCharacterHasBanner = false;
    
    // Collect all characters we need to process
    let charactersToProcess = [];
    
    if (inGroupChat) {
        // GROUP CHAT: Process all group members
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
        // SINGLE CHARACTER CHAT: Process just the current character
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
    
    // Add Google Fonts import if font is specified and extra styling is enabled
    // (We'll check if any character has banner below)
    let fontImportAdded = false;
    
    // Process each character
    for (const charInfo of charactersToProcess) {
        const banner = await getCharacterBanner(charInfo.id);
        const hasBanner = !!banner;
        
        if (hasBanner) {
            anyCharacterHasBanner = true;
            
            // Add font import once if needed
            if (!fontImportAdded && settings.extraStylingEnabled && settings.fontFamily) {
                css += getGoogleFontImport(settings.fontFamily) + '\n\n';
                fontImportAdded = true;
            }
        }
        
        const escapedName = escapeCSS(charInfo.name);
        
        if (hasBanner) {
            // Character HAS banner - hide avatar
            css += `/* ${charInfo.name} - Has Banner */\n`;
            css += `.mes[ch_name="${escapedName}"] .avatar {\n`;
            css += `    display: none !important;\n`;
            css += `}\n`;
            
            // Add padding only if extra styling is NOT enabled
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
            
            // Add extra styling for character if enabled
            if (settings.extraStylingEnabled) {
                css += generateExtraStylingCSS(charInfo.name, false, settings);
            }
        } else {
            // Character does NOT have banner - force show avatar
            css += `/* ${charInfo.name} - No Banner, Show Avatar */\n`;
            css += `.mes[ch_name="${escapedName}"] .avatar {\n`;
            css += `    display: flex !important;\n`;
            css += `    visibility: visible !important;\n`;
            css += `}\n\n`;
        }
    }
    
    // CSS for user messages - when ANY character has a banner, user messages get styled for consistency
    // The actual banner element only appears when setting is ON + user has a banner configured
    if (anyCharacterHasBanner) {
        css += `/* User Messages - Banner Mode (consistent with character styling) */\n`;
        // Always hide user avatar when in banner mode
        css += `.mes[is_user="true"] .avatar {\n`;
        css += `    display: none !important;\n`;
        css += `}\n`;
        
        // Prevent clipping for ALL user messages in banner mode (not just ones with banners)
        css += `.mes[is_user="true"] .ch_name,\n`;
        css += `.mes[is_user="true"] .mes_block {\n`;
        css += `    overflow: visible !important;\n`;
        css += `}\n`;
        
        // Name text wrapping for ALL user messages
        css += `.mes[is_user="true"] .ch_name > .flex-container > .flex-container.alignItemsBaseline {\n`;
        css += `    flex-wrap: wrap !important;\n`;
        css += `}\n`;
        css += `.mes[is_user="true"] .ch_name .name_text {\n`;
        css += `    flex-basis: 100% !important;\n`;
        css += `}\n`;
        
        if (!settings.extraStylingEnabled) {
            // Padding only for messages WITH actual banners
            css += `#chat .mes[is_user="true"].has-avatar-banner {\n`;
            css += `    padding: ${paddingTop}px 25px 15px !important;\n`;
            css += `}\n`;
            css += `@media screen and (max-width: 768px) {\n`;
            css += `    #chat .mes[is_user="true"].has-avatar-banner {\n`;
            css += `        padding: ${paddingTopMobile}px 15px 10px !important;\n`;
            css += `    }\n`;
            css += `}\n`;
        } else {
            // Extra styling (font styling applies to all, container styling only to .has-avatar-banner)
            css += generateExtraStylingCSS(null, true, settings);
        }
        css += `\n`;
    }
    // When no character has a banner, user messages keep default styling (avatar shown, no extra padding)
    
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
}

/**
 * Apply banners to all messages in the chat
 * Supports both single-character and group chats
 */
async function applyBannersToChat() {
    const settings = getSettings();
    
    // Update per-character CSS rules
    await updateDynamicCSS();
    
    if (!settings.enabled) {
        // Remove all banners and clean up
        document.querySelectorAll('.avatar-banner').forEach(el => el.remove());
        document.querySelectorAll('.mes').forEach(mes => {
            mes.classList.remove('has-avatar-banner');
        });
        return;
    }

    const context = SillyTavern.getContext();
    const messages = document.querySelectorAll('.mes');
    const inGroupChat = isGroupChat();
    
    // Build a cache of character banners to avoid repeated lookups
    // Maps character name -> banner data URL (or null)
    const bannerCache = new Map();
    
    // Pre-populate cache for efficiency
    if (inGroupChat) {
        // GROUP CHAT: Cache banners for all group members
        const group = getCurrentGroup();
        if (group && group.members) {
            for (const memberAvatar of group.members) {
                const charId = getCharacterIdByAvatar(memberAvatar);
                if (charId !== undefined && charId >= 0) {
                    const character = context.characters[charId];
                    if (character) {
                        const banner = await getCharacterBanner(charId);
                        bannerCache.set(character.name, banner);
                    }
                }
            }
        }
    } else {
        // SINGLE CHARACTER CHAT: Cache banner for current character
        const currentCharId = context.characterId;
        if (currentCharId !== undefined) {
            const character = context.characters?.[currentCharId];
            if (character) {
                const banner = await getCharacterBanner(currentCharId);
                bannerCache.set(character.name, banner);
            }
        }
    }
    
    // Check if ANY character has a banner (determines user message styling)
    const anyCharacterHasBanner = Array.from(bannerCache.values()).some(b => !!b);
    
    messages.forEach(mes => {
        // Remove existing banner element
        const existingBanner = mes.querySelector('.avatar-banner');
        if (existingBanner) {
            existingBanner.remove();
        }

        const isUser = mes.getAttribute('is_user') === 'true';
        
        // User messages:
        // - CSS styling (hidden avatar, padding, font) applies when ANY char has banner
        // - The actual banner IMAGE only appears when setting ON + user has banner configured
        if (isUser) {
            if (!anyCharacterHasBanner) {
                // No characters have banners → normal mode, show avatar
                mes.classList.remove('has-avatar-banner');
                return;
            }
            
            if (!settings.enableUserBanners) {
                // User banners disabled → styling applies (via CSS), but no banner image
                // IMPORTANT: Remove the class to prevent padding from applying
                mes.classList.remove('has-avatar-banner');
                return;
            }
        }

        let bannerDataUrl = null;

        if (isUser) {
            // Get user avatar for this message
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
            // CHARACTER MESSAGE: Get banner for THIS specific character
            const charName = mes.getAttribute('ch_name');
            if (charName) {
                // First check cache
                if (bannerCache.has(charName)) {
                    bannerDataUrl = bannerCache.get(charName);
                } else {
                    // Not in cache (shouldn't happen, but fallback)
                    // This could happen if a character not in the group sent a message
                    const charId = getCharacterIdByName(charName);
                    if (charId !== undefined && charId >= 0) {
                        // Note: This is sync access since we can't await in forEach
                        // The banner should already be loaded on the character object
                        const character = context.characters[charId];
                        bannerDataUrl = character?.data?.extensions?.[extensionName]?.banner || null;
                        bannerCache.set(charName, bannerDataUrl);
                    }
                }
            }
        }

        if (bannerDataUrl) {
            // Has banner - insert banner element and add class
            const banner = createBannerElement(bannerDataUrl, settings.bannerHeight, mes);
            
            mes.style.position = 'relative';
            mes.insertBefore(banner, mes.firstChild);
            mes.classList.add('has-avatar-banner');
        } else {
            // No banner
            mes.classList.remove('has-avatar-banner');
        }
    });
}

/**
 * Add button to character editor panel
 */
function addCharacterEditorButton() {
    if (!window._avatarBannerCharClickBound) {
        jQuery(document).on('click', '#avatar_banner_button', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const context = SillyTavern.getContext();
            const characterId = context.characterId;
            const avatarPath = getCurrentCharacterAvatar();
            const charName = context.characters?.[characterId]?.name || 'Character';
            
            if (avatarPath && characterId !== undefined) {
                await handleBannerButtonClick(avatarPath, charName, false, characterId);
            } else {
                toastr.warning('No character avatar found');
            }
        });
        window._avatarBannerCharClickBound = true;
    }

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
 * Add button to persona panel
 */
function addPersonaPanelButton() {
    if (!window._avatarBannerPersonaClickBound) {
        jQuery(document).on('click', '#persona_banner_button', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const userAvatar = user_avatar;
            const userName = power_user.personas[user_avatar] || power_user.name || 'User';
            
            if (userAvatar && userAvatar !== 'none') {
                await handleBannerButtonClick(userAvatar, userName, true);
            } else {
                toastr.warning('No persona avatar set');
            }
        });
        window._avatarBannerPersonaClickBound = true;
    }

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

    // Find delete button - look for red button, trash icon, or button with "delete" in class/id
    const deleteButton = buttonsBlock.querySelector('.red_button, .redWarningBG, [class*="delete"], .fa-trash, .fa-skull');
    
    if (deleteButton) {
        // Get the actual button element (might be the icon inside)
        const targetButton = deleteButton.closest('.menu_button') || deleteButton;
        buttonsBlock.insertBefore(button, targetButton);
    } else {
        // Fallback: insert before the last button
        const allButtons = buttonsBlock.querySelectorAll('.menu_button');
        if (allButtons.length > 0) {
            buttonsBlock.insertBefore(button, allButtons[allButtons.length - 1]);
        } else {
            buttonsBlock.appendChild(button);
        }
    }
}

/**
 * Create and inject the settings panel HTML
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
                <!-- Row 1: Enable Avatar Banners | Enable Extra Styling -->
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
                
                <!-- Row 2: Enable Persona Banners | Accent Color -->
                <div class="avatar-banner-grid-row">
                    <label class="checkbox_label flexnowrap" for="avatar_banner_user_enabled">
                        <input type="checkbox" id="avatar_banner_user_enabled" ${settings.enableUserBanners ? 'checked' : ''}>
                        <span>Enable Persona Banners</span>
                        <div class="fa-solid fa-circle-info opacity50p" title="When enabled, persona messages will also show banners if configured."></div>
                    </label>
                    <div class="avatar-banner-inline ${disabledClass}" id="avatar_banner_color_row">
                        <span>Accent Color</span>
                        <div class="fa-solid fa-circle-info opacity50p" title="Used for borders, shadows, gradients, and text effects"></div>
                        <toolcool-color-picker id="avatar_banner_color" color="${settings.accentColor || '#e79fa8'}"></toolcool-color-picker>
                    </div>
                </div>
                
                <!-- Row 3: Font Family -->
                <div class="avatar-banner-font-row ${disabledClass}" id="avatar_banner_font_row">
                    <span>Font Family</span>
                    <div class="fa-solid fa-circle-info opacity50p" title="Enter a font name (e.g. Caveat) or paste the full @import from Google Fonts for special fonts"></div>
                    <input type="text" id="avatar_banner_font" class="text_pole" placeholder="Font name or @import url(...)" value="${settings.fontFamily || ''}">
                </div>
                
                <!-- Row 4: Two sliders side by side -->
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

                <!-- Row 5: Name padding controls (extra styling) -->
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

        // Enable/disable main feature
        document.getElementById('avatar_banner_enabled').addEventListener('change', (e) => {
            const settings = getSettings();
            settings.enabled = e.target.checked;
            saveSettings();
            applyBannersToChat();
        });

        // Enable/disable persona banners
        document.getElementById('avatar_banner_user_enabled').addEventListener('change', (e) => {
            const settings = getSettings();
            settings.enableUserBanners = e.target.checked;
            saveSettings();
            applyBannersToChat();
        });

        // Banner height - synced slider and number input
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
        
        // Font size - synced slider and number input
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

        // Name padding - synced sliders and number inputs
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
        
        // Enable/disable extra styling
        document.getElementById('avatar_banner_extra_styling').addEventListener('change', (e) => {
            const settings = getSettings();
            settings.extraStylingEnabled = e.target.checked;
            saveSettings();
            
            // Toggle disabled state for styling options
            const fontRow = document.getElementById('avatar_banner_font_row');
            const colorRow = document.getElementById('avatar_banner_color_row');
            const fontSizeRow = document.getElementById('avatar_banner_fontsize_row');
            const namePaddingRow = document.getElementById('avatar_banner_namepadding_row');
            
            if (e.target.checked) {
                fontRow.classList.remove('disabled');
                colorRow.classList.remove('disabled');
                fontSizeRow.classList.remove('disabled');
                namePaddingRow?.classList.remove('disabled');
            } else {
                fontRow.classList.add('disabled');
                colorRow.classList.add('disabled');
                fontSizeRow.classList.add('disabled');
                namePaddingRow?.classList.add('disabled');
            }
            
            applyBannersToChat();
        });
        
        // Font family input
        document.getElementById('avatar_banner_font').addEventListener('input', (e) => {
            const settings = getSettings();
            settings.fontFamily = e.target.value.trim();
            saveSettings();
            applyBannersToChat();
        });
        
        // Color picker (toolcool-color-picker)
        const colorPicker = document.getElementById('avatar_banner_color');
        if (colorPicker) {
            colorPicker.addEventListener('change', (e) => {
                const settings = getSettings();
                // toolcool-color-picker provides color in evt.detail.hex or evt.detail.rgba
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
    const style = document.createElement('style');
    style.id = 'avatar-banner-styles';
    style.textContent = `
        /* Only style messages that have banners - use class-based targeting */
        .mes.has-avatar-banner {
            position: relative;
            overflow: visible !important;
        }
        
        /* Ensure message content is above banner and doesn't clip */
        .mes.has-avatar-banner .mes_block,
        .mes.has-avatar-banner .mes_text,
        .mes.has-avatar-banner .ch_name,
        .mes.has-avatar-banner .avatar {
            position: relative;
            z-index: 2;
        }
        
        /* Prevent clipping of decorative fonts */
        .mes.has-avatar-banner .ch_name,
        .mes.has-avatar-banner .mes_block {
            overflow: visible !important;
        }
        
        /* Name text wrapping for CHARACTER messages with banners */
        /* Forces two-line layout: name on line 1, timestamp+icons on line 2 */
        .mes.has-avatar-banner .ch_name > .flex-container > .flex-container.alignItemsBaseline {
            flex-wrap: wrap !important;
        }
        .mes.has-avatar-banner .ch_name .name_text {
            flex-basis: 100% !important;
        }
        
        /* Settings panel styling */
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
        
        /* Grid row for two columns */
        .avatar-banner-grid-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        
        /* Font family row - single row layout */
        .avatar-banner-font-row {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .avatar-banner-font-row input[type="text"].text_pole {
            flex: 1;
            margin: 0;
        }
        
        /* Inline elements (label + info + control) */
        .avatar-banner-inline {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        /* Disabled state for styling options */
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
 * Initialize the extension
 */
function init() {
    getSettings();
    injectStyles();
    createSettingsPanel();
    
    eventSource.on(event_types.CHAT_CHANGED, () => {
        applyBannersToChat();
        addCharacterEditorButton();
    });
    
    eventSource.on(event_types.MESSAGE_RECEIVED, () => {
        // Small delay to ensure DOM is fully updated with correct attributes
        setTimeout(() => applyBannersToChat(), 100);
    });
    
    eventSource.on(event_types.MESSAGE_SENT, () => {
        // Small delay to ensure DOM is fully updated with correct attributes
        setTimeout(() => applyBannersToChat(), 100);
    });
    
    eventSource.on(event_types.CHARACTER_EDITED, () => {
        addCharacterEditorButton();
    });
    
    eventSource.on(event_types.SETTINGS_UPDATED, () => {
        applyBannersToChat();
    });
    
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' || mutation.type === 'attributes') {
                const characterPopup = document.getElementById('character_popup');
                if (characterPopup && characterPopup.style.display !== 'none') {
                    addCharacterEditorButton();
                }
                
                const personaDrawer = document.querySelector('#persona-management-button .drawer-content');
                if (personaDrawer && personaDrawer.classList.contains('openDrawer')) {
                    setTimeout(addPersonaPanelButton, 100);
                }
            }
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
    });
    
    setTimeout(() => {
        applyBannersToChat();
        addCharacterEditorButton();
        addPersonaPanelButton();
    }, 1000);
}

jQuery(() => {
    init();
});
