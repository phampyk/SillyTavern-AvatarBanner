/**
 * CSS Generator for Avatar Banner Extension
 * 
 * Reads template blocks from style.css, substitutes placeholders
 * with user settings, and injects the final CSS into the document.
 */

import { isGroupChat, getCurrentGroup, getCharacterIdByAvatar, getCurrentUserAvatar, isMoonlitTheme, hexToRgb, isValidImageDataUrl } from './utils.js';
import { getCharacterData, getUserData } from './banner-manager.js';
import { getGoogleFontImport, preloadGoogleFont, getFontFamilyName } from './fonts.js';

const extensionName = 'SillyTavern-AvatarBanner';
const STYLE_ID = 'avatar-banner-dynamic';
const EXTENSION_PATH = '/scripts/extensions/third-party/SillyTavern-AvatarBanner';

let getSettings;
let ExtensionState;
let templates = null;
let debounceTimer = null;

/**
 * Initialize the CSS generator
 */
export function initCSSGenerator(getSettingsFn, extensionState) {
    getSettings = getSettingsFn;
    ExtensionState = extensionState;
}

/**
 * Load and parse templates from style.css
 * Called once on init, cached for subsequent uses
 */
async function loadTemplates() {
    if (templates) return templates;

    try {
        const response = await fetch(`${EXTENSION_PATH}/templates.txt`);
        const cssText = await response.text();

        templates = {};
        const regex = /\/\* @TEMPLATE: (\w+) \*\/([\s\S]*?)\/\* @END: \1 \*\//g;
        let match;

        while ((match = regex.exec(cssText)) !== null) {
            templates[match[1]] = match[2].trim();
        }

        console.log(`[${extensionName}] Loaded templates:`, Object.keys(templates));
        return templates;

    } catch (error) {
        console.error(`[${extensionName}] Failed to load templates:`, error);
        return {};
    }
}

/**
 * Process a template with given values
 * @param {string} templateName - Name of template (STANDARD, MOONLIT, etc.)
 * @param {object} values - Placeholder values to substitute
 * @param {object} options - Options like { includeBanner: true/false }
 * @returns {string} Processed CSS
 */
function processTemplate(templateName, values, options = {}) {
    let css = templates[templateName];
    if (!css) {
        console.warn(`[${extensionName}] Template not found: ${templateName}`);
        return '';
    }

    // If no banner, strip the banner block and padding
    if (!options.includeBanner) {
        // Remove everything between @BANNER_START and @BANNER_END
        css = css.replace(/\/\* @BANNER_START \*\/[\s\S]*?\/\* @BANNER_END \*\//g, '');
        // Remove padding lines
        css = css.replace(/\/\* @PADDING_START \*\/[\s\S]*?\/\* @PADDING_END \*\//g, '');
    }

    // Substitute all placeholders
    for (const [key, value] of Object.entries(values)) {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        css = css.replace(placeholder, value);
    }

    return css;
}

/**
 * Get accent color RGB values
 * Falls back to global setting if per-entity color not set
 */
function getAccentRGB(entityAccentColor, settings) {
    const color = entityAccentColor || settings.accentColor || '#e79fa8';
    const rgb = hexToRgb(color);
    return rgb || { r: 231, g: 159, b: 168 };
}

/**
 * Get quote color
 * Falls back to theme default if not set
 */
function getQuoteColor(entityQuoteColor) {
    if (entityQuoteColor) return entityQuoteColor;
    // Get from theme
    return getComputedStyle(document.documentElement)
        .getPropertyValue('--SmartThemeQuoteColor').trim() || '#e79fa8';
}

/**
 * Build common placeholder values from settings
 */
function buildBaseValues(settings, accentRGB, quoteColor, isUser = false) {
    const fontFamily = getFontFamilyName(settings.fontFamily);
    
    return {
        bannerHeight: `${settings.bannerHeight}vh`,
        fontSize: `${settings.fontSize}rem`,
        fontFamily: fontFamily ? `"${fontFamily}", cursive` : '"Caveat", cursive',
        namePaddingTB: `${settings.namePaddingTB}em`,
        namePaddingLR: `${settings.namePaddingLR}em`,
        accentR: accentRGB.r,
        accentG: accentRGB.g,
        accentB: accentRGB.b,
        quoteColor: quoteColor,
        blurTintColor: isUser ? 'var(--SmartThemeUserMesBlurTintColor)' : 'var(--SmartThemeBotMesBlurTintColor)'
    };
}

/**
 * Main function: Generate and inject CSS
 * Debounced to prevent rapid re-renders (150ms to let Moonlit settle)
 */
export function regenerateCSS() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        debounceTimer = null;
        _generateCSSInternal();
    }, 150);
}

/**
 * Force immediate CSS generation (for init/chat change)
 * Still debounced but with shorter delay to batch rapid events
 */
export function regenerateCSSImmediate() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        debounceTimer = null;
        _generateCSSInternal();
    }, 50);
}

/**
 * Internal CSS generation logic
 */
async function _generateCSSInternal() {
    try {
        const settings = getSettings();
        
        // Master toggle off = clear everything
        if (!settings.enabled) {
            cleanupCSS();
            return;
        }

        // Load templates if not cached
        await loadTemplates();
        if (!templates || Object.keys(templates).length === 0) {
            console.error(`[${extensionName}] No templates loaded`);
            return;
        }

        const context = SillyTavern.getContext();
        const isMoonlit = isMoonlitTheme(settings);
        const templateName = isMoonlit ? 'MOONLIT' : 'STANDARD';
        
        let cssOutput = '/* Avatar Banner - Generated CSS */\n\n';

        // Add font import if custom font set
        if (settings.fontFamily) {
            const fontImport = getGoogleFontImport(settings.fontFamily);
            if (fontImport) {
                cssOutput += fontImport + '\n\n';
                preloadGoogleFont(settings.fontFamily, false, ExtensionState);
            }
        }

        // Track if ANY character has a banner (for user styling logic)
        let anyCharacterHasBanner = false;

        // Collect characters to process
        const charactersToProcess = new Set();
        
        if (isGroupChat()) {
            const group = getCurrentGroup();
            if (group?.members) {
                group.members.forEach(m => {
                    const id = getCharacterIdByAvatar(m);
                    if (id !== undefined && id >= 0) {
                        charactersToProcess.add(id);
                    }
                });
            }
        } else if (context.characterId !== undefined) {
            charactersToProcess.add(context.characterId);
        }

        // Process each character
        for (const charId of charactersToProcess) {
            const character = context.characters[charId];
            if (!character) continue;

            const data = await getCharacterData(charId);
            
            // Skip characters without banners or with invalid banner data
            if (!data.banner || !isValidImageDataUrl(data.banner)) continue;

            anyCharacterHasBanner = true;

            const name = character.name;
            const escapedName = CSS.escape(name);
            const selector = `.mes[ch_name="${escapedName}"]`;

            const accentRGB = getAccentRGB(data.accentColor, settings);
            const quoteColor = getQuoteColor(data.quoteColor);

            const values = {
                ...buildBaseValues(settings, accentRGB, quoteColor, false),
                selector: selector,
                bannerUrl: data.banner.replace(/"/g, '\\"').replace(/[\n\r]/g, '')
            };

            cssOutput += `/* Character: ${name} */\n`;
            cssOutput += processTemplate(templateName, values, { includeBanner: true });
            cssOutput += '\n\n';

            // Handle _originalName for chat-name extension compatibility
            const originalName = character._originalName;
            if (originalName && originalName !== name) {
                const escapedOriginal = CSS.escape(originalName);
                const originalSelector = `.mes[ch_name="${escapedOriginal}"]`;
                
                const originalValues = { ...values, selector: originalSelector };
                
                cssOutput += `/* Character (original name): ${originalName} */\n`;
                cssOutput += processTemplate(templateName, originalValues, { includeBanner: true });
                cssOutput += '\n\n';
            }
        }

        // Process user/persona
        const userAvatar = getCurrentUserAvatar();
        if (userAvatar) {
            const userData = getUserData(userAvatar);
            const userSelector = '.mes[is_user="true"]';
            
            // Validate user banner if present
            const hasValidUserBanner = userData.banner && isValidImageDataUrl(userData.banner);
            
            // Determine if user should get styling
            let includeUserStyling = false;
            let includeUserBanner = false;

            if (settings.enableUserBanners && hasValidUserBanner) {
                // User banners enabled AND user has a valid banner = full styling
                includeUserStyling = true;
                includeUserBanner = true;
            } else if (!settings.enableUserBanners && anyCharacterHasBanner) {
                // User banners disabled BUT character has banner = styling only, no banner
                includeUserStyling = true;
                includeUserBanner = false;
            }

            if (includeUserStyling) {
                const accentRGB = getAccentRGB(userData.accentColor, settings);
                const quoteColor = getQuoteColor(userData.quoteColor);

                const values = {
                    ...buildBaseValues(settings, accentRGB, quoteColor, true),
                    selector: userSelector,
                    bannerUrl: includeUserBanner ? userData.banner.replace(/"/g, '\\"').replace(/[\n\r]/g, '') : ''
                };

                cssOutput += `/* User/Persona */\n`;
                cssOutput += processTemplate(templateName, values, { includeBanner: includeUserBanner });
                cssOutput += '\n\n';
            }
        }

        // Panel banner (single chat only, not groups)
        if (settings.enablePanelBanner && !isGroupChat() && context.characterId !== undefined) {
            const charData = await getCharacterData(context.characterId);
            
            // Validate panel banner
            if (charData.banner && isValidImageDataUrl(charData.banner)) {
                const panelTemplateName = isMoonlit ? 'PANEL_MOONLIT' : 'PANEL_STANDARD';
                const panelValues = {
                    bannerUrl: charData.banner.replace(/"/g, '\\"').replace(/[\n\r]/g, '')
                };

                cssOutput += `/* Panel Banner */\n`;
                cssOutput += processTemplate(panelTemplateName, panelValues, { includeBanner: true });
                cssOutput += '\n\n';

                // Add body class for panel banner CSS
                if (isMoonlit) {
                    document.body.classList.add('has-panel-banner-moonlit');
                    document.body.classList.remove('has-panel-banner');
                } else {
                    document.body.classList.add('has-panel-banner');
                    document.body.classList.remove('has-panel-banner-moonlit');
                }
            } else {
                document.body.classList.remove('has-panel-banner', 'has-panel-banner-moonlit');
            }
        } else {
            document.body.classList.remove('has-panel-banner', 'has-panel-banner-moonlit');
        }

        // Inject the CSS via style element
        // (Blob URLs cause cross-origin issues with ST's dynamic-styles.js)
        let styleEl = document.getElementById(STYLE_ID);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = STYLE_ID;
            styleEl.setAttribute('data-source', 'SillyTavern-AvatarBanner');
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = cssOutput;

    } catch (error) {
        console.error(`[${extensionName}] CSS generation error:`, error);
    }
}

/**
 * Cleanup function - removes generated styles
 */
export function cleanupCSS() {
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) {
        styleEl.remove();
    }
    
    document.body.classList.remove('has-panel-banner', 'has-panel-banner-moonlit');
    
    templates = null;
}

// Alias for backwards compatibility with existing code
export const applyBannersToChat = regenerateCSS;
export const updateDynamicCSS = regenerateCSS;
