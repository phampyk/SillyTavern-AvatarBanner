/**
 * Avatar Banner Extension - UI Buttons
 * EXACT copy from v3.3.3 lines 245-410, 1142-1262
 */

import { getCurrentCharacterAvatar, getPersonaImageUrlFullRes } from './utils.js';
import { getCharacterBanner, getUserBanner, saveCharacterBanner, saveUserBanner, removeCharacterBanner, removeUserBanner } from './banner-manager.js';
import { power_user } from '../../../power-user.js';
import { user_avatar } from '../../../personas.js';

const extensionName = 'SillyTavern-AvatarBanner';

// Module-level references (set by init function)
let applyBannersToChat = null;
let ExtensionState = null;

/**
 * Initialize ui-buttons module with dependencies
 */
export function initUIButtons(applyBannersFn, extensionState) {
    applyBannersToChat = applyBannersFn;
    ExtensionState = extensionState;
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
    
    // result is true for OK (Edit), false/0 for Cancel (Remove)
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
        console.log(`[${extensionName}]`, 'Loading avatar from:', avatarUrl);
        
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
 * Add button to character editor panel (with proper cleanup tracking)
 */
export function addCharacterEditorButton() {
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

    let buttonsBlock = document.querySelector('#avatar_controls .form_create_bottom_buttons_block');
    if (!buttonsBlock) {
        return;
    }
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
export function addPersonaPanelButton() {
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