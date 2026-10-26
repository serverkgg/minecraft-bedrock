## What the preview build is

Preview is where Microsoft tries new things before they reach everyone. You can run your server on it if you want to try something new ahead of the crowd.

## Before you switch

> [!danger]
> A world opened on preview doesn't come back to the release build. Preview upgrades your world data to a newer format that the release build can't read. This can't be undone.

Changing the version takes a backup before switching. To return safely, restore that pre-switch backup with its recorded runtime version. Installing an older build alone can't undo changes to the world.

## Players need the same build

Only players who have the Minecraft Preview app installed can join a preview server. The normal game can't.

So if you switch, all of your friends have to switch with you.

## When to use it

- You want to try a new feature before it ships.
- You're building an add-on and want to test it against the new format.

If neither is true, stay on the release build. It's the steadier one, and it's the one all of your friends can already join.

## Updates

While **Build** is set to **Follow the latest build**, your server moves to each new preview build once no one is playing, with a backup first. A preview server never moves to the release channel on its own. To keep your server on one build, pick its number under **Build**. Backups also keep the installed build details. If the requested build isn't available, the operation stops and tells you, instead of quietly installing another one.

Your players' games usually update on their own, so after each new build players see **Outdated Server** until your server updates, and preview builds come out often. An update can also break add-ons that use Beta APIs. If yours use them, pick a build number, and open the **Add-on check** on the **Add-ons** tab to see which add-ons need them. The details are in [Getting started](/games/minecraft-bedrock/guides/getting-started#updates).
