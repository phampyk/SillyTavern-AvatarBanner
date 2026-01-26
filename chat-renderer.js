import { isGroupChat, getCurrentGroup, getCharacterIdByAvatar, getCharacterIdByName, getCurrentUserAvatar, isMoonlitTheme, hexToRgb, areColorsEqual } from './utils.js';
import { getCharacterBanner, getUserBanner, createBannerElement, getCharacterData, getUserData } from './banner-manager.js';
import { getGoogleFontImport, preloadGoogleFont, getDynamicStyleElement, getFontFamilyName } from './fonts.js';

const extensionName = 'SillyTavern-AvatarBanner';

let getSettings;
let ExtensionState;

export function initChatRenderer(getSettingsFn, extensionState) {
    getSettings = getSettingsFn;
    ExtensionState = extensionState;
}

// Set CSS variables on a message element for styling
function setMessageCSSVariables(messageElement, settings, customAccentColor, customQuoteColor) {
    if (!messageElement || !settings) return;
    
    const accent = customAccentColor || settings.accentColor;
    const rgb = hexToRgb(accent);
    
    const parsedFontName = getFontFamilyName(settings.fontFamily);
    const fontFamily = parsedFontName ? `"${parsedFontName}", cursive` : '"Caveat", cursive';
    
    messageElement.style.setProperty('--banner-height', `${settings.bannerHeight}vh`);
    messageElement.style.setProperty('--banner-font-size', `${settings.fontSize}rem`);
    messageElement.style.setProperty('--banner-name-padding-tb', `${settings.namePaddingTB}em`);
    messageElement.style.setProperty('--banner-name-padding-lr', `${settings.namePaddingLR}em`);
    if (rgb) {
        messageElement.style.setProperty('--banner-accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    }
    messageElement.style.setProperty('--banner-font-family', fontFamily);

    if (customQuoteColor) {
        // Override the global SmartThemeQuoteColor for this message
        messageElement.style.setProperty('--SmartThemeQuoteColor', customQuoteColor);
    } else {
        // No custom quote color - remove any previous override to inherit from theme
        messageElement.style.removeProperty('--SmartThemeQuoteColor');
    }
}

// Update panel banner (standard theme only)
async function updatePanelBanner() {
    const settings = getSettings();
    const isMoonlit = isMoonlitTheme(settings);
    
    // Remove panel banner class and variable if disabled, Moonlit, or group chat
    if (!settings.enablePanelBanner || isMoonlit || isGroupChat()) {
        document.body.classList.remove('has-panel-banner');
        document.body.style.removeProperty('--panel-banner-url');
        return;
    }
    
    const context = SillyTavern.getContext();
    const currentCharId = context.characterId;
    
    if (currentCharId === undefined) {
        document.body.classList.remove('has-panel-banner');
        document.body.style.removeProperty('--panel-banner-url');
        return;
    }
    
    const banner = await getCharacterBanner(currentCharId);
    
    if (banner) {
        const safeUrl = banner.replace(/"/g, '\\"').replace(/\n/g, '').replace(/\r/g, '');
        document.body.style.setProperty('--panel-banner-url', `url("${safeUrl}")`);
        document.body.classList.add('has-panel-banner');
    } else {
        document.body.classList.remove('has-panel-banner');
        document.body.style.removeProperty('--panel-banner-url');
    }
}

// Update panel banner (Moonlit Echoes only)
async function updatePanelBannerMoonlit() {
    const settings = getSettings();
    const isMoonlit = isMoonlitTheme(settings);
    
    // Remove panel banner class if disabled, not Moonlit, or group chat
    if (!settings.enablePanelBanner || !isMoonlit || isGroupChat()) {
        document.body.classList.remove('has-panel-banner-moonlit');
        return;
    }
    
    const context = SillyTavern.getContext();
    const currentCharId = context.characterId;
    
    if (currentCharId === undefined) {
        document.body.classList.remove('has-panel-banner-moonlit');
        return;
    }
    
    const banner = await getCharacterBanner(currentCharId);
    
    if (banner) {
        // Use same variable as standard
        const safeUrl = banner.replace(/"/g, '\\"').replace(/\n/g, '').replace(/\r/g, '');
        document.body.style.setProperty('--panel-banner-url', `url("${safeUrl}")`);
        document.body.classList.add('has-panel-banner-moonlit');
    } else {
        document.body.classList.remove('has-panel-banner-moonlit');
    }
}

export async function updateDynamicCSS() {
    try {
        const settings = getSettings();
        const styleEl = getDynamicStyleElement();
        
        if (!settings.enabled) {
            styleEl.textContent = '';
            return;
        }
        
        const context = SillyTavern.getContext();
        const isMoonlit = isMoonlitTheme(settings);
        
        if (isMoonlit) {
            const chatStyle = context.powerUserSettings?.chat_display;
            const isBubbleOrFlat = chatStyle == 0 || chatStyle == 1;
            
            if (!isBubbleOrFlat) {
                styleEl.textContent = '';
                return;
            }
        }
        
        let css = '';
        
        // Only dynamic CSS needed is for Google Font loading
        if (settings.extraStylingEnabled && settings.fontFamily) {
            preloadGoogleFont(settings.fontFamily, false, ExtensionState);
            css = getGoogleFontImport(settings.fontFamily);
        }

        styleEl.textContent = css;
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error updating dynamic CSS:', error);
    }
}

export async function applyBannersToChat() {
    try {
        const settings = getSettings();
        const context = SillyTavern.getContext();
        
        const isMoonlit = isMoonlitTheme(settings);
        
        if (isMoonlit) {
            const chatStyle = context.powerUserSettings?.chat_display;
            const isBubbleOrFlat = chatStyle == 0 || chatStyle == 1;
            
            if (!isBubbleOrFlat) {
                document.querySelectorAll('.avatar-banner').forEach(el => el.remove());
                document.querySelectorAll('.mes').forEach(mes => {
                    mes.classList.remove('has-avatar-banner', 'moonlit-banner');
                });
                await updateDynamicCSS();
                return;
            }
        }
        
        await updateDynamicCSS();
        await updatePanelBanner();
        await updatePanelBannerMoonlit();
        
        if (!settings.enabled) {
            document.querySelectorAll('.avatar-banner').forEach(el => el.remove());
            document.querySelectorAll('.mes').forEach(mes => {
                mes.classList.remove('has-avatar-banner', 'moonlit-banner');
            });
            return;
        }

        const messages = document.querySelectorAll('.mes');
        const inGroupChat = isGroupChat();
        
        // Cache now stores the full data object { banner, accentColor, quoteColor }
        const charDataCache = new Map();
        const characterInfoCache = new Map();
        
        if (inGroupChat) {
            const group = getCurrentGroup();
            if (group && group.members) {
                for (const memberAvatar of group.members) {
                    const charId = getCharacterIdByAvatar(memberAvatar);
                    if (charId !== undefined && charId >= 0) {
                        const character = context.characters[charId];
                        if (character) {
                            const data = await getCharacterData(charId);
                            const nameForLookup = character._originalName || character.name;
                            
                            let displayName = character.name;
                            if (character.data?.extensions?.['chat-name']?.chatName) {
                                const chatName = character.data.extensions['chat-name'].chatName.trim();
                                if (chatName) {
                                    displayName = chatName;
                                }
                            }
                            
                            charDataCache.set(nameForLookup, data);
                            characterInfoCache.set(nameForLookup, {
                                id: charId,
                                displayName: displayName,
                                originalName: character._originalName || character.name
                            });
                            
                            if (character._originalName) {
                                charDataCache.set(character.name, data);
                                characterInfoCache.set(character.name, {
                                    id: charId,
                                    displayName: displayName,
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
                    const data = await getCharacterData(currentCharId);
                    const nameForLookup = character._originalName || character.name;
                    
                    let displayName = character.name;
                    if (character.data?.extensions?.['chat-name']?.chatName) {
                        const chatName = character.data.extensions['chat-name'].chatName.trim();
                        if (chatName) {
                            displayName = chatName;
                        }
                    }
                    
                    charDataCache.set(nameForLookup, data);
                    characterInfoCache.set(nameForLookup, {
                        id: currentCharId,
                        displayName: displayName,
                        originalName: character._originalName || character.name
                    });
                    
                    if (character._originalName) {
                        charDataCache.set(character.name, data);
                        characterInfoCache.set(character.name, {
                            id: currentCharId,
                            displayName: displayName,
                            originalName: character._originalName
                        });
                    }
                }
            }
        }
        
        const anyCharacterHasBanner = Array.from(charDataCache.values()).some(d => !!d.banner);
        
        messages.forEach(mes => {
            const isUser = mes.getAttribute('is_user') === 'true';
            
            // 1. Determine Desired State
            let shouldHaveBanner = false;
            let bannerDataUrl = null;
            let customAccent = null;
            let customQuote = null;

            if (isUser) {
                const allowPersonaStyling = settings.enableUserBanners || settings.extraStylingEnabled;
                if (anyCharacterHasBanner && allowPersonaStyling) {
                    const forceAvatar = mes.getAttribute('force_avatar');
                    let userAvatarPath;
                    if (forceAvatar && forceAvatar.startsWith('User Avatars/')) {
                        userAvatarPath = forceAvatar.replace('User Avatars/', '');
                    } else {
                        userAvatarPath = getCurrentUserAvatar();
                    }
                    
                    if (userAvatarPath) {
                        const userData = getUserData(userAvatarPath);
                        bannerDataUrl = userData.banner || null;
                        customAccent = userData.accentColor;
                        customQuote = userData.quoteColor;
                        shouldHaveBanner = !!bannerDataUrl || settings.extraStylingEnabled;
                    }
                }
            } else {
                const charName = mes.getAttribute('ch_name');
                if (charName) {
                    let charId = -1;
                    
                    // Resolve Name -> ID
                    if (characterInfoCache.has(charName)) {
                        charId = characterInfoCache.get(charName).id;
                    } else {
                         charId = getCharacterIdByName(charName);
                         if (charId !== undefined && charId >= 0) {
                             const character = context.characters[charId];
                             characterInfoCache.set(charName, {
                                 id: charId,
                                 displayName: character.name,
                                 originalName: character._originalName || character.name
                             });
                         }
                    }

                    // Get FRESH data if we have an ID
                    let data = {};
                    if (charId !== undefined && charId >= 0 && context.characters && context.characters[charId]) {
                        data = context.characters[charId].data?.extensions?.[extensionName] || {};
                    }

                    if (data) {
                        bannerDataUrl = data.banner || null;
                        customAccent = data.accentColor;
                        customQuote = data.quoteColor;
                        shouldHaveBanner = !!bannerDataUrl;
                    }
                    
                    // Handle Name Swapping (Lightweight text check)
                    if (shouldHaveBanner && settings.useDisplayName && settings.extraStylingEnabled) {
                        const charInfo = characterInfoCache.get(charName);
                        if (charInfo && charInfo.displayName && charInfo.originalName !== charInfo.displayName) {
                             const nameTextEl = mes.querySelector('.name_text');
                             if (nameTextEl && nameTextEl.textContent.trim() === charInfo.originalName) {
                                 nameTextEl.textContent = charInfo.displayName;
                             }
                        }
                    } else {
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

            // 2. CSS Variables Update (Cheap, can be done always or diffed)
            // We only apply if we have a banner OR extra styling is enabled
            if (shouldHaveBanner) {
                 // Optimization: Check if vars are already set to avoid style Recalculation if possible? 
                 // For now, setting property is relatively cheap compared to DOM insertion
                 setMessageCSSVariables(mes, settings, customAccent, customQuote);
            }

            // 3. Banner DOM Diffing
            const existingBanner = mes.querySelector('.avatar-banner');
            const isMoonlit = isMoonlitTheme(settings);

            // CASE A: We WANT a banner (and it has an image URL)
            if (bannerDataUrl && (!isUser || settings.enableUserBanners)) {
                // Check if we need to update classes
                if (!mes.classList.contains('has-avatar-banner')) mes.classList.add('has-avatar-banner');
                if (isMoonlit && !mes.classList.contains('moonlit-banner')) mes.classList.add('moonlit-banner');
                if (!isMoonlit && mes.classList.contains('moonlit-banner')) mes.classList.remove('moonlit-banner');

                // Check existing banner
                if (existingBanner) {
                    // banner exists, check if image is correct
                    // We check the background-image style. Note: style.backgroundImage returns 'url("...")'
                    // So we do a loose check or just simple string includes if strict equality fails
                    const currentBg = existingBanner.style.backgroundImage;
                    const expectedBg = `url("${bannerDataUrl}")`;
                    
                    // If the background image is DIFFERENT, update it.
                    // This prevents reloading the image if it's already there.
                    // (Using includes because browser might normalize quotes)
                    if (!currentBg.includes(bannerDataUrl)) { 
                        existingBanner.style.backgroundImage = expectedBg;
                    }
                    // If it matches, DO NOTHING. Performance saved!
                } else {
                    // Banner missing, create it
                    const banner = createBannerElement(bannerDataUrl, isMoonlit);
                    const mesBlock = mes.querySelector('.mes_block');
                    const targetParent = (isMoonlit && mesBlock) ? mesBlock : mes;
                    // Optimization: Insert at beginning
                    targetParent.insertBefore(banner, targetParent.firstChild);
                    
                    // Set position relative if needed (check style first to avoid thrashing)
                    if (targetParent.style.position !== 'relative') {
                        targetParent.style.position = 'relative';
                    }
                }
            } 
            // CASE B: We do NOT want an image banner, but maybe styling
            else {
                // Remove banner if it exists
                if (existingBanner) {
                    existingBanner.remove();
                }
                
                // Handle styling classes
                const persistStyling = isUser && settings.extraStylingEnabled;
                if (persistStyling) {
                   if (!mes.classList.contains('has-avatar-banner')) mes.classList.add('has-avatar-banner');
                   if (isMoonlit && !mes.classList.contains('moonlit-banner')) mes.classList.add('moonlit-banner');
                } else {
                   if (mes.classList.contains('has-avatar-banner')) mes.classList.remove('has-avatar-banner');
                   if (mes.classList.contains('moonlit-banner')) mes.classList.remove('moonlit-banner');
                }
            }
        });

    } catch (error) {
        console.error(`[${extensionName}]`, 'Error applying banners to chat:', error);
    }
}