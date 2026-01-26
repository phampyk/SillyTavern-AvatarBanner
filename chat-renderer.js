import { isGroupChat, getCurrentGroup, getCharacterIdByAvatar, getCharacterIdByName, getCurrentUserAvatar, isMoonlitTheme, hexToRgb } from './utils.js';
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
            const existingBanner = mes.querySelector('.avatar-banner');
            if (existingBanner) {
                existingBanner.remove();
            }
            
            const isUser = mes.getAttribute('is_user') === 'true';
            
            if (isUser) {
                const allowPersonaStyling = settings.enableUserBanners || settings.extraStylingEnabled;
                if (!anyCharacterHasBanner || !allowPersonaStyling) {
                    mes.classList.remove('has-avatar-banner', 'moonlit-banner');
                    return;
                }
            }
            
            let bannerDataUrl = null;
            let customAccent = null;
            let customQuote = null;
            
            if (isUser) {
                const forceAvatar = mes.getAttribute('force_avatar');
                let userAvatarPath;
                if (forceAvatar && forceAvatar.startsWith('User Avatars/')) {
                    userAvatarPath = forceAvatar.replace('User Avatars/', '');
                } else {
                    userAvatarPath = getCurrentUserAvatar();
                }
                
                if (userAvatarPath) {
                    // getUserData returns object { banner, accentColor, quoteColor, ... }
                    const userData = getUserData(userAvatarPath);
                    bannerDataUrl = userData.banner;
                    customAccent = userData.accentColor;
                    customQuote = userData.quoteColor;
                }
            } else {
                const charName = mes.getAttribute('ch_name');
                if (charName) {
                    if (charDataCache.has(charName)) {
                        const data = charDataCache.get(charName);
                        bannerDataUrl = data.banner;
                        customAccent = data.accentColor;
                        customQuote = data.quoteColor;
                    } else {
                        // Fallback logic for characters not in cache ? (maybe new ones)
                        const charId = getCharacterIdByName(charName);
                        if (charId !== undefined && charId >= 0) {
                            const character = context.characters[charId];
                            const data = character?.data?.extensions?.[extensionName] || {};
                            bannerDataUrl = data.banner || null;
                            customAccent = data.accentColor;
                            customQuote = data.quoteColor;

                            charDataCache.set(charName, data);
                            
                            if (!characterInfoCache.has(charName)) {
                                characterInfoCache.set(charName, {
                                    id: charId,
                                    displayName: character.name,
                                    originalName: character._originalName || character.name
                                });
                            }
                        }
                    }
                    
                    if (settings.useDisplayName && settings.extraStylingEnabled && bannerDataUrl) {
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
            
            // Set CSS variables on the message element - always set when banner exists
            if (bannerDataUrl || settings.extraStylingEnabled) {
                setMessageCSSVariables(mes, settings, customAccent, customQuote);
            }
            
            if (bannerDataUrl && (!isUser || settings.enableUserBanners)) {
                const isMoonlit = isMoonlitTheme(settings);
                const banner = createBannerElement(bannerDataUrl, isMoonlit);
                
                if (isMoonlit) {
                    const mesBlock = mes.querySelector('.mes_block');
                    if (mesBlock) {
                        mesBlock.style.position = 'relative';
                        mesBlock.insertBefore(banner, mesBlock.firstChild);
                        mes.classList.add('has-avatar-banner', 'moonlit-banner');
                    } else {
                        mes.style.position = 'relative';
                        mes.insertBefore(banner, mes.firstChild);
                        mes.classList.add('has-avatar-banner');
                    }
                } else {
                    mes.style.position = 'relative';
                    mes.insertBefore(banner, mes.firstChild);
                    mes.classList.add('has-avatar-banner');
                }
            } else {
                const isMoonlit = isMoonlitTheme(settings);
                const persistStyling = isUser && settings.extraStylingEnabled;
                
                if (persistStyling) {
                    mes.classList.add('has-avatar-banner');
                    if (isMoonlit) {
                        mes.classList.add('moonlit-banner');
                    }
                } else {
                    mes.classList.remove('has-avatar-banner', 'moonlit-banner');
                }
            }
        });

    } catch (error) {
        console.error(`[${extensionName}]`, 'Error applying banners to chat:', error);
    }
}