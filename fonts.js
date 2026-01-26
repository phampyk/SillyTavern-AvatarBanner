function parseFontInput(input) {
    if (!input || typeof input !== 'string' || input.trim() === '') {
        return { importStatement: '', fontFamily: '' };
    }

    const trimmed = input.trim();
    let url = null;
    let fontFamily = null;

    const urlMatch = trimmed.match(/https:\/\/fonts\.googleapis\.com\/css2?\?[^"'\s)]+/);

    if (urlMatch) {
        url = urlMatch[0];
        const familyMatch = url.match(/family=([^&:]+)/);
        if (familyMatch) {
            fontFamily = decodeURIComponent(familyMatch[1].replace(/\+/g, ' '));
        }
        return {
            importStatement: `@import url('${url}');`,
            fontFamily: fontFamily || ''
        };
    }

    fontFamily = trimmed;
    const formattedName = fontFamily.replace(/\s+/g, '+');
    url = `https://fonts.googleapis.com/css2?family=${formattedName}&display=swap`;

    return {
        importStatement: `@import url('${url}');`,
        fontFamily: fontFamily
    };
}

export function getFontFamilyName(input) {
    const parsed = parseFontInput(input);
    return parsed.fontFamily;
}

export function getGoogleFontImport(input) {
    const parsed = parseFontInput(input);
    if (!parsed.importStatement) return '';

    return parsed.importStatement;
}

let dynamicStyleElement = null;

export function getDynamicStyleElement() {
    if (!dynamicStyleElement) {
        dynamicStyleElement = document.createElement('style');
        dynamicStyleElement.id = 'avatar-banner-dynamic-styles';
        document.head.appendChild(dynamicStyleElement);
    }
    return dynamicStyleElement;
}

export function preloadGoogleFont(input, forceReload, ExtensionState) {
    const parsed = parseFontInput(input);
    if (!parsed.importStatement) return;

    const urlMatch = parsed.importStatement.match(/url\(['"]?([^'"]+)['"]?\)/);
    if (!urlMatch) return;

    const fontUrl = urlMatch[1];

    if (!forceReload && ExtensionState.currentLoadedFont === fontUrl) {
        return;
    }

    ExtensionState.currentLoadedFont = fontUrl;

    const oldPreload = document.getElementById('avatar-banner-font-preload');
    if (oldPreload) oldPreload.remove();

    const preload = document.createElement('link');
    preload.id = 'avatar-banner-font-preload';
    preload.rel = 'preload';
    preload.as = 'style';
    preload.href = forceReload ?
        fontUrl + (fontUrl.includes('?') ? '&' : '?') + `_cb=${Date.now()}` :
        fontUrl;

    document.head.appendChild(preload);

    const oldLink = document.getElementById('avatar-banner-font-link');
    if (oldLink) oldLink.remove();
    
    const link = document.createElement('link');
    link.id = 'avatar-banner-font-link';
    link.rel = 'stylesheet';
    link.href = forceReload ?
        fontUrl + (fontUrl.includes('?') ? '&' : '?') + `_cb=${Date.now()}` :
        fontUrl;
    
    document.head.appendChild(link);
}