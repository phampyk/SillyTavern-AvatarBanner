const extensionName = 'SillyTavern-AvatarBanner';


export async function getCharacterData(characterId) {
    try {
        const context = SillyTavern.getContext();
        const character = context.characters?.[characterId];
        const data = character?.data?.extensions?.[extensionName];
        return data || {};
    } catch (error) {
        console.error(`[${extensionName}]`, 'Error getting character data:', error);
        return {};
    }
}

export async function getCharacterBanner(characterId) {
    const data = await getCharacterData(characterId);
    return data.banner || null;
}

export async function saveCharacterData(characterId, data) {
    try {
        const context = SillyTavern.getContext();
        const { writeExtensionField } = context;

        if (!writeExtensionField) {
            console.error(`[${extensionName}]`, 'writeExtensionField not available');
            return false;
        }

        // Get existing data to merge
        const existingData = await getCharacterData(characterId);
        const newData = { ...existingData, ...data };

        await writeExtensionField(characterId, extensionName, newData);
        return true;

    } catch (error) {
        console.error(`[${extensionName}]`, 'Error saving character data:', error);
        toastr.error('Failed to save data');
        return false;
    }
}

export async function saveCharacterBanner(characterId, bannerDataUrl) {
    return await saveCharacterData(characterId, { banner: bannerDataUrl });
}

export async function saveCharacterColors(characterId, accentColor, quoteColor) {
    return await saveCharacterData(characterId, { accentColor, quoteColor });
}

export async function removeCharacterBanner(characterId) {
    // We only remove the banner property, keeping colors
    return await saveCharacterData(characterId, { banner: null });
}

let getSettings, saveSettings;

export function initBannerManager(getSettingsFn, saveSettingsFn) {
    getSettings = getSettingsFn;
    saveSettings = saveSettingsFn;
}

export function getUserData(avatarPath) {
    const settings = getSettings();
    const entry = settings.userBanners?.[avatarPath];
    
    // Handle legacy format (string) vs new format (object)
    if (typeof entry === 'string') {
        return { banner: entry };
    }
    return entry || {};
}

export function getUserBanner(avatarPath) {
    const data = getUserData(avatarPath);
    return data.banner || null;
}

export function saveUserData(avatarPath, data) {
    const settings = getSettings();
    if (!settings.userBanners) {
        settings.userBanners = {};
    }
    
    const existing = getUserData(avatarPath);
    settings.userBanners[avatarPath] = { ...existing, ...data };
    
    saveSettings();
}

export function saveUserBanner(userAvatar, bannerDataUrl) {
    saveUserData(userAvatar, { banner: bannerDataUrl });
}

export function saveUserColors(userAvatar, accentColor, quoteColor) {
    saveUserData(userAvatar, { accentColor, quoteColor });
}

export function removeUserBanner(avatarPath) {
    saveUserData(avatarPath, { banner: null });
}

export function createBannerElement(bannerDataUrl, isMoonlit = false) {
    const banner = document.createElement('div');
    banner.className = 'avatar-banner';

    const safeUrl = bannerDataUrl.replace(/"/g, '\\"').replace(/\n/g, '').replace(/\r/g, '');

    // Only set the dynamic background image URL variable
    banner.style.setProperty('--banner-url', `url("${safeUrl}")`);

    return banner;
}