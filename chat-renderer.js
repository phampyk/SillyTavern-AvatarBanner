/**
 * Avatar Banner Extension - Chat Renderer
 */
import { isGroupChat, getCurrentGroup, getCharacterIdByAvatar, getCharacterIdByName, getCurrentUserAvatar, escapeCSS, isMoonlitTheme, escapeHtml } from './utils.js';
import { getCharacterBanner, getUserBanner, createBannerElement } from './banner-manager.js';
import { getDynamicStyleElement, generateExtraStylingCSS } from './css-generator.js';
import { getGoogleFontImport, preloadGoogleFont } from './fonts.js';

const extensionName = 'SillyTavern-AvatarBanner';

let getSettings;
let ExtensionState;

export function initChatRenderer(getSettingsFn, extensionState) {
    getSettings = getSettingsFn;
    ExtensionState = extensionState;
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
        const inGroupChat = isGroupChat();
        
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
        const paddingTop = Math.max(settings.bannerHeight - 30, 50);
        const paddingTopMobile = Math.max(Math.round(settings.bannerHeight * 0.48 - 10), 20);
        const paddingBottom = 15;
        const paddingBottomMobile = 10;
        
        let anyCharacterHasBanner = false;
        let charactersToProcess = [];
        
        if (inGroupChat) {
            const group = getCurrentGroup();
            if (group && group.members) {
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
                    charactersToProcess.push({
                        id: currentCharId,
                        name: character.name,
                        avatar: character.avatar
                    });
                }
            }
        }
        
        let fontImportAdded = false;
        // isMoonlit is already declared above

        for (const charInfo of charactersToProcess) {
            const banner = await getCharacterBanner(charInfo.id);
            const hasBanner = !!banner;
            
            if (hasBanner) {
                anyCharacterHasBanner = true;
                
                if (!fontImportAdded && settings.extraStylingEnabled && settings.fontFamily) {
                    preloadGoogleFont(settings.fontFamily, false, ExtensionState);
                    css += getGoogleFontImport(settings.fontFamily) + '\n\n';
                    fontImportAdded = true;
                }
            }
            
            const character = context.characters[charInfo.id];
            const nameForSelector = character?._originalName || character?.name || charInfo.name;
            const escapedName = escapeCSS(nameForSelector);
            
            let displayName = character?.name || charInfo.name;
            if (character?.data?.extensions?.['chat-name']?.chatName) {
                const chatName = character.data.extensions['chat-name'].chatName.trim();
                if (chatName) {
                    displayName = chatName;
                }
            }
            
            if (isMoonlit) {
                if (hasBanner) {
                    css += `#chat .mes[ch_name="${escapedName}"].moonlit-banner .mes_block {\n`;
                    css += `    padding-top: ${paddingTop}px !important;\n`;
                    css += `}\n`;
                    css += `@media screen and (max-width: 768px) {\n`;
                    css += `    #chat .mes[ch_name="${escapedName}"].moonlit-banner .mes_block {\n`;
                    css += `        padding-top: ${paddingTopMobile}px !important;\n`;
                    css += `    }\n`;
                    css += `}\n`;
                    
                    if (settings.extraStylingEnabled) {
                        css += generateExtraStylingCSS(nameForSelector, false, settings, displayName, isMoonlit);
                    }
                }
            } else {
                if (hasBanner || settings.extraStylingEnabled) {
                    if (hasBanner) {
                        css += `.mes[ch_name="${escapedName}"] .avatar {\n`;
                        css += `    display: none !important;\n`;
                        css += `}\n`;
                        
                        if (!settings.extraStylingEnabled) {
                            css += `#chat .mes[ch_name="${escapedName}"] {\n`;
                            css += `    padding: ${paddingTop}px 25px ${paddingBottom}px !important;\n`;
                            css += `}\n`;
                            css += `@media screen and (max-width: 768px) {\n`;
                            css += `    #chat .mes[ch_name="${escapedName}"] {\n`;
                            css += `        padding: ${paddingTopMobile}px 15px ${paddingBottomMobile}px !important;\n`;
                            css += `    }\n`;
                            css += `}\n`;
                        }
                    }

                    if (settings.extraStylingEnabled) {
                        css += generateExtraStylingCSS(nameForSelector, false, settings, displayName, isMoonlit);
                    }
                } else {
                    css += `.mes[ch_name="${escapedName}"] .avatar {\n`;
                    css += `    display: flex !important;\n`;
                    css += `    visibility: visible !important;\n`;
                    css += `}\n\n`;
                }
            }
        }
        
        if (anyCharacterHasBanner && (settings.enableUserBanners || settings.extraStylingEnabled)) {
            if (isMoonlit) {
                if (settings.enableUserBanners) {
                     css += `html body #chat .mes[is_user="true"].moonlit-banner .mes_block,\n`;
                     css += `#chat .mes[is_user="true"].moonlit-banner .mes_block {\n`;
                     css += `    padding-top: ${paddingTop}px !important;\n`;
                     css += `}\n`;
                     css += `@media screen and (max-width: 768px) {\n`;
                     css += `    html body #chat .mes[is_user="true"].moonlit-banner .mes_block,\n`;
                     css += `    #chat .mes[is_user="true"].moonlit-banner .mes_block {\n`;
                     css += `        padding-top: ${paddingTopMobile}px !important;\n`;
                     css += `    }\n`;
                     css += `}\n`;
                }
                
                if (settings.extraStylingEnabled) {
                    css += generateExtraStylingCSS(null, true, settings, null, isMoonlit);
                }
            } else {
                if (settings.enableUserBanners) {
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
                        css += `    padding: ${paddingTop}px 25px ${paddingBottom}px !important;\n`;
                        css += `}\n`;
                        css += `@media screen and (max-width: 768px) {\n`;
                        css += `    #chat .mes[is_user="true"].has-avatar-banner {\n`;
                        css += `        padding: ${paddingTopMobile}px 15px ${paddingBottomMobile}px !important;\n`;
                        css += `    }\n`;
                        css += `}\n`;
                    }
                }
                
                if (settings.extraStylingEnabled) {
                    css += generateExtraStylingCSS(null, true, settings, null, isMoonlit);
                }
            }
            css += `\n`;
        }
        
        const mobileHeight = Math.round(settings.bannerHeight * 0.65);
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
        
        if (!settings.enabled) {
            document.querySelectorAll('.avatar-banner').forEach(el => el.remove());
            document.querySelectorAll('.mes').forEach(mes => {
                mes.classList.remove('has-avatar-banner', 'moonlit-banner');
            });
            return;
        }

        const messages = document.querySelectorAll('.mes');
        const inGroupChat = isGroupChat();
        
        const bannerCache = new Map();
        const characterInfoCache = new Map();
        
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
                            
                            let displayName = character.name;
                            if (character.data?.extensions?.['chat-name']?.chatName) {
                                const chatName = character.data.extensions['chat-name'].chatName.trim();
                                if (chatName) {
                                    displayName = chatName;
                                }
                            }
                            
                            bannerCache.set(nameForLookup, banner);
                            characterInfoCache.set(nameForLookup, {
                                id: charId,
                                displayName: displayName,
                                originalName: character._originalName || character.name
                            });
                            
                            if (character._originalName) {
                                bannerCache.set(character.name, banner);
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
                    const banner = await getCharacterBanner(currentCharId);
                    const nameForLookup = character._originalName || character.name;
                    
                    let displayName = character.name;
                    if (character.data?.extensions?.['chat-name']?.chatName) {
                        const chatName = character.data.extensions['chat-name'].chatName.trim();
                        if (chatName) {
                            displayName = chatName;
                        }
                    }
                    
                    bannerCache.set(nameForLookup, banner);
                    characterInfoCache.set(nameForLookup, {
                        id: currentCharId,
                        displayName: displayName,
                        originalName: character._originalName || character.name
                    });
                    
                    if (character._originalName) {
                        bannerCache.set(character.name, banner);
                        characterInfoCache.set(character.name, {
                            id: currentCharId,
                            displayName: displayName,
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
                const allowPersonaStyling = settings.enableUserBanners || settings.extraStylingEnabled;
                if (!anyCharacterHasBanner || !allowPersonaStyling) {
                    mes.classList.remove('has-avatar-banner', 'moonlit-banner');
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
            
            if (bannerDataUrl && (!isUser || settings.enableUserBanners)) {
                const isMoonlit = isMoonlitTheme(settings);
                const banner = createBannerElement(bannerDataUrl, settings.bannerHeight, mes, isMoonlit);
                
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
                const persistStyling = isUser && isMoonlit && settings.extraStylingEnabled;
                
                if (persistStyling) {
                    mes.classList.add('has-avatar-banner', 'moonlit-banner');
                } else {
                    mes.classList.remove('has-avatar-banner', 'moonlit-banner');
                }
            }
        });

    } catch (error) {
        console.error(`[${extensionName}]`, 'Error applying banners to chat:', error);
    }
}