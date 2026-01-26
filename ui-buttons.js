import { getCurrentCharacterAvatar, getPersonaImageUrlFullRes, escapeHtml } from './utils.js';
import { getCharacterBanner, saveCharacterBanner, removeCharacterBanner, getUserBanner, saveUserBanner, removeUserBanner, getCharacterData, getUserData, saveCharacterColors, saveUserColors } from './banner-manager.js';
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
    
    // Listen directly to SillyTavern's quote color picker for instant updates
    // This bypasses the 1-second debounced SETTINGS_UPDATED event
    setTimeout(() => {
        const quoteColorPicker = document.getElementById('quote-color-picker');
        if (quoteColorPicker) {
            quoteColorPicker.addEventListener('change', () => {
                // Quote color changed - re-render chat instantly
                applyBannersToChat();
                // Also reload pickers if they're open
                reloadCharacterPickers();
                reloadPersonaPickers();
            });
        }
    }, 1000); // Wait for ST's UI to load
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
            const accentVal = p1.parentNode.dataset.isDefault === 'true' ? null : p1.hex;
            const quoteVal = p2.parentNode.dataset.isDefault === 'true' ? null : p2.hex;
            
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
            const accentVal = p1.parentNode.dataset.isDefault === 'true' ? null : p1.hex;
            const quoteVal = p2.parentNode.dataset.isDefault === 'true' ? null : p2.hex;

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
    
    const result = await removeConfirm.show();
    if (result === true || result === 1) onEdit();
    else if (result === false || result === 0) {
        const deleteConfirm = new Popup('Confirm Removal', POPUP_TYPE.CONFIRM, '<p>Are you sure you want to remove this banner?</p>', { okButton: 'Yes, Remove', cancelButton: 'Cancel' });
        if (await deleteConfirm.show() === true) onDelete();
    }
}

// Editor Helper
async function openBannerEditor(avatarPath, displayName, isUser = false, characterId = null) {
    if (!avatarPath) return toastr.warning('No avatar found');
    const { Popup, POPUP_TYPE } = SillyTavern.getContext();

    let avatarUrl = isUser ? getPersonaImageUrlFullRes(avatarPath) : `/characters/${avatarPath}`;
    try {
        const blob = await (await fetch(avatarUrl)).blob();
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve) => { 
            reader.onload = () => resolve(reader.result); 
            reader.readAsDataURL(blob); 
        });

        const popup = new Popup(`Configure banner for ${displayName}`, POPUP_TYPE.CROP, '', { cropImage: dataUrl, cropAspect: 4, okButton: 'Save Banner', cancelButton: 'Cancel' });
        popup.dlg.classList.add('avatar-banner-popup');
        const result = await popup.show();

        if (result && result.startsWith('data:')) {
            isUser ? saveUserBanner(avatarPath, result) : await saveCharacterBanner(characterId, result);
            applyBannersToChat();
            toastr.success(`Banner saved for ${displayName}`);
        }
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error in banner editor:', error);
        toastr.error(`Failed to load avatar image`);
    }
}

// Click Handler Helper
async function handleBannerButtonClick(avatarPath, displayName, isUser, characterId = null) {
    try {
        let existingBanner = isUser ? getUserBanner(avatarPath) : await getCharacterBanner(characterId);
        const edit = () => openBannerEditor(avatarPath, displayName, isUser, characterId);
        const del = async () => {
            isUser ? removeUserBanner(avatarPath) : await removeCharacterBanner(characterId);
            applyBannersToChat();
            toastr.info(`Banner removed for ${displayName}`);
        };
        existingBanner ? showBannerOptionsPopup(displayName, edit, del) : edit();
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error handling banner button click:', error);
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

    // Banner button
    const button = document.createElement('div');
    button.id = 'avatar_banner_button';
    button.className = 'menu_button fa-solid fa-panorama interactable wide100p';
    button.title = 'Configure Avatar Banner';
    
    button.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
        const ctx = SillyTavern.getContext();
        const cid = ctx.characterId;
        const path = getCurrentCharacterAvatar();
        const name = ctx.characters?.[cid]?.name || 'Character';
        if (path && cid !== undefined) await handleBannerButtonClick(path, name, false, cid);
    };
    
    const btnRow = document.createElement('div');
    btnRow.className = 'flex-container wide100p';
    btnRow.appendChild(button);
    container.appendChild(btnRow);

    // Color save handler (no toast - silent save)
    const saveColors = async () => {
        const cid = SillyTavern.getContext().characterId;
        if (cid === undefined) return;
        
        const p1 = document.getElementById('character_banner_custom_accent');
        const p2 = document.getElementById('character_banner_custom_quote');
        if (p1 && p2) {
            // Check for default state (inheritance)
            const accentVal = p1.parentNode.dataset.isDefault === 'true' ? null : p1.hex;
            const quoteVal = p2.parentNode.dataset.isDefault === 'true' ? null : p2.hex;
            
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

    // Banner button
    const button = document.createElement('div');
    button.id = 'persona_banner_button';
    button.className = 'menu_button fa-solid fa-panorama interactable wide100p';
    button.title = 'Configure Persona Banner';
    
    button.onclick = async () => {
        const ua = user_avatar;
        const name = power_user.personas[ua] || power_user.name || 'User';
        if (ua && ua !== 'none') await handleBannerButtonClick(ua, name, true);
    };

    const btnRow = document.createElement('div');
    btnRow.className = 'flex-container wide100p';
    btnRow.appendChild(button);
    container.appendChild(btnRow);

    // Color save handler (no toast - silent save)
    const saveColors = () => {
        const ua = user_avatar;
        if (!ua || ua === 'none') return;
        
        const p1 = document.getElementById('persona_banner_custom_accent');
        const p2 = document.getElementById('persona_banner_custom_quote');
        if (p1 && p2) {
            // Check for default state (inheritance)
            const accentVal = p1.parentNode.dataset.isDefault === 'true' ? null : p1.hex;
            const quoteVal = p2.parentNode.dataset.isDefault === 'true' ? null : p2.hex;

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