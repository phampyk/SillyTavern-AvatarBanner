/**
 * Avatar Banner Extension for SillyTavern - Modular Version
 * Based on v3.3.3 - Split into modules for maintainability
 *
 * @version 3.3.3-modular
 */

import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

// Module imports
import { createSettingsPanel } from './ui-settings.js';
import { addCharacterEditorButton, addPersonaPanelButton, initUIButtons } from './ui-buttons.js';
import { applyBannersToChat, initChatRenderer } from './chat-renderer.js';
import { initBannerManager } from './banner-manager.js';

const extensionName = 'SillyTavern-AvatarBanner';

// Namespaced state for proper cleanup (prevents memory leaks) - matches legacy
const ExtensionState = {
    cleanupFunctions: [],
    observer: null,
    initialized: false,
    currentLoadedFont: null, // Track currently loaded font to prevent flickering on chat changes
    charClickHandlerBound: false,
    personaClickHandlerBound: false,
};

// Default settings (global settings only - banners stored per-character) - matches legacy
const defaultSettings = {
    enabled: true,
    bannerHeight: 150,
    enableUserBanners: false, // legacy uses enableUserBanners
    userBanners: {}, // Only for persona banners: { [personaAvatar]: dataUrl }
    // v2 styling options
    extraStylingEnabled: false,
    fontFamily: '',
    accentColor: '#e79fa8', // Default pinkish color
    fontSize: 36, // Name text font size
    namePaddingTB: 6, // Name text padding top/bottom (px)
    namePaddingLR: 10, // Name text padding left/right (px)
    namePaddingLR: 10, // Name text padding left/right (px)
    useDisplayName: false, // Use short display name instead of full card name (for CharacterName ext)
    moonlitCompatibility: false, // Manual override for Moonlit Echoes theme compatibility
};

/**
 * Get extension settings, initializing if needed (matches legacy)
 */
function getSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = { ...defaultSettings };
    }
    if (!extension_settings[extensionName].userBanners) {
        extension_settings[extensionName].userBanners = {};
    }
    return extension_settings[extensionName];
}

/**
 * Save settings using ST's API (matches legacy)
 */
function saveSettings() {
    saveSettingsDebounced();
}

/**
 * Setup optimized MutationObserver for UI panels (with cleanup tracking)
 */
function setupMutationObserver() {
    if (ExtensionState.observer) {
        return; // Already setup
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
                subtree: false // OPTIMIZED: Don't watch deep tree
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
    
    // Track for cleanup
    ExtensionState.cleanupFunctions.push(() => {
        if (ExtensionState.observer) {
            ExtensionState.observer.disconnect();
            ExtensionState.observer = null;
        }
    });
}

/**
 * Cleanup function to remove all extension elements and listeners
 */
function cleanup() {
    try {
        // Execute all cleanup functions
        ExtensionState.cleanupFunctions.forEach(fn => {
            try {
                fn();
            } catch (error) {
                console.error(`[${extensionName}]`, 'Cleanup function error:', error);
            }
        });
        ExtensionState.cleanupFunctions = [];

        // Disconnect observer
        if (ExtensionState.observer) {
            ExtensionState.observer.disconnect();
            ExtensionState.observer = null;
        }

        // Remove dynamic styles
        const dynamicStyles = document.getElementById('avatar-banner-dynamic-styles');
        if (dynamicStyles) dynamicStyles.remove();

        // Remove static styles
        const staticStyles = document.getElementById('avatar-banner-styles');
        if (staticStyles) staticStyles.remove();

        // Reset loaded font state (legacy behavior)
        ExtensionState.currentLoadedFont = null;

        // Remove all banners from DOM
        document.querySelectorAll('.avatar-banner').forEach(el => el.remove());
        document.querySelectorAll('.mes').forEach(mes => {
            mes.classList.remove('has-avatar-banner');
        });

        // Remove buttons
        const charButton = document.getElementById('avatar_banner_button');
        if (charButton) charButton.remove();

        const personaButton = document.getElementById('persona_banner_button');
        if (personaButton) personaButton.remove();

    } catch (error) {
        console.error(`[${extensionName}]`, 'Cleanup error:', error);
    }
}

/**
 * Initialize the extension
 */
async function init() {
    if (ExtensionState.initialized) {
        console.log(`[${extensionName}]`, 'Already initialized, skipping');
        return;
    }
    try {
        console.log(`[${extensionName}]`, 'Initializing v3.1.0...');

        // Initialize settings and UI (legacy order)
        getSettings();

        createSettingsPanel(getSettings, saveSettings, applyBannersToChat, ExtensionState);

        // Initialize modules with dependencies
        initBannerManager(getSettings, saveSettings);
        initUIButtons(applyBannersToChat, ExtensionState);
        initChatRenderer(getSettings, ExtensionState);

        // Register event handlers with cleanup tracking (matches legacy)
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

        // Setup optimized MutationObserver (legacy)
        setupMutationObserver();

        // Initial application (legacy)
        setTimeout(() => {
            applyBannersToChat();
            addCharacterEditorButton();
            addPersonaPanelButton();
        }, 1000);

        ExtensionState.initialized = true;
        console.log(`[${extensionName}]`, 'Initialization complete');
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error during initialization:', error);
    }

}

// jQuery ready - standard ST extension pattern
jQuery(() => {
    init();
});

// Export cleanup for extension system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { cleanup };
}

// Make cleanup available globally for manual cleanup if needed
window.AvatarBannerExtension = window.AvatarBannerExtension || {};
window.AvatarBannerExtension.cleanup = cleanup;