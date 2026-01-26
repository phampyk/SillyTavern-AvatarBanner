/**
 * Avatar Banner Extension - UI Buttons
 */
import { getCurrentCharacterAvatar, getPersonaImageUrlFullRes } from './utils.js';
import { getCharacterBanner, saveCharacterBanner, removeCharacterBanner, getUserBanner, saveUserBanner, removeUserBanner } from './banner-manager.js';
import { power_user } from '../../../power-user.js';
import { user_avatar } from '../../../personas.js';

const extensionName = 'SillyTavern-AvatarBanner';

let applyBannersToChat = null;
let ExtensionState = null;

export function initUIButtons(applyBannersFn, extensionState) {
    applyBannersToChat = applyBannersFn;
    ExtensionState = extensionState;
}

async function showBannerOptionsPopup(displayName, onEdit, onDelete) {
    const context = SillyTavern.getContext();
    const { Popup, POPUP_TYPE } = context;
    
    if (!Popup || !POPUP_TYPE) {
        onEdit();
        return;
    }
    
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
    
    if (result === true || result === 1) {
        onEdit();
    } else if (result === false || result === 0) {
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

    let avatarUrl = isUser ? getPersonaImageUrlFullRes(avatarPath) : `/characters/${avatarPath}`;

    try {
        const response = await fetch(avatarUrl);
        if (!response.ok) throw new Error(`Failed to load avatar: ${response.status}`);
        
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
        popup.dlg.classList.add('avatar-banner-popup');

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

async function handleBannerButtonClick(avatarPath, displayName, isUser, characterId = null) {
    try {
        let existingBanner = isUser ? getUserBanner(avatarPath) : await getCharacterBanner(characterId);
        
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
    }
}

export function addCharacterEditorButton() {
    if (!ExtensionState || !ExtensionState.initialized) return;

    if (!ExtensionState.charClickHandlerBound) {
        const handler = async function(e) {
            e.preventDefault();
            e.stopPropagation();
            const context = SillyTavern.getContext();
            const characterId = context.characterId;
            const avatarPath = getCurrentCharacterAvatar();
            const charName = context.characters?.[characterId]?.name || 'Character';
            
            if (avatarPath && characterId !== undefined) {
                await handleBannerButtonClick(avatarPath, charName, false, characterId);
            }
        };
        
        jQuery(document).on('click', '#avatar_banner_button', handler);
        ExtensionState.charClickHandlerBound = true;
        ExtensionState.cleanupFunctions.push(() => {
            jQuery(document).off('click', '#avatar_banner_button', handler);
            ExtensionState.charClickHandlerBound = false;
        });
    }

    if (document.getElementById('avatar_banner_button')) return;

    const buttonsBlock = document.querySelector('#avatar_controls .form_create_bottom_buttons_block');
    if (!buttonsBlock) return;

    const button = document.createElement('div');
    button.id = 'avatar_banner_button';
    button.className = 'menu_button fa-solid fa-panorama interactable';
    button.title = 'Configure Avatar Banner';
    
    const deleteButton = buttonsBlock.querySelector('#delete_button');
    if (deleteButton) {
        buttonsBlock.insertBefore(button, deleteButton);
    } else {
        buttonsBlock.appendChild(button);
    }
}

export function addPersonaPanelButton() {
    if (!ExtensionState || !ExtensionState.initialized) return;

    if (!ExtensionState.personaClickHandlerBound) {
        const handler = async function(e) {
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
        ExtensionState.cleanupFunctions.push(() => {
            jQuery(document).off('click', '#persona_banner_button', handler);
            ExtensionState.personaClickHandlerBound = false;
        });
    }

    if (document.getElementById('persona_banner_button')) return;

    const buttonsBlock = document.querySelector('#persona_controls .persona_controls_buttons_block');
    if (!buttonsBlock) return;

    const button = document.createElement('div');
    button.id = 'persona_banner_button';
    button.className = 'menu_button fa-solid fa-panorama interactable';
    button.title = 'Configure Persona Banner';
    
    const deleteButton = buttonsBlock.querySelector('#persona_delete_button');
    if (deleteButton) {
        buttonsBlock.insertBefore(button, deleteButton);
    } else {
        buttonsBlock.appendChild(button);
    }
}