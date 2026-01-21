/**
 * Avatar Banner Extension for SillyTavern
 * Provides customizable banners and styling for chat messages.
 */
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
    bannerHeight: 150,
    enableUserBanners: false,
    userBanners: {},
    extraStylingEnabled: false,
    fontFamily: '',
    accentColor: '#e79fa8',
    fontSize: 36,
    namePaddingTB: 6,
    namePaddingLR: 10,
    useDisplayName: false,
};


function getSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = { ...defaultSettings };
    }
    if (!extension_settings[extensionName].userBanners) {
        extension_settings[extensionName].userBanners = {};
    }
    return extension_settings[extensionName];
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

        const charButton = document.getElementById('avatar_banner_button');
        if (charButton) charButton.remove();

        const personaButton = document.getElementById('persona_banner_button');
        if (personaButton) personaButton.remove();

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
        initUIButtons(applyBannersToChat, ExtensionState);
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