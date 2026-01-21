/**
 * Avatar Banner Extension - CSS Generation
 */
import { escapeCSS, hexToRgb, rgba } from './utils.js';
import { getFontFamilyName } from './fonts.js';

let dynamicStyleElement = null;

export function getDynamicStyleElement() {
    if (!dynamicStyleElement) {
        dynamicStyleElement = document.createElement('style');
        dynamicStyleElement.id = 'avatar-banner-dynamic-styles';
        document.head.appendChild(dynamicStyleElement);
    }
    return dynamicStyleElement;
}

export function generateExtraStylingCSS(characterName, isUser, settings, displayName = null, isMoonlit = false) {
    const rgb = hexToRgb(settings.accentColor);
    const blurTintVar = isUser ? '--SmartThemeUserMesBlurTintColor' : '--SmartThemeBotMesBlurTintColor';
    const paddingTop = Math.max(settings.bannerHeight - 30, 50);
    const paddingTopMobile = Math.max(Math.round(settings.bannerHeight * 0.45 - 23), 20);
    const parsedFontName = getFontFamilyName(settings.fontFamily);
    const fontFamily = parsedFontName ? `"${parsedFontName}", cursive` : '"Caveat", cursive';
    const fontSize = settings.fontSize || 36;
    const fontSizeMobile = Math.max(Math.round(fontSize * 0.7), 20);
    const namePaddingTB = Number.isFinite(settings.namePaddingTB) ? settings.namePaddingTB : 6;
    const namePaddingLR = Number.isFinite(settings.namePaddingLR) ? settings.namePaddingLR : 10;

    let selector;
    if (isUser) {
        selector = '.mes[is_user="true"]';
    } else {
        const escapedName = escapeCSS(characterName);
        selector = `.mes[ch_name="${escapedName}"]`;
    }

    let css = '';

    css += `#chat ${selector} .ch_name .name_text,\n`;
    css += `#chat ${selector}.moonlit-banner .ch_name .name_text,\n`;
    css += `#chat ${selector} .name_text,\n`; 
    css += `html body #chat ${selector} .name_text,\n`;
    
    if (isUser) {
        css += `#chat .mes[is_user="true"] .name_text,\n`;
    } else {
        css += `#chat .mes[is_user="false"] .name_text,\n`;
    }

    css += `${selector} .ch_name .name_text {\n`;
    css += `    font-size: ${fontSize}px !important;\n`;
    css += `    font-family: ${fontFamily} !important;\n`;
    css += `    line-height: 1.6 !important;\n`;
    css += `    padding: ${namePaddingTB}px ${namePaddingLR}px !important;\n`;
    css += `    overflow: visible !important;\n`;
    css += `    clip: unset !important;\n`;
    css += `    clip-path: none !important;\n`;
    css += `    text-overflow: unset !important;\n`;
    css += `    white-space: normal !important;\n`;
    css += `    min-height: 1.6em !important;\n`;
    css += `    background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.8), ${rgba(rgb, 1)}) !important;\n`;
    css += `    -webkit-background-clip: text !important;\n`;
    css += `    background-clip: text !important;\n`;
    css += `    -webkit-text-fill-color: transparent !important;\n`;
    css += `    color: transparent !important;\n`;
    css += `    text-shadow: none !important;\n`;
    css += `    filter: drop-shadow(0 0 5px ${rgba(rgb, 0.3)}) drop-shadow(0 0 1px rgba(255, 255, 255, 0.3)) !important;\n`;
    css += `}\n\n`;

    css += `${selector} .ch_name,\n`;
    css += `${selector} .mes_block,\n`;
    css += `${selector} .mesIDDisplay,\n`;
    css += `${selector} .mes_text_container {\n`;
    css += `    overflow: visible !important;\n`;
    css += `    text-overflow: unset !important;\n`;
    css += `}\n\n`;

    css += `${selector} .name_text img,\n`;
    css += `${selector} .name_text span,\n`;
    css += `${selector} .name_text svg,\n`;
    css += `${selector} .icon-svg,\n`;
    css += `${selector} .timestamp {\n`;
    css += `    fill: currentColor;\n`;
    css += `    height: 14px;\n`;
    css += `    aspect-ratio: 1;\n`;
    css += `    place-self: unset;\n`;
    css += `    margin-right: 5px;\n`;
    css += `    white-space: nowrap;\n`;
    css += `}\n\n`;
    
    css += `${selector} .mes_button,\n`;
    css += `${selector} .extraMesButtons > div {\n`;
    css += `    place-self: center baseline;\n`;
    css += `    align-self: center;\n`;
    css += `    font-size: 14px;\n`;
    css += `    padding: 5px;\n`;
    css += `    margin-left: 3px;\n`;
    css += `    border-radius: 50%;\n`;
    css += `    background: linear-gradient(to bottom, ${rgba(rgb, 0.8)}, rgba(255, 255, 255, 0.5));\n`;
    css += `    color: rgba(255, 255, 255, 0.9);\n`;
    css += `    box-shadow: 0 0 5px ${rgba(rgb, 0.8)};\n`;
    css += `    transition: all 0.3s ease-in-out;\n`;
    css += `}\n\n`;
    
    if (!isMoonlit) {
        if (isUser) {
            css += `#chat ${selector} {\n`;
            css += `    position: relative;\n`;
            css += `    padding: 15px 25px 15px 25px !important;\n`;
            css += `    background:\n`;
            css += `        linear-gradient(to bottom, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0) 90%, ${rgba(rgb, 0.5)} 100%),\n`;
            css += `        var(${blurTintVar});\n`;
            css += `    border: ${rgba(rgb, 0.7)} solid 2px !important;\n`;
            css += `    box-shadow: 3px 3px 10px ${rgba(rgb, 0.25)} !important;\n`;
            css += `}\n\n`;

            css += `#chat ${selector}.has-avatar-banner {\n`;
            css += `    padding-top: ${paddingTop}px !important;\n`;
            css += `}\n\n`;
            
            css += `@media screen and (max-width: 768px) {\n`;
            css += `    #chat ${selector} {\n`;
            css += `        padding: 10px 15px 10px 15px !important;\n`;
            css += `    }\n`;
            css += `    #chat ${selector}.has-avatar-banner {\n`;
            css += `        padding-top: ${paddingTopMobile}px !important;\n`;
            css += `    }\n`;
            css += `    ${selector} .name_text {\n`;
            css += `        font-size: ${fontSizeMobile}px !important;\n`;
            css += `        padding: ${namePaddingTB}px ${namePaddingLR}px !important;\n`;
            css += `    }\n`;
            css += `}\n\n`;
        } else {
            css += `#chat ${selector}.has-avatar-banner {\n`;
            css += `    position: relative;\n`;
            css += `    padding: ${paddingTop}px 25px 15px !important;\n`;
            css += `    background:\n`;
            css += `        linear-gradient(to bottom, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0) 90%, ${rgba(rgb, 0.5)} 100%),\n`;
            css += `        var(${blurTintVar});\n`;
            css += `    border: ${rgba(rgb, 0.7)} solid 2px !important;\n`;
            css += `    box-shadow: 3px 3px 10px ${rgba(rgb, 0.25)} !important;\n`;
            css += `}\n\n`;
            
            css += `@media screen and (max-width: 768px) {\n`;
            css += `    #chat ${selector}.has-avatar-banner {\n`;
            css += `        padding: ${paddingTopMobile}px 15px 10px !important;\n`;
            css += `    }\n`;
            css += `    ${selector} .name_text {\n`;
            css += `        font-size: ${fontSizeMobile}px !important;\n`;
            css += `        padding: ${namePaddingTB}px ${namePaddingLR}px !important;\n`;
            css += `    }\n`;
            css += `}\n\n`;
        }

        css += `#chat ${selector} .avatar {\n`;
        css += `    display: none !important;\n`;
        css += `}\n\n`;
    } else {
        const moonlitSelector = `#chat .mes${selector}.moonlit-banner .mes_block`;
        
        css += `html body ${moonlitSelector},\n`;
        css += `${moonlitSelector} {\n`;
        css += `    background:\n`;
        css += `        linear-gradient(to bottom, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0) 90%, ${rgba(rgb, 0.5)} 100%),\n`;
        css += `        var(${blurTintVar});\n`;
        css += `    border: ${rgba(rgb, 0.7)} solid 2px !important;\n`;
        css += `    box-shadow: 3px 3px 10px ${rgba(rgb, 0.25)} !important;\n`;
        css += `}\n\n`;

        css += `html body #chat .mes${selector}.moonlit-banner .avatar,\n`;
        css += `#chat .mes${selector}.moonlit-banner .avatar {\n`;
        css += `    display: none !important;\n`;
        css += `    visibility: hidden !important;\n`;
        css += `    opacity: 0 !important;\n`;
        css += `    width: 0 !important;\n`;
        css += `    height: 0 !important;\n`;
        css += `    margin: 0 !important;\n`;
        css += `}\n\n`;
    }

    return css;
}