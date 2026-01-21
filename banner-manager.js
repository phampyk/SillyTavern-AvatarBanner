/**
 * Avatar Banner Extension - Banner Management
 * EXACT copy from v3.3.3 lines 162-240, 415-437
 */
const extensionName = 'SillyTavern-AvatarBanner';

/**
 * Get banner for a character from their card data
 */
export async function getCharacterBanner(characterId) {
    try {
        const context = SillyTavern.getContext();
        const character = context.characters?.[characterId];
        return character?.data?.extensions?.[extensionName]?.banner || null;
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error getting character banner:', error);
        return null;
    }
}

/**
 * Save banner to character card data using ST's writeExtensionField
 */
export async function saveCharacterBanner(characterId, bannerDataUrl) {
    try {
        const context = SillyTavern.getContext();
        const { writeExtensionField } = context;

        if (!writeExtensionField) {
            console.error(`[${extensionName}]`, 'writeExtensionField not available');
            toastr.error('Cannot save banner - API not available');
            return false;
        }

        await writeExtensionField(characterId, extensionName, { banner: bannerDataUrl });
        console.log(`[${extensionName}]`, 'Banner saved for character ID:', characterId);
        return true;

    } catch (error) {
        console.error(`[${extensionName}]`, 'Error saving character banner:', error);
        toastr.error('Failed to save banner');
        return false;
    }
}

/**
 * Remove character banner
 */
export async function removeCharacterBanner(characterId) {
    try {
        const context = SillyTavern.getContext();
        const { writeExtensionField } = context;

        if (!writeExtensionField) {
            return false;
        }

        await writeExtensionField(characterId, extensionName, { banner: null });
        console.log(`[${extensionName}]`, 'Banner removed for character ID:', characterId);
        return true;

    } catch (error) {
        console.error(`[${extensionName}]`, 'Error removing character banner:', error);
        return false;
    }
}

// Module-level references (set by init function)
let getSettings, saveSettings;

/**
 * Initialize banner manager with dependencies
 */
export function initBannerManager(getSettingsFn, saveSettingsFn) {
    getSettings = getSettingsFn;
    saveSettings = saveSettingsFn;
}

/**
 * Get banner for user/persona from extension settings
 */
export function getUserBanner(avatarPath) {
    const settings = getSettings();
    return settings.userBanners?.[avatarPath] || null;
}

/**
 * Save user/persona banner to extension settings
 */
export function saveUserBanner(userAvatar, bannerDataUrl) {
    const settings = getSettings();
    if (!settings.userBanners) {
        settings.userBanners = {};
    }
    settings.userBanners[userAvatar] = bannerDataUrl;
    saveSettings();
    console.log(`[${extensionName}]`, 'User banner saved for:', userAvatar);
}

/**
 * Remove user/persona banner
 */
export function removeUserBanner(avatarPath) {
    const settings = getSettings();
    delete settings.userBanners[avatarPath];
    saveSettings();
    console.log(`[${extensionName}]`, 'User banner removed for:', avatarPath);
}

/**
 * Create a banner element
 */
export function createBannerElement(bannerDataUrl, height, mesElement, isMoonlit = false) {
    const banner = document.createElement('div');
    banner.className = 'avatar-banner';

    const mesStyle = window.getComputedStyle(mesElement);
    const borderRadius = mesStyle.borderRadius || '0px';

    // Base styles common to both modes
    let cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        --banner-height: ${height}px;
        height: var(--banner-height);
        background: url("${bannerDataUrl.replace(/"/g, '\\"')}") top center no-repeat;
        background-size: cover;
        mask-image: linear-gradient(to bottom, black 60%, rgba(0,0,0,0) 100%);
        -webkit-mask-image: linear-gradient(to bottom, black 60%, rgba(0,0,0,0) 100%);
    `;

    // Only add these if NOT in Moonlit mode (as requested by user to remove clutter)
    // User identified: mask-size, mask-repeat, z-index, pointer-events, border-radius as clutter
    if (!isMoonlit) {
        cssText += `
        mask-size: 100% 100%;
        mask-repeat: no-repeat;
        -webkit-mask-size: 100% 100%;
        -webkit-mask-repeat: no-repeat;
        z-index: 1;
        pointer-events: none;
        border-top-left-radius: ${borderRadius};
        border-top-right-radius: ${borderRadius};
        `;
    } else {
        // Moonlit Mode specific minimal styling (if any triggers are needed, but user wanted it clean)
        // Ensure it doesn't block interaction if that was the point of pointer-events: none,
        // but user listed pointer-events as clutter. We'll leave it interactive or transparent as native.
        // Actually, if it covers text, pointer-events: none is good, but user listed it as clutter.
        // We will strictly follow the request to remove the listed items.
    }

    banner.style.cssText = cssText;

    return banner;
}