# SillyTavern-AvatarBanner
![banners on user and char](/img/screenshot-withuserbanner.png)

Inspired by @Rivelle from [a CSS snippet she shared on SillyTavern's discord](https://discord.com/channels/1100685673633153084/1335308918259454122) and I loved it so I wanted an easier way to set it up, more userfriendly for people who don't want to fumble with CSS or a more accessible way to set the banner. 

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
- **Accent color**: The color that will show on the font and the bottom of the bubble
- **Font family**: It uses [google fonts](https://fonts.google.com). Choose a family (case sensitive, name it the same way it shows on the website), write the name and see the magic happen.
- **Banner size**: The amount of pixels for the banner
- **Font size**: The font size for the name
- **Name Padding**: T/B is for top and botom, L/R for left and right. If your name text shows clipped play with this settings until it shows. If the font looks fine there's no need to touch it. Useful for bigger fonts like '[Pacifico](https://fonts.google.com/specimen/Pacifico)'

![Settings user](/img/screenshot-user.png)
![Settings char](/img/screenshot-char.png)

To select the part of the image you want to see on the banner search for the icon on the respective persona or character and it will open the image cropper, drag the rectangle and press `Save Banner`. Once the banner is set if you press the icon again you can `Edit` the selection or `Remove` to remove the banner and the chat would become a normal one again, banner and styling will disappear.

## Screenshots

![Banners in group chat](/img/screenshot-group.png)

It works on group chats, you have to select the banner per character in their single character settings.

![Banners without user](/img/screenshot-nouserbanner.png)

Image of the chat with the character only banner

## Troubleshoot
If your font doesn't show up after writting the name (it happened to me with the font '[Molle](https://fonts.google.com/specimen/Molle)') you will have to copy the whole @import code. To get this you need to go to the font page, press the button `Get Font` then the bag icon at the top right.

On the next page press `Get Embed Code` and lastly the `@import`. Copy that code on the **Font family** field and it will show the font. 

![troubleshoot 1](/img/Troubleshoot-1.png)
![troubleshoot 2](/img/Troubleshoot-2.png)
![troubleshoot 3](/img/Troubleshoot-3.png)

Do you like the theme from the screenshot. Is my '[Purple Clouds](https://github.com/phampyk/SillyTavern-PurpleCloudsTheme)' theme with cattpuccin frappe colors! and [this wallpaper](https://github.com/notAxon/wallpapers/blob/main/catppuccin/Pink_Flowers_Photograph_by_Lisa_Fotios.jpeg)
