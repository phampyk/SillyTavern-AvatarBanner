import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

import { createSettingsPanel } from './ui-settings.js';
import { addCharacterEditorButton, addPersonaPanelButton, initUIButtons } from './ui-buttons.js';
import { applyBannersToChat, initChatRenderer } from './chat-renderer.js';
import { initBannerManager } from './banner-manager.js';

const extensionName = 'SillyTavern-AvatarBanner';

const ExtensionState = {
    cleanupFunctions: [],
    observer: null,
    initialized: false,
    currentLoadedFont: null,
    charClickHandlerBound: false,
    personaClickHandlerBound: false,
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
    
    // Ensure migration runs when settings are retrieved
    migrateSettings(extension_settings[extensionName]);
    
    return extension_settings[extensionName];
}

function migrateSettings(settings) {
    if (!settings) return;

    let modified = false;

    // 1. Banner Height: 80-300px -> 8-30vh (divisor 10)
    // Any value over 40 is definitely old pixels
    const heightValue = parseFloat(settings.bannerHeight);
    if (heightValue > 40) {
        console.log(`[${extensionName}] Migrating Height: ${heightValue}px -> ${heightValue / 10}vh`);
        settings.bannerHeight = parseFloat((heightValue / 10).toFixed(2));
        modified = true;
    }
    
    // 2. Font Size: 16-72px -> 1.06-4.8rem (divisor 15)
    // Any value over 10 is definitely old pixels
    const fontSizeValue = parseFloat(settings.fontSize);
    if (fontSizeValue > 10) {
        console.log(`[${extensionName}] Migrating Font: ${fontSizeValue}px -> ${fontSizeValue / 15}rem`);
        settings.fontSize = parseFloat((fontSizeValue / 15).toFixed(2));
        modified = true;
    }
    
    // 3. Name Padding: 0-60px -> 0-1.6em (divisor 36)
    // Threshold 1 is safe as new em values are < 0.6
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

function setupMutationObserver() {
    if (ExtensionState.observer) {
        return;
    }
    
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
        if (!ExtensionState.initialized) return; // safety check
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

        const dynamicStyles = document.getElementById('avatar-banner-dynamic-styles');
        if (dynamicStyles) dynamicStyles.remove();

        const staticStyles = document.getElementById('avatar-banner-styles');
        if (staticStyles) staticStyles.remove();

        ExtensionState.currentLoadedFont = null;

        document.querySelectorAll('.avatar-banner').forEach(el => el.remove());
        document.querySelectorAll('.mes').forEach(mes => {
            mes.classList.remove('has-avatar-banner', 'moonlit-banner');
        });

        // Clean up panel banner (one variable, two classes for CSS targeting)
        document.body.classList.remove('has-panel-banner', 'has-panel-banner-moonlit');
        document.body.style.removeProperty('--panel-banner-url');

        // Clean up UI buttons and elements
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
    if (ExtensionState.initialized) {
        return;
    }
    try {
        getSettings();

        createSettingsPanel(getSettings, saveSettings, applyBannersToChat, ExtensionState);

        initBannerManager(getSettings, saveSettings);
        initUIButtons(applyBannersToChat, ExtensionState, getSettings, eventSource, event_types);
        initChatRenderer(getSettings, ExtensionState);

        const chatChangedHandler = () => {
            applyBannersToChat();
            addCharacterEditorButton();
        };
        eventSource.on(event_types.CHAT_CHANGED, chatChangedHandler);
        ExtensionState.cleanupFunctions.push(() => {
            eventSource.removeListener(event_types.CHAT_CHANGED, chatChangedHandler);
        });

        const messageReceivedHandler = () => {
            requestAnimationFrame(() => applyBannersToChat());
        };
        eventSource.on(event_types.MESSAGE_RECEIVED, messageReceivedHandler);
        ExtensionState.cleanupFunctions.push(() => {
            eventSource.removeListener(event_types.MESSAGE_RECEIVED, messageReceivedHandler);
        });

        const messageSentHandler = () => {
            requestAnimationFrame(() => applyBannersToChat());
        };
        eventSource.on(event_types.MESSAGE_SENT, messageSentHandler);
        ExtensionState.cleanupFunctions.push(() => {
            eventSource.removeListener(event_types.MESSAGE_SENT, messageSentHandler);
        });

        const characterEditedHandler = () => {
            addCharacterEditorButton();
        };
        eventSource.on(event_types.CHARACTER_EDITED, characterEditedHandler);
        ExtensionState.cleanupFunctions.push(() => {
            eventSource.removeListener(event_types.CHARACTER_EDITED, characterEditedHandler);
        });

        const settingsUpdatedHandler = () => {
            applyBannersToChat();
        };
        eventSource.on(event_types.SETTINGS_UPDATED, settingsUpdatedHandler);
        ExtensionState.cleanupFunctions.push(() => {
            eventSource.removeListener(event_types.SETTINGS_UPDATED, settingsUpdatedHandler);
        });

        setupMutationObserver();

        setTimeout(() => {
            applyBannersToChat();
            addCharacterEditorButton();
            addPersonaPanelButton();
        }, 1000);

        ExtensionState.initialized = true;
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