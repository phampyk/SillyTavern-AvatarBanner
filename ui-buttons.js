import { getCurrentCharacterAvatar, getPersonaImageUrlFullRes, escapeHtml, areColorsEqual } from './utils.js';
import { getCharacterBanner, saveCharacterBanner, removeCharacterBanner, deleteCharacterCustomImage, getUserBanner, saveUserBanner, removeUserBanner, deleteUserCustomImage, getCharacterData, getUserData, saveCharacterColors, saveUserColors } from './banner-manager.js';
import { power_user } from '../../../power-user.js';
import { user_avatar } from '../../../personas.js';

const extensionName = 'SillyTavern-AvatarBanner';

let applyBannersToChat = null;
let ExtensionState = null;
let getSettings = null;

export function initUIButtons(applyBannersFn, extensionState, getSettingsFn, eventSourceParam, eventTypesParam) {
    applyBannersToChat = applyBannersFn;
    ExtensionState = extensionState;
    getSettings = getSettingsFn;
}

// Reload character pickers with fresh defaults
export async function reloadCharacterPickers() {
    const container = document.getElementById('avatar_banner_controls');
    if (!container) return; // Panel not open
    
    const context = SillyTavern.getContext();
    const characterId = context.characterId;
    if (characterId === undefined) return;
    
    // Get current data
    const data = await getCharacterData(characterId);
    const settings = getSettings();
    const defaultAccent = settings.accentColor;
    const defaultQuote = getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeQuoteColor').trim();
    
    // Find and remove old picker rows
    const oldPicker1 = document.getElementById('character_banner_custom_accent');
    const oldPicker2 = document.getElementById('character_banner_custom_quote');
    oldPicker1?.closest('.flex-container')?.remove();
    oldPicker2?.closest('.flex-container')?.remove();
    
    // Create save handler
    const saveColors = async () => {
        const cid = SillyTavern.getContext().characterId;
        if (cid === undefined) return;
        
        const p1 = document.getElementById('character_banner_custom_accent');
        const p2 = document.getElementById('character_banner_custom_quote');
        if (p1 && p2) {
            // Strict check: if it matches global default, FORCE inheritance (null)
            const settings = getSettings();
            const currentGlobalAccent = settings.accentColor || '#e79fa8';
            const currentGlobalQuote = getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeQuoteColor').trim();
            
            let accentVal = p1.hex;
            if (p1.parentNode.dataset.isDefault === 'true' || (accentVal && areColorsEqual(accentVal, currentGlobalAccent))) {
               accentVal = null;
            }
            
            let quoteVal = p2.hex;
            if (p2.parentNode.dataset.isDefault === 'true' || (quoteVal && areColorsEqual(quoteVal, currentGlobalQuote))) {
                quoteVal = null;
            }
            
            await saveCharacterColors(cid, accentVal, quoteVal);
            applyBannersToChat();
        }
    };
    
    // Create new picker rows with updated defaults
    const { row: row1 } = createPickerRow('character_banner_custom_accent', 'Accent color', data.accentColor, defaultAccent, saveColors);
    const { row: row2 } = createPickerRow('character_banner_custom_quote', 'Quote color', data.quoteColor, defaultQuote, saveColors);
    
    container.appendChild(row1);
    container.appendChild(row2);
}

// Reload persona pickers with fresh defaults
export function reloadPersonaPickers() {
    const container = document.getElementById('persona_banner_controls');
    if (!container) return; // Panel not open
    
    const userAvatar = user_avatar;
    if (!userAvatar || userAvatar === 'none') return;
    
    // Get current data
    const data = getUserData(userAvatar);
    const settings = getSettings();
    const defaultAccent = settings.accentColor;
    const defaultQuote = getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeQuoteColor').trim();
    
    // Find and remove old picker rows
    const oldPicker1 = document.getElementById('persona_banner_custom_accent');
    const oldPicker2 = document.getElementById('persona_banner_custom_quote');
    oldPicker1?.closest('.flex-container')?.remove();
    oldPicker2?.closest('.flex-container')?.remove();
    
    // Create save handler
    const saveColors = () => {
        const ua = user_avatar;
        if (!ua || ua === 'none') return;
        
        const p1 = document.getElementById('persona_banner_custom_accent');
        const p2 = document.getElementById('persona_banner_custom_quote');
        if (p1 && p2) {
            // Strict check: if it matches global default, FORCE inheritance (null)
            const settings = getSettings();
            const currentGlobalAccent = settings.accentColor || '#e79fa8';
            const currentGlobalQuote = getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeQuoteColor').trim();

            let accentVal = p1.hex;
            if (p1.parentNode.dataset.isDefault === 'true' || (accentVal && areColorsEqual(accentVal, currentGlobalAccent))) {
                accentVal = null;
            }

            let quoteVal = p2.hex;
            if (p2.parentNode.dataset.isDefault === 'true' || (quoteVal && areColorsEqual(quoteVal, currentGlobalQuote))) {
                quoteVal = null;
            }

            saveUserColors(ua, accentVal, quoteVal);
            applyBannersToChat();
        }
    };
    
    // Create new picker rows with updated defaults
    const { row: row1 } = createPickerRow('persona_banner_custom_accent', 'Accent color', data.accentColor, defaultAccent, saveColors);
    const { row: row2 } = createPickerRow('persona_banner_custom_quote', 'Quote color', data.quoteColor, defaultQuote, saveColors);
    
    container.appendChild(row1);
    container.appendChild(row2);
}

// Popup Helper
async function showBannerOptionsPopup(displayName, onEdit, onDelete) {
    const context = SillyTavern.getContext();
    const { Popup, POPUP_TYPE } = context;
    if (!Popup || !POPUP_TYPE) { onEdit(); return; }
    
    const removeConfirm = new Popup(
        `Banner exists for ${displayName}`,
        POPUP_TYPE.CONFIRM,
        `<div style="text-align: center;"><p>A banner is already configured.</p><p><b>Remove</b> the banner, or <b>Edit</b> it?</p></div>`,
        { okButton: 'Edit', cancelButton: 'Remove' }
    );
    
    // Allow clicking outside to close (simulates ESC)
    removeConfirm.dlg.addEventListener('click', (e) => {
        if (e.target === removeConfirm.dlg) removeConfirm.complete(null);
    });
    
    const result = await removeConfirm.show();
    if (result === true || result === 1) onEdit();
    else if (result === false || result === 0) {
        const deleteConfirm = new Popup('Confirm Removal', POPUP_TYPE.CONFIRM, '<p>Are you sure you want to remove this banner?</p>', { okButton: 'Yes, Remove', cancelButton: 'Cancel' });
        if (await deleteConfirm.show() === true) onDelete();
    }
}

// Editor Helper
async function openBannerEditor(avatarPath, displayName, isUser = false, characterId = null, customSource = null, forceAvatar = false) {
    if (!avatarPath && !customSource) return toastr.warning('No image source found');
    const { Popup, POPUP_TYPE } = SillyTavern.getContext();

    // Use custom source if provided, otherwise fetch the avatar
    let dataUrl = customSource;

    if (!dataUrl && !forceAvatar) {
        // Check if there's a stored custom source for this entity
        try {
            const savedData = isUser ? getUserData(avatarPath) : await getCharacterData(characterId);
            if (savedData && savedData.source) {
                dataUrl = savedData.source;
            }
        } catch (e) {
            console.warn(`[${extensionName}]`, 'Error checking for saved source:', e);
        }
    }

    if (!dataUrl) {
        let avatarUrl = isUser ? getPersonaImageUrlFullRes(avatarPath) : `/characters/${avatarPath}`;
        try {
            const blob = await (await fetch(avatarUrl)).blob();
            const reader = new FileReader();
            dataUrl = await new Promise((resolve) => { 
                reader.onload = () => resolve(reader.result); 
                reader.readAsDataURL(blob); 
            });
        } catch (error) {
            console.error(`[${extensionName}]`, 'Error loading avatar:', error);
            toastr.error(`Failed to load avatar image`);
            return;
        }
    }

    const popup = new Popup(`Configure banner for ${displayName}`, POPUP_TYPE.CROP, '', { cropImage: dataUrl, cropAspect: 4, okButton: 'Save Banner', cancelButton: 'Cancel' });
    popup.dlg.classList.add('avatar-banner-popup');
    const result = await popup.show();

    if (result && result.startsWith('data:')) {
        // If we used a custom source (either new upload or recrop), save it
        // Ensure strictly undefined if null to avoid overwriting existing source
        const sourceToSave = customSource || undefined;
        isUser ? saveUserBanner(avatarPath, result, sourceToSave) : await saveCharacterBanner(characterId, result, sourceToSave);
        applyBannersToChat();
        toastr.success(`Banner saved for ${displayName}`);
    }
}

// Handler: Panorama Button (Strictly Avatar)
async function handlePanoramaClick(avatarPath, displayName, isUser, characterId = null) {
    // Force avatar mode
    await openBannerEditor(avatarPath, displayName, isUser, characterId, null, true);
}

// Handler: Upload Button (Manage Custom Source)
async function handleUploadClick(avatarPath, displayName, isUser, characterId = null, fileInputEl) {
    const existingData = isUser ? getUserData(avatarPath) : await getCharacterData(characterId);
    
    // If we have an existing custom source, offer to Upload New or Remove Source
    if (existingData && existingData.source) {
        const { Popup, POPUP_TYPE } = SillyTavern.getContext();
        
        const confirm = new Popup(
            `Manage Custom Image`,
            POPUP_TYPE.CONFIRM,
            `<div style="text-align: center;"><p>A custom image is currently uploaded.</p><p><b>Upload New</b> to replace it, or <b>Delete</b> to remove it completely?</p></div>`,
            { okButton: 'Upload New', cancelButton: 'Delete' }
        );

        confirm.dlg.addEventListener('click', (e) => {
            if (e.target === confirm.dlg) confirm.complete(null);
        });

        const result = await confirm.show();
        if (result === true || result === 1) {
            // Upload New
            fileInputEl.click();
        } else if (result === false || result === 0) {
            // Delete Source FLow
             const deleteConfirm = new Popup('Confirm Deletion', POPUP_TYPE.CONFIRM, '<p>Are you sure you want to delete the custom image source? This cannot be undone.</p>', { okButton: 'Yes, Delete', cancelButton: 'Cancel' });
             if (await deleteConfirm.show() === true) {
                 isUser ? deleteUserCustomImage(avatarPath) : await deleteCharacterCustomImage(characterId);
                 await applyBannersToChat();
                 toastr.info('Custom image deleted');
             }
        }
    } else {
        // No existing source, just trigger upload
        fileInputEl.click();
    }
}

// Handler: Edit Button (Manage Active Banner)
async function handleEditClick(avatarPath, displayName, isUser, characterId = null) {
    const existingBanner = isUser ? getUserBanner(avatarPath) : await getCharacterBanner(characterId);
    
    if (existingBanner) {
        const { Popup, POPUP_TYPE } = SillyTavern.getContext();
        
        const confirm = new Popup(
            `Edit Active Banner`,
            POPUP_TYPE.CONFIRM,
            `<div style="text-align: center;"><p>Manage the current banner.</p><p><b>Recrop</b> to adjust, or <b>Remove</b> to hide it?</p></div>`,
            { okButton: 'Recrop', cancelButton: 'Remove' }
        );

        confirm.dlg.addEventListener('click', (e) => {
            if (e.target === confirm.dlg) confirm.complete(null);
        });

        const result = await confirm.show();
        if (result === true || result === 1) {
            // Recrop (Auto-detect source)
            await openBannerEditor(avatarPath, displayName, isUser, characterId);
        } else if (result === false || result === 0) {
            // Remove Banner Only
            isUser ? removeUserBanner(avatarPath) : await removeCharacterBanner(characterId);
            await applyBannersToChat();
            toastr.info(`Banner removed`);
        }
    } else {
        // No banner? Just open editor (create new)
        await openBannerEditor(avatarPath, displayName, isUser, characterId);
    }
}


// Helper to create color picker rows - uses innerHTML like ui-settings.js
function createPickerRow(id, labelText, color, defaultColor, onChangeCallback) {
    const row = document.createElement('div');
    row.className = 'flex-container alignitemscenter wide100p';
    row.style.gap = '10px';
    
    // Determine initial state: default if color is missing OR strictly matches default
    const isDefault = !color || (color.toLowerCase && defaultColor.toLowerCase && color.toLowerCase() === defaultColor.toLowerCase());
    row.dataset.isDefault = isDefault ? 'true' : 'false';
    
    const safeColor = escapeHtml(color || defaultColor || '#e79fa8');
    const safeDefault = escapeHtml(defaultColor || '#e79fa8');
    
    // Create picker via innerHTML like the settings panel does (line 49 of ui-settings.js)
    row.innerHTML = `
        <toolcool-color-picker id="${id}" color="${safeColor}" popup-position="left"></toolcool-color-picker>
        <span style="opacity: 0.7">${labelText}</span>
        <i class="fa-solid fa-arrow-rotate-right menu_button" title="Reset to default" data-default="${safeDefault}" style="cursor: pointer; opacity: 0.6;"></i>
    `;
    
    const picker = row.querySelector('toolcool-color-picker');
    const resetBtn = row.querySelector('i');
    
    picker.addEventListener('change', () => {
        // If user manually picks the default color, treat it as inheriting default
        const currentHex = picker.hex || picker.color; // toolcool picker property
        const movesToDefault = currentHex && defaultColor && currentHex.toLowerCase() === defaultColor.toLowerCase();
        row.dataset.isDefault = movesToDefault ? 'true' : 'false';
        onChangeCallback();
    });
    
    // Reset button handler
    resetBtn.addEventListener('click', () => {
        row.dataset.isDefault = 'true';
        picker.setAttribute('color', safeDefault);
        
        // We need to verify if the picker actually visually updates.
        // Some versions of toolcool-color-picker might need explicit .color property update too
        if (picker.color !== safeDefault) {
            picker.color = safeDefault;
        }
        
        onChangeCallback();
    });

    return { row, picker };
}

export async function addCharacterEditorButton() {
    if (!ExtensionState?.initialized) return;

    // Clean slate - remove old controls
    document.getElementById('avatar_banner_controls')?.remove();

    const context = SillyTavern.getContext();
    const characterId = context.characterId;
    if (characterId === undefined) return;

    const avatarDiv = document.querySelector('#avatar_div');
    if (!avatarDiv) return;

    // Get existing data for this character
    const data = await getCharacterData(characterId);

    const container = document.createElement('div');
    container.id = 'avatar_banner_controls';
    container.className = 'flex-container flexFlowColumn wide100p';
    container.style.marginTop = '5px';
    container.style.gap = '5px';

    // Hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.onchange = async (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (evt) => {
                 const sourceDataUrl = evt.target.result;
                 const ctx = SillyTavern.getContext();
                 const cid = ctx.characterId;
                 const name = ctx.characters?.[cid]?.name || 'Character';
                 const path = getCurrentCharacterAvatar();
                 openBannerEditor(path, name, false, cid, sourceDataUrl);
            };
            reader.readAsDataURL(file);
        }
        // Reset so same file can be selected again if needed
        e.target.value = '';
    };
    container.appendChild(fileInput);

    // Buttons ROW
    const btnRow = document.createElement('div');
    btnRow.className = 'flex-container wide100p';
    btnRow.style.gap = '5px';

    // 1. Panorama Button (Avatar)
    const panBtn = document.createElement('div');
    panBtn.id = 'avatar_banner_panorama';
    panBtn.className = 'menu_button fa-solid fa-panorama interactable';
    panBtn.style.flex = '1';
    panBtn.title = 'Crop Avatar for Banner';
    panBtn.style.textAlign = 'center';
    
    panBtn.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
        const ctx = SillyTavern.getContext();
        const cid = ctx.characterId;
        const path = getCurrentCharacterAvatar();
        const name = ctx.characters?.[cid]?.name || 'Character';
        if (path && cid !== undefined) await handlePanoramaClick(path, name, false, cid);
    };

    // 2. Upload Button (Custom)
    const uploadBtn = document.createElement('div');
    uploadBtn.className = 'menu_button fa-solid fa-upload interactable';
    uploadBtn.title = 'Manage Custom Image';
    uploadBtn.style.flex = '1';
    uploadBtn.style.textAlign = 'center';

    uploadBtn.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
        const ctx = SillyTavern.getContext();
        const cid = ctx.characterId;
        const path = getCurrentCharacterAvatar();
        const name = ctx.characters?.[cid]?.name || 'Character';
        if (cid !== undefined) await handleUploadClick(path, name, false, cid, fileInput);
    };

    // 3. Edit Button (Recrop/Remove)
    const editBtn = document.createElement('div');
    editBtn.className = 'menu_button fa-solid fa-pen-to-square interactable';
    editBtn.title = 'Edit/Remove Active Banner';
    editBtn.style.flex = '1';
    editBtn.style.textAlign = 'center';

    editBtn.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
        const ctx = SillyTavern.getContext();
        const cid = ctx.characterId;
        const path = getCurrentCharacterAvatar();
        const name = ctx.characters?.[cid]?.name || 'Character';
        if (cid !== undefined) await handleEditClick(path, name, false, cid);
    };
    
    btnRow.appendChild(panBtn);
    btnRow.appendChild(uploadBtn);
    btnRow.appendChild(editBtn);
    container.appendChild(btnRow);

    // Color save handler (no toast - silent save)
    const saveColors = async () => {
        const cid = SillyTavern.getContext().characterId;
        if (cid === undefined) return;
        
        const p1 = document.getElementById('character_banner_custom_accent');
        const p2 = document.getElementById('character_banner_custom_quote');
        if (p1 && p2) {
            // Check for default state (inheritance)
            // Strict check: if it matches global default, FORCE inheritance (null)
            const settings = getSettings();
            const currentGlobalAccent = settings.accentColor || '#e79fa8';
            const currentGlobalQuote = getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeQuoteColor').trim();
            
            let accentVal = p1.hex;
            if (p1.parentNode.dataset.isDefault === 'true' || (accentVal && areColorsEqual(accentVal, currentGlobalAccent))) {
               accentVal = null;
            }
            
            let quoteVal = p2.hex;
            if (p2.parentNode.dataset.isDefault === 'true' || (quoteVal && areColorsEqual(quoteVal, currentGlobalQuote))) {
                quoteVal = null;
            }
            
            await saveCharacterColors(cid, accentVal, quoteVal);
            applyBannersToChat();
        }
    };

    // Defaults: accent from settings (source of --banner-accent-rgb), quote from theme
    const settings = getSettings();
    const defaultAccent = settings.accentColor;
    const defaultQuote = getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeQuoteColor').trim();
    
    // Color pickers (pass raw value for inheritance check, default for fallback)
    const { row: row1 } = createPickerRow('character_banner_custom_accent', 'Accent color', data.accentColor, defaultAccent, saveColors);
    const { row: row2 } = createPickerRow('character_banner_custom_quote', 'Quote color', data.quoteColor, defaultQuote, saveColors);
    
    container.appendChild(row1);
    container.appendChild(row2);

    const tagsDiv = document.querySelector('#tags_div');
    tagsDiv ? avatarDiv.parentNode.insertBefore(container, tagsDiv) : avatarDiv.after(container);
}

export async function addPersonaPanelButton() {
    if (!ExtensionState?.initialized) return;

    // Clean slate
    document.getElementById('persona_banner_controls')?.remove();

    const userAvatar = user_avatar;
    if (!userAvatar || userAvatar === 'none') return;

    const buttonsBlock = document.querySelector('#persona_controls .persona_controls_buttons_block');
    if (!buttonsBlock) return;

    // Get existing data for this persona
    const data = getUserData(userAvatar);

    const container = document.createElement('div');
    container.id = 'persona_banner_controls';
    container.className = 'flex-container flexFlowColumn wide100p';
    container.style.marginTop = '5px';
    container.style.gap = '5px';

    // Hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.onchange = async (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (evt) => {
                 const sourceDataUrl = evt.target.result;
                 const ua = user_avatar;
                 const name = power_user.personas[ua] || power_user.name || 'User';
                 openBannerEditor(ua, name, true, null, sourceDataUrl);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };
    container.appendChild(fileInput);

    // Buttons ROW
    const btnRow = document.createElement('div');
    btnRow.className = 'flex-container wide100p';
    btnRow.style.gap = '5px';

    // 1. Panorama Button (Avatar)
    const panBtn = document.createElement('div');
    panBtn.id = 'persona_banner_panorama';
    panBtn.className = 'menu_button fa-solid fa-panorama interactable';
    panBtn.style.flex = '1';
    panBtn.title = 'Crop Avatar for Banner';
    panBtn.style.textAlign = 'center';
    
    panBtn.onclick = async () => {
        const ua = user_avatar;
        const name = power_user.personas[ua] || power_user.name || 'User';
        if (ua && ua !== 'none') await handlePanoramaClick(ua, name, true);
    };

    // 2. Upload Button (Custom)
    const uploadBtn = document.createElement('div');
    uploadBtn.className = 'menu_button fa-solid fa-upload interactable';
    uploadBtn.title = 'Manage Custom Image';
    uploadBtn.style.flex = '1';
    uploadBtn.style.textAlign = 'center';
    
    uploadBtn.onclick = async () => {
        const ua = user_avatar;
        const name = power_user.personas[ua] || power_user.name || 'User';
        if (ua && ua !== 'none') await handleUploadClick(ua, name, true, null, fileInput);
    };

    // 3. Edit Button (Recrop/Remove)
    const editBtn = document.createElement('div');
    editBtn.className = 'menu_button fa-solid fa-pen-to-square interactable';
    editBtn.title = 'Edit/Remove Active Banner';
    editBtn.style.flex = '1';
    editBtn.style.textAlign = 'center';

    editBtn.onclick = async () => {
        const ua = user_avatar;
        const name = power_user.personas[ua] || power_user.name || 'User';
        if (ua && ua !== 'none') await handleEditClick(ua, name, true);
    };

    btnRow.appendChild(panBtn);
    btnRow.appendChild(uploadBtn);
    btnRow.appendChild(editBtn);
    container.appendChild(btnRow);

    // Color save handler (no toast - silent save)
    const saveColors = () => {
        const ua = user_avatar;
        if (!ua || ua === 'none') return;
        
        const p1 = document.getElementById('persona_banner_custom_accent');
        const p2 = document.getElementById('persona_banner_custom_quote');
        if (p1 && p2) {
            // Strict check: if it matches global default, FORCE inheritance (null)
            const settings = getSettings();
            const currentGlobalAccent = settings.accentColor || '#e79fa8';
            const currentGlobalQuote = getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeQuoteColor').trim();

            let accentVal = p1.hex;
            if (p1.parentNode.dataset.isDefault === 'true' || (accentVal && areColorsEqual(accentVal, currentGlobalAccent))) {
                accentVal = null;
            }

            let quoteVal = p2.hex;
            if (p2.parentNode.dataset.isDefault === 'true' || (quoteVal && areColorsEqual(quoteVal, currentGlobalQuote))) {
                quoteVal = null;
            }

            saveUserColors(ua, accentVal, quoteVal);
            applyBannersToChat();
        }
    };

    // Defaults: accent from settings (source of --banner-accent-rgb), quote from theme
    const settings = getSettings();
    const defaultAccent = settings.accentColor;
    const defaultQuote = getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeQuoteColor').trim();
    
    // Color pickers (pass raw value for inheritance check, default for fallback)
    const { row: row1 } = createPickerRow('persona_banner_custom_accent', 'Accent color', data.accentColor, defaultAccent, saveColors);
    const { row: row2 } = createPickerRow('persona_banner_custom_quote', 'Quote color', data.quoteColor, defaultQuote, saveColors);

    container.appendChild(row1);
    container.appendChild(row2);

    buttonsBlock.parentNode.after(container);
}