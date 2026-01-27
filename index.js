import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

import { createSettingsPanel } from './ui-settings.js';
import { addCharacterEditorButton, addPersonaPanelButton, initUIButtons, reloadCharacterPickers, reloadPersonaPickers } from './ui-buttons.js';
import { initCSSGenerator, regenerateCSS, regenerateCSSImmediate, cleanupCSS } from './css-generator.js';
import { initBannerManager } from './banner-manager.js';

const extensionName = 'SillyTavern-AvatarBanner';

const ExtensionState = {
    cleanupFunctions: [],
    observer: null,
    initialized: false,
    currentLoadedFont: null,
};

const defaultSettings = {
    enabled: true,
    bannerHeight: 15,           // vh
    enableUserBanners: false,
    userBanners: {},
    extraStylingEnabled: false,
    enablePanelBanner: false,
    fontFamily: '',
    accentColor: '#e79fa8',
    fontSize: 2.4,              // rem
    namePaddingTB: 0,           // em
    namePaddingLR: 0,           // em
};

function getSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = { ...defaultSettings };
    }
    if (!extension_settings[extensionName].userBanners) {
        extension_settings[extensionName].userBanners = {};
    }
    
    migrateSettings(extension_settings[extensionName]);
    
    return extension_settings[extensionName];
}

function migrateSettings(settings) {
    if (!settings) return;

    let modified = false;

    // 1. Banner Height: 80-300px -> 8-30vh (divisor 10)
    const heightValue = parseFloat(settings.bannerHeight);
    if (heightValue > 40) {
        console.log(`[${extensionName}] Migrating Height: ${heightValue}px -> ${heightValue / 10}vh`);
        settings.bannerHeight = parseFloat((heightValue / 10).toFixed(2));
        modified = true;
    }
    
    // 2. Font Size: 16-72px -> 1.06-4.8rem (divisor 15)
    const fontSizeValue = parseFloat(settings.fontSize);
    if (fontSizeValue > 10) {
        console.log(`[${extensionName}] Migrating Font: ${fontSizeValue}px -> ${fontSizeValue / 15}rem`);
        settings.fontSize = parseFloat((fontSizeValue / 15).toFixed(2));
        modified = true;
    }
    
    // 3. Name Padding: 0-60px -> 0-1.6em (divisor 36)
    const paddingTB = parseFloat(settings.namePaddingTB);
    if (paddingTB >= 1) {
        settings.namePaddingTB = parseFloat((paddingTB / 36).toFixed(3));
        modified = true;
    }
    const paddingLR = parseFloat(settings.namePaddingLR);
    if (paddingLR >= 1) {
        settings.namePaddingLR = parseFloat((paddingLR / 36).toFixed(3));
        modified = true;
    }

    if (modified) {
        console.log(`[${extensionName}] Legacy settings successfully migrated to responsive units.`);
        saveSettings();
    }
}

function saveSettings() {
    saveSettingsDebounced();
}

/**
 * Setup observer for UI button injection (character popup, persona drawer)
 */
function setupMutationObserver() {
    if (ExtensionState.observer) return;
    
    const observer = new MutationObserver((mutations) => {
        try {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' || mutation.type === 'attributes') {
                    const characterPopup = document.getElementById('character_popup');
                    if (characterPopup && characterPopup.style.display !== 'none') {
                        addCharacterEditorButton();
                    }
                    
                    const personaDrawer = document.querySelector('#persona-management-button .drawer-content');
                    if (personaDrawer && personaDrawer.classList.contains('openDrawer')) {
                        requestAnimationFrame(() => addPersonaPanelButton());
                    }
                }
            }
        } catch (error) {
            console.error(`[${extensionName}]`, 'Error in MutationObserver:', error);
        }
    });
    
    const observeTargets = () => {
        if (!ExtensionState.initialized) return;
        
        const characterPopup = document.getElementById('character_popup');
        const personaButton = document.getElementById('persona-management-button');
        
        if (characterPopup) {
            observer.observe(characterPopup, {
                childList: true,
                attributes: true,
                attributeFilter: ['style'],
                subtree: false
            });
        }
        
        if (personaButton) {
            observer.observe(personaButton, {
                childList: true,
                attributes: true,
                attributeFilter: ['class'],
                subtree: true
            });
        }
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observeTargets);
        ExtensionState.cleanupFunctions.push(() => {
            document.removeEventListener('DOMContentLoaded', observeTargets);
        });
    } else {
        observeTargets();
    }
    
    ExtensionState.observer = observer;
    
    ExtensionState.cleanupFunctions.push(() => {
        if (ExtensionState.observer) {
            ExtensionState.observer.disconnect();
            ExtensionState.observer = null;
        }
    });
}

function cleanup() {
    try {
        ExtensionState.cleanupFunctions.forEach(fn => {
            try {
                fn();
            } catch (error) {
                console.error(`[${extensionName}]`, 'Cleanup function error:', error);
            }
        });
        ExtensionState.cleanupFunctions = [];

        if (ExtensionState.observer) {
            ExtensionState.observer.disconnect();
            ExtensionState.observer = null;
        }

        // Clean up generated CSS
        cleanupCSS();

        ExtensionState.currentLoadedFont = null;

        // Clean up UI buttons and elements
        ['avatar_banner_controls', 'persona_banner_controls'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

    } catch (error) {
        console.error(`[${extensionName}]`, 'Cleanup error:', error);
    }
}

async function init() {
    if (ExtensionState.initialized) return;
    
    try {
        getSettings();

        // Initialize modules
        initBannerManager(getSettings, saveSettings);
        initCSSGenerator(getSettings, ExtensionState);
        initUIButtons(regenerateCSS, ExtensionState, getSettings, eventSource, event_types);
        
        // Create settings panel
        createSettingsPanel(getSettings, saveSettings, regenerateCSS, ExtensionState);

        // Event handlers
        const chatChangedHandler = () => {
            regenerateCSSImmediate();
            addCharacterEditorButton();
        };
        eventSource.on(event_types.CHAT_CHANGED, chatChangedHandler);
        ExtensionState.cleanupFunctions.push(() => {
            eventSource.removeListener(event_types.CHAT_CHANGED, chatChangedHandler);
        });

        const characterEditedHandler = () => {
            regenerateCSS();
            addCharacterEditorButton();
        };
        eventSource.on(event_types.CHARACTER_EDITED, characterEditedHandler);
        ExtensionState.cleanupFunctions.push(() => {
            eventSource.removeListener(event_types.CHARACTER_EDITED, characterEditedHandler);
        });

        const settingsUpdatedHandler = () => {
            regenerateCSS();
            // Refresh color pickers in case theme colors changed (e.g. --SmartThemeQuoteColor)
            reloadCharacterPickers();
            reloadPersonaPickers();
        };
        eventSource.on(event_types.SETTINGS_UPDATED, settingsUpdatedHandler);
        ExtensionState.cleanupFunctions.push(() => {
            eventSource.removeListener(event_types.SETTINGS_UPDATED, settingsUpdatedHandler);
        });

        // Setup UI observer
        setupMutationObserver();

        // Initial render
        setTimeout(() => {
            regenerateCSSImmediate();
            addCharacterEditorButton();
            addPersonaPanelButton();
        }, 1000);

        ExtensionState.initialized = true;
        console.log(`[${extensionName}] Initialized successfully`);
        
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error during initialization:', error);
    }
}

jQuery(() => {
    init();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { cleanup };
}

window.AvatarBannerExtension = window.AvatarBannerExtension || {};
window.AvatarBannerExtension.cleanup = cleanup;
