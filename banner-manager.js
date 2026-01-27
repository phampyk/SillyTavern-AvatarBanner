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

export async function saveCharacterBanner(characterId, bannerDataUrl, sourceDataUrl = undefined) {
    const data = { banner: bannerDataUrl };
    if (sourceDataUrl !== undefined) data.source = sourceDataUrl;
    return await saveCharacterData(characterId, data);
}

export async function saveCharacterColors(characterId, accentColor, quoteColor) {
    return await saveCharacterData(characterId, { accentColor, quoteColor });
}

export async function removeCharacterBanner(characterId) {
    // Only remove the active banner, preserving the source for re-cropping
    return await saveCharacterData(characterId, { banner: "" });
}

export async function deleteCharacterCustomImage(characterId) {
    // Completely remove both banner and source image
    return await saveCharacterData(characterId, { banner: "", source: "" });
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

export function saveUserBanner(userAvatar, bannerDataUrl, sourceDataUrl = undefined) {
    const data = { banner: bannerDataUrl };
    if (sourceDataUrl !== undefined) data.source = sourceDataUrl;
    saveUserData(userAvatar, data);
}

export function saveUserColors(userAvatar, accentColor, quoteColor) {
    saveUserData(userAvatar, { accentColor, quoteColor });
}

export function removeUserBanner(avatarPath) {
    saveUserData(avatarPath, { banner: "" });
}

export function deleteUserCustomImage(avatarPath) {
    saveUserData(avatarPath, { banner: "", source: "" });
}