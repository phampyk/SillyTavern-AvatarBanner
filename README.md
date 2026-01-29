# SillyTavern-AvatarBanner
![banners on user and char](/img/screenshot-withuserbanner.png)

Inspired by @Rivelle from [a CSS snippet she shared on SillyTavern's discord](https://discord.com/channels/1100685673633153084/1335308918259454122) and I loved it so I wanted an easier way to set it up, more userfriendly for people who don't want to fumble with CSS or a more accessible way to set the banner. 

---

### Updates

**21/01**: Now with compatibility with [Moonlit Echoes theme](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme). If you have Moonlit Echoes installed it will apply to the bubble and flat style automatically. No other styles would be affected, they are already beautifully crafted.

**29/01**: Added more personalization by uploading a second image to use as a banner, editing the accent color and the quote color per character and persona. Added banner into the character panel

> [!Important]
> This extension has been created with Claude. Vibecoded if you will. If you don't trust it, you don't like it or you don't support it is absolutely fine, this was to scratch my own itch more than anything and I use it myself.

## How to install

Copy the github URL into the extension tab > Install extension

```
https://github.com/phampyk/SillyTavern-AvatarBanner/
```

## How to use
![Settings screenshot](/img/screenshot-settings.png)

- **Enable Avatar Banners**: Enable or disable the whole extension. Quick way to disable all the changes
- **Enable Persona Banners**: Do you want the persona bubble to have avatar or not, up to you. This setting is global and affects all chats
- **Enable Extra Styling**: The chat gradation at the bottom and the different font can be disabled. In case you don't want it or you want to apply your own CSS style on ST settings. If this is disabled only the banners will show
- **Enable Panel Banner**: Enable or disable the character panel banner. Independant from the chat banner, you can have the character panel banner only.
- **Accent color**: The color that will show on the font and the bottom of the bubble
- **Font family**: It uses [google fonts](https://fonts.google.com). Choose a family (case sensitive, name it the same way it shows on the website), write the name and see the magic happen.
- **Banner size**: The amount of pixels for the banner
- **Font size**: The font size for the name
- **Name Padding**: T/B is for top and botom, L/R for left and right. If your name text shows clipped play with this settings until it shows. If the font looks fine there's no need to touch it. Useful for bigger fonts like '[Pacifico](https://fonts.google.com/specimen/Pacifico)'

![Settings char](/img/screenshot-char.png)

You will find the buttons and color pickers on the character and persona character.

- The `panorama icon` will let you crop what part of the avatar you want as a banner
- The `upload icon` will let you upload or delete an extra image to use as a banner
- The `edit button` will let you recrop whatever image you already have as a banner or remove the banner completely
- The `accent color` picker will change the name, border and bottom gradient color
- The `quote color` will change the color for the quote text of the character (whatever is between " ")
- If you want to restart the colors to the default ones press the arrow

## Screenshots

![Banners in group chat](/img/screenshot-group.png)

It works on group chats, you have to select the banner per character in their single character settings.

![Banners in group chat with customization](/img/screenshot-groupwithcolors.png)

Group with different colors per character, to help differentiate each character.

![Banners without user](/img/screenshot-nouserbanner.png)

Image of the chat with the character only banner.

![Banners on the character panel](/img/screenshot-characterpanel.png)

The character panel shows the banner too for the ✨ A E S T H E T I C S ✨

## Troubleshoot
If your font doesn't show up after writting the name (it happened to me with the font '[Molle](https://fonts.google.com/specimen/Molle)') you will have to copy the whole @import code. To get this you need to go to the font page, press the button `Get Font` then the bag icon at the top right.

On the next page press `Get Embed Code` and lastly the `@import`. Copy that code on the **Font family** field and it will show the font. 

![troubleshoot 1](/img/Troubleshoot-1.png)
![troubleshoot 2](/img/Troubleshoot-2.png)
![troubleshoot 3](/img/Troubleshoot-3.png)

Do you like the theme from the screenshot. Is my '[Purple Clouds](https://github.com/phampyk/SillyTavern-PurpleCloudsTheme)' theme with cattpuccin frappe colors! and [this wallpaper](https://github.com/notAxon/wallpapers/blob/main/catppuccin/Pink_Flowers_Photograph_by_Lisa_Fotios.jpeg)
