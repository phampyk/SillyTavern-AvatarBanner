/**
 * Avatar Banner Extension - Banner Management
 */
const extensionName = 'SillyTavern-AvatarBanner';

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
        return true;

    } catch (error) {
        console.error(`[${extensionName}]`, 'Error saving character banner:', error);
        toastr.error('Failed to save banner');
        return false;
    }
}

export async function removeCharacterBanner(characterId) {
    try {
        const context = SillyTavern.getContext();
        const { writeExtensionField } = context;

        if (!writeExtensionField) {
            return false;
        }

        await writeExtensionField(characterId, extensionName, { banner: null });
        return true;

    } catch (error) {
        console.error(`[${extensionName}]`, 'Error removing character banner:', error);
        return false;
    }
}

let getSettings, saveSettings;

export function initBannerManager(getSettingsFn, saveSettingsFn) {
    getSettings = getSettingsFn;
    saveSettings = saveSettingsFn;
}

export function getUserBanner(avatarPath) {
    const settings = getSettings();
    return settings.userBanners?.[avatarPath] || null;
}

export function saveUserBanner(userAvatar, bannerDataUrl) {
    const settings = getSettings();
    if (!settings.userBanners) {
        settings.userBanners = {};
    }
    settings.userBanners[userAvatar] = bannerDataUrl;
    saveSettings();
}

export function removeUserBanner(avatarPath) {
    const settings = getSettings();
    delete settings.userBanners[avatarPath];
    saveSettings();
}

export function createBannerElement(bannerDataUrl, height, mesElement, isMoonlit = false) {
    const banner = document.createElement('div');
    banner.className = 'avatar-banner';

    const mesStyle = window.getComputedStyle(mesElement);
    const borderRadius = mesStyle.borderRadius || '0px';

    const safeUrl = bannerDataUrl.replace(/"/g, '\\"').replace(/\n/g, '').replace(/\r/g, '');

    let cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        --banner-height: ${height}px;
        height: var(--banner-height);
        background: url("${safeUrl}") top center no-repeat;
        background-size: cover;
        mask-image: linear-gradient(to bottom, black 60%, rgba(0,0,0,0) 100%);
        -webkit-mask-image: linear-gradient(to bottom, black 60%, rgba(0,0,0,0) 100%);
    `;

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
    }

    banner.style.cssText = cssText;

    return banner;
}