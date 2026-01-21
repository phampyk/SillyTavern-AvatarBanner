/**
 * Avatar Banner Extension - Chat Renderer
 * EXACT copy from v3.3.3 lines 756-1140
 */
import { isGroupChat, getCurrentGroup, getCharacterIdByAvatar, getCharacterIdByName, getCurrentUserAvatar, escapeCSS } from './utils.js';
import { getCharacterBanner, getUserBanner, createBannerElement } from './banner-manager.js';
import { getDynamicStyleElement, generateExtraStylingCSS } from './css-generator.js';
import { getGoogleFontImport, preloadGoogleFont } from './fonts.js';

const extensionName = 'SillyTavern-AvatarBanner';

// Module-level references (set by init function)
let getSettings;
let ExtensionState;

/**
 * Initialize chat renderer with dependencies
 */
export function initChatRenderer(getSettingsFn, extensionState) {
    getSettings = getSettingsFn;
    ExtensionState = extensionState;
}

/**
 * Update dynamic CSS rules for current chat
 */
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
        
        // Strict Layout Check for Moonlit Compatibility
        if (settings.moonlitCompatibility) {
            const chatStyle = context.powerUserSettings?.chat_display;
            // SillyTavern chat_display values: 0 = DEFAULT (Flat), 1 = BUBBLES
            const isBubbleOrFlat = chatStyle == 0 || chatStyle == 1;
            
            if (!isBubbleOrFlat) {
                console.log(`[${extensionName}]`, 'Moonlit Compatibility active: Restricting extension to bubble/flat layouts. Current style:', chatStyle);
                styleEl.textContent = '';
                return;
            }
        }
        
        let css = '';
        const paddingTop = Math.max(settings.bannerHeight - 30, 50);
        const paddingTopMobile = Math.max(Math.round(settings.bannerHeight * 0.48 - 10), 20);
        
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
        
        // Check for Moonlit Echoes (Manual Setting ONLY)
        const isMoonlit = settings.moonlitCompatibility;

        // Process each character
        for (const charInfo of charactersToProcess) {
            const banner = await getCharacterBanner(charInfo.id);
            const hasBanner = !!banner;
            
            if (hasBanner) {
                anyCharacterHasBanner = true;
                
                if (!fontImportAdded && settings.extraStylingEnabled && settings.fontFamily) {
                    // Preload font for faster/more reliable loading
                    preloadGoogleFont(settings.fontFamily, false, ExtensionState);
                    css += getGoogleFontImport(settings.fontFamily) + '\n\n';
                    fontImportAdded = true;
                }
            }
            
            // CRITICAL: Get character from context to check for chat-name extension
            const character = context.characters[charInfo.id];
            
            // For CSS selector: Use _originalName (card name) if it exists (matches DOM ch_name attribute)
            const nameForSelector = character?._originalName || character?.name || charInfo.name;
            const escapedName = escapeCSS(nameForSelector);
            
            // For display: Get chat name from extension data if available
            let displayName = character?.name || charInfo.name;
            if (character?.data?.extensions?.['chat-name']?.chatName) {
                const chatName = character.data.extensions['chat-name'].chatName.trim();
                if (chatName) {
                    displayName = chatName;
                }
            }
            
            if (hasBanner) {
                css += `/* ${displayName} - Has Banner */\n`;
                
                if (isMoonlit) {
                     // Moonlit Mode: Do NOT hide avatar if theme needs it (safest is to let theme handle it or hide if confirmed)
                     // Standard ST extension hides it. Let's start by NOT hiding it if we are injecting into mes_block
                     // effectively making banner a background header.
                     // But we DO need to adjust padding of mes_block.
                     
                     // Actually, if we inject into mes_block, we likely don't want to hide the avatar 
                     // because the avatar is outside mes_block in standard layout.
                     // The user snippet implies stylistic changes.
                     
                     /* Moonlit specific dynamic sizing */
                     css += `#chat .mes[ch_name="${escapedName}"].moonlit-banner .mes_block {\n`;
                     // Use the calculated padding top but + adjustment for Moonlit's large header feel?
                     // Snippet had 120px padding. Let's use our calculated height or settings.
                     // Snippet: padding: 120px 25px 15px !important;
                     // Our calculated variable 'paddingTop' is (height - 30).
                     // If banner is 150px, padding is 120px. Matches perfectly.
                     css += `    padding-top: ${paddingTop}px !important;\n`;
                     css += `}\n`;
                     css += `@media screen and (max-width: 768px) {\n`;
                     css += `    #chat .mes[ch_name="${escapedName}"].moonlit-banner .mes_block {\n`;
                     css += `        padding-top: ${paddingTopMobile}px !important;\n`;
                     css += `    }\n`;
                     css += `}\n`;
                } else {
                    // Standard Mode
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
                }
                
                css += `\n`;
                
                if (settings.extraStylingEnabled) {
                    // Pass nameForSelector (for CSS selector) and displayName (for text override)
                    css += generateExtraStylingCSS(nameForSelector, false, settings, displayName, isMoonlit);
                }
            } else {
                // Only restore avatar in standard mode, Moonlit might not have hidden it
                if (!isMoonlit) {
                    css += `/* ${displayName} - No Banner, Show Avatar */\n`;
                    css += `.mes[ch_name="${escapedName}"] .avatar {\n`;
                    css += `    display: flex !important;\n`;
                    css += `    visibility: visible !important;\n`;
                    css += `}\n\n`;
                }
            }
        }
        
        // User messages CSS
        // Restore: Generate CSS if either banners or extra styling is enabled
        if (anyCharacterHasBanner && (settings.enableUserBanners || settings.extraStylingEnabled)) {
            css += `/* User Messages - Banner/Styling Mode */\n`;
            
            if (isMoonlit) {
                // Moonlit User Message Styling
                if (settings.enableUserBanners) {
                     css += `#chat .mes[is_user="true"].moonlit-banner .mes_block {\n`;
                     css += `    padding-top: ${paddingTop}px !important;\n`;
                     css += `}\n`;
                     css += `@media screen and (max-width: 768px) {\n`;
                     css += `    #chat .mes[is_user="true"].moonlit-banner .mes_block {\n`;
                     css += `        padding-top: ${paddingTopMobile}px !important;\n`;
                     css += `    }\n`;
                     css += `}\n`;
                }
            } else {
                // Standard mode structural overrides - ONLY if banner is enabled
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
                        css += `    padding: ${paddingTop}px 25px 15px !important;\n`;
                        css += `}\n`;
                        css += `@media screen and (max-width: 768px) {\n`;
                        css += `    #chat .mes[is_user="true"].has-avatar-banner {\n`;
                        css += `        padding: ${paddingTopMobile}px 15px 10px !important;\n`;
                        css += `        }\n`;
                        css += `}\n`;
                    }
                }
            }
            
            // MOVED OUTSIDE: Generate font styling regardless of Moonlit or Standard mode
            if (settings.extraStylingEnabled) {
                css += generateExtraStylingCSS(null, true, settings, null, isMoonlit);
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
 * Apply banners to all visible chat messages
 */
export async function applyBannersToChat() {
    try {
        const settings = getSettings();
        const context = SillyTavern.getContext();
        
        // Strict Layout Check for Moonlit Compatibility (Banner Removal)
        if (settings.moonlitCompatibility) {
            const chatStyle = context.powerUserSettings?.chat_display;
            const isBubbleOrFlat = chatStyle == 0 || chatStyle == 1;
            
            if (!isBubbleOrFlat) {
                document.querySelectorAll('.avatar-banner').forEach(el => el.remove());
                document.querySelectorAll('.mes').forEach(mes => {
                    mes.classList.remove('has-avatar-banner');
                    mes.classList.remove('moonlit-banner');
                });
                await updateDynamicCSS();
                return;
            }
        }
        
        await updateDynamicCSS();
        
        if (!settings.enabled) {
            document.querySelectorAll('.avatar-banner').forEach(el => el.remove());
            document.querySelectorAll('.mes').forEach(mes => {
                mes.classList.remove('has-avatar-banner');
                mes.classList.remove('moonlit-banner');
            });
            return;
        }

        const messages = document.querySelectorAll('.mes');
        const inGroupChat = isGroupChat();
        
        // Build cache of character banners and info
        const bannerCache = new Map();
        const characterInfoCache = new Map(); // Store {id, displayName, originalName}
        
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
                            
                            // Get display name from chat-name extension or use character.name
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
                            
                            // Also cache by regular name if _originalName exists
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
                    
                    // Get display name from chat-name extension or use character.name
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
                // Moonlit Echoes Compatibility Check (Manual Setting ONLY)
                const isMoonlit = settings.moonlitCompatibility;
                
                const banner = createBannerElement(bannerDataUrl, settings.bannerHeight, mes, isMoonlit);
                
                if (isMoonlit) {
                    // Inject into .mes_block for Moonlit Echoes
                    const mesBlock = mes.querySelector('.mes_block');
                    if (mesBlock) {
                        mesBlock.style.position = 'relative';
                        mesBlock.insertBefore(banner, mesBlock.firstChild);
                        mes.classList.add('has-avatar-banner', 'moonlit-banner');
                        // Ensure avatar is NOT hidden for Moonlit as it might be needed for layout, 
                        // though standard extension hides it. 
                        // User snippet didn't explicitly say to hide/show avatar, but standard behavior hides it.
                        // However, standard ST hides .avatar when has-avatar-banner is present via dynamic CSS.
                        // We will check dynamic CSS logic next.
                    } else {
                        // Fallback
                        mes.style.position = 'relative';
                        mes.insertBefore(banner, mes.firstChild);
                        mes.classList.add('has-avatar-banner');
                    }
                } else {
                    // Standard Injection
                    mes.style.position = 'relative';
                    mes.insertBefore(banner, mes.firstChild);
                    mes.classList.add('has-avatar-banner');
                }
            } else {
                mes.classList.remove('has-avatar-banner', 'moonlit-banner');
            }
        });

    } catch (error) {
        console.error(`[${extensionName}]`, 'Error applying banners to chat:', error);
    }
}