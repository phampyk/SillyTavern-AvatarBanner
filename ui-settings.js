import { escapeHtml } from './utils.js';
import { preloadGoogleFont } from './fonts.js';
import { reloadCharacterPickers, reloadPersonaPickers } from './ui-buttons.js';

const extensionName = 'SillyTavern-AvatarBanner';

export function createSettingsPanel(getSettings, saveSettings, regenerateCSS, ExtensionState) {
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
                
                <div class="avatar-banner-grid-row">
                    <label class="checkbox_label flexnowrap" for="avatar_banner_user_enabled">
                        <input type="checkbox" id="avatar_banner_user_enabled" ${settings.enableUserBanners ? 'checked' : ''}>
                        <span>Enable Persona Banners</span>
                        <div class="fa-solid fa-circle-info opacity50p" title="When enabled, persona messages will also show banners if configured."></div>
                    </label>
                    <label class="checkbox_label flexnowrap" for="avatar_banner_panel_enabled">
                        <input type="checkbox" id="avatar_banner_panel_enabled" ${settings.enablePanelBanner ? 'checked' : ''}>
                        <span>Enable Panel Banner</span>
                        <div class="fa-solid fa-circle-info opacity50p" title="Shows the character banner in the character manager panel."></div>
                    </label>
                </div>
                

                <div class="avatar-banner-grid-row">
                    <div class="avatar-banner-inline ${disabledClass}" id="avatar_banner_color_row">
                        <span>Accent Color</span>
                        <div class="fa-solid fa-circle-info opacity50p" title="Used for borders, shadows, gradients, and text effects"></div>
                        <toolcool-color-picker id="avatar_banner_color" color="${escapeHtml(settings.accentColor || '#e79fa8')}"></toolcool-color-picker>
                    </div>
                    <div style="min-height: 1px;"></div>
                </div>
                
                <div class="avatar-banner-font-row ${disabledClass}" id="avatar_banner_font_row">
                    <span>Font Family</span>
                    <div class="fa-solid fa-circle-info opacity50p" title="Enter a font name (e.g. Caveat) or paste the full @import from Google Fonts"></div>
                    <input type="text" id="avatar_banner_font" class="text_pole" placeholder="Font name or @import url(...)" value="${escapeHtml(settings.fontFamily || '')}">
                </div>
                
                <div class="avatar-banner-grid-row">
                    <div class="alignitemscenter flex-container flexFlowColumn flexBasis48p flexGrow flexShrink gap0">
                        <small>
                            <span>Banner Size (vh)</span>
                            <div class="fa-solid fa-circle-info opacity50p" title="Height of the banner as % of screen height (responsive)"></div>
                        </small>
                        <input class="neo-range-slider" type="range" id="avatar_banner_height" min="5" max="35" step="1" value="${settings.bannerHeight}">
                        <input class="neo-range-input" type="number" min="5" max="35" step="1" id="avatar_banner_height_counter" value="${settings.bannerHeight}">
                    </div>
                    <div class="alignitemscenter flex-container flexFlowColumn flexBasis48p flexGrow flexShrink gap0 ${disabledClass}" id="avatar_banner_fontsize_row">
                        <small>
                            <span>Font Size (rem)</span>
                            <div class="fa-solid fa-circle-info opacity50p" title="Size of the character/persona name text in rem units"></div>
                        </small>
                        <input class="neo-range-slider" type="range" id="avatar_banner_fontsize" min="1" max="4.5" step="0.0625" value="${settings.fontSize || 2.25}">
                        <input class="neo-range-input" type="number" min="1" max="4.5" step="0.0625" id="avatar_banner_fontsize_counter" value="${settings.fontSize || 2.25}">
                    </div>
                </div>

                <div class="avatar-banner-grid-row ${disabledClass}" id="avatar_banner_namepadding_row">
                    <div class="alignitemscenter flex-container flexFlowColumn flexBasis48p flexGrow flexShrink gap0">
                        <small>
                            <span>Name Padding (T/B) (em)</span>
                            <div class="fa-solid fa-circle-info opacity50p" title="Top/bottom padding for the name text in em units (scales with font size)"></div>
                        </small>
                        <input class="neo-range-slider" type="range" id="avatar_banner_namepad_tb" min="0" max="0.556" step="0.028" value="${Number.isFinite(settings.namePaddingTB) ? settings.namePaddingTB : 0}">
                        <input class="neo-range-input" type="number" min="0" max="0.556" step="0.028" id="avatar_banner_namepad_tb_counter" value="${Number.isFinite(settings.namePaddingTB) ? settings.namePaddingTB : 0}">
                    </div>
                    <div class="alignitemscenter flex-container flexFlowColumn flexBasis48p flexGrow flexShrink gap0">
                        <small>
                            <span>Name Padding (L/R) (em)</span>
                            <div class="fa-solid fa-circle-info opacity50p" title="Left/right padding for the name text in em units (scales with font size)"></div>
                        </small>
                        <input class="neo-range-slider" type="range" id="avatar_banner_namepad_lr" min="0" max="0.556" step="0.028" value="${Number.isFinite(settings.namePaddingLR) ? settings.namePaddingLR : 0}">
                        <input class="neo-range-input" type="number" min="0" max="0.556" step="0.028" id="avatar_banner_namepad_lr_counter" value="${Number.isFinite(settings.namePaddingLR) ? settings.namePaddingLR : 0}">
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    const extensionsSettings = document.getElementById('extensions_settings');
    if (extensionsSettings) {
        // Prevent duplicate panels
        const existingPanel = document.getElementById('avatar-banner-settings-container');
        if (existingPanel) return;

        const container = document.createElement('div');
        container.id = 'avatar-banner-settings-container';
        container.innerHTML = settingsHtml;
        extensionsSettings.appendChild(container);

        // Register cleanup for the settings panel
        ExtensionState.cleanupFunctions.push(() => {
            const panel = document.getElementById('avatar-banner-settings-container');
            if (panel) panel.remove();
        });

        // === Event Listeners ===

        // Master toggle
        document.getElementById('avatar_banner_enabled').addEventListener('change', (e) => {
            const settings = getSettings();
            settings.enabled = e.target.checked;
            saveSettings();
            regenerateCSS();
        });

        // User banners toggle
        document.getElementById('avatar_banner_user_enabled').addEventListener('change', (e) => {
            const settings = getSettings();
            settings.enableUserBanners = e.target.checked;
            saveSettings();
            regenerateCSS();
        });

        // Panel banner toggle
        document.getElementById('avatar_banner_panel_enabled').addEventListener('change', (e) => {
            const settings = getSettings();
            settings.enablePanelBanner = e.target.checked;
            saveSettings();
            regenerateCSS();
        });

        // Banner height slider
        const heightSlider = document.getElementById('avatar_banner_height');
        const heightCounter = document.getElementById('avatar_banner_height_counter');
        
        const updateBannerHeight = (value) => {
            const settings = getSettings();
            settings.bannerHeight = parseFloat(value);
            saveSettings();
            regenerateCSS();
        };
        
        heightSlider.addEventListener('input', (e) => {
            heightCounter.value = e.target.value;
            updateBannerHeight(e.target.value);
        });
        
        heightCounter.addEventListener('input', (e) => {
            heightSlider.value = e.target.value;
            updateBannerHeight(e.target.value);
        });
        
        // Font size slider
        const fontSizeSlider = document.getElementById('avatar_banner_fontsize');
        const fontSizeCounter = document.getElementById('avatar_banner_fontsize_counter');
        
        const updateFontSize = (value) => {
            const settings = getSettings();
            settings.fontSize = parseFloat(value);
            saveSettings();
            regenerateCSS();
        };
        
        fontSizeSlider.addEventListener('input', (e) => {
            fontSizeCounter.value = e.target.value;
            updateFontSize(e.target.value);
        });
        
        fontSizeCounter.addEventListener('input', (e) => {
            fontSizeSlider.value = e.target.value;
            updateFontSize(e.target.value);
        });

        // Name padding sliders
        const namePadTbSlider = document.getElementById('avatar_banner_namepad_tb');
        const namePadTbCounter = document.getElementById('avatar_banner_namepad_tb_counter');
        const namePadLrSlider = document.getElementById('avatar_banner_namepad_lr');
        const namePadLrCounter = document.getElementById('avatar_banner_namepad_lr_counter');

        const updateNamePaddingTB = (value) => {
            const settings = getSettings();
            settings.namePaddingTB = parseFloat(value);
            saveSettings();
            regenerateCSS();
        };

        const updateNamePaddingLR = (value) => {
            const settings = getSettings();
            settings.namePaddingLR = parseFloat(value);
            saveSettings();
            regenerateCSS();
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
        
        // Extra styling toggle
        document.getElementById('avatar_banner_extra_styling').addEventListener('change', (e) => {
            const settings = getSettings();
            settings.extraStylingEnabled = e.target.checked;
            saveSettings();
            
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
            
            regenerateCSS();
        });
        
        // Font family input
        document.getElementById('avatar_banner_font').addEventListener('input', (e) => {
            const settings = getSettings();
            const newFont = e.target.value.trim();
            
            if (settings.fontFamily !== newFont) {
                settings.fontFamily = newFont;
                saveSettings();
                
                if (settings.extraStylingEnabled && newFont) {
                    preloadGoogleFont(newFont, true, ExtensionState);
                }
                
                regenerateCSS();
            }
        });
        
        // Accent color picker
        const colorPicker = document.getElementById('avatar_banner_color');
        if (colorPicker) {
            colorPicker.addEventListener('change', (e) => {
                const settings = getSettings();
                const color = e.detail?.hex || colorPicker.color;
                if (color) {
                    settings.accentColor = color;
                    saveSettings();
                    regenerateCSS();
                    // Reload open pickers to reflect new default
                    reloadCharacterPickers();
                    reloadPersonaPickers();
                }
            });
        }
    }
}
