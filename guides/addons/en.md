## Two kinds of add-on

- **Behavior packs**: change mobs, items and game rules. They run on the server, and players download nothing.
- **Resource packs**: change textures and sounds. Every player downloads them when they join.

## Installing one

You have two routes, and both end up in the same place:

1. **Add-on catalog**: find an add-on and install it with one click.
2. **Upload an add-on**: if you already have a `.mcaddon` or `.mcpack` file, upload it from the same tab.

Install with your server stopped, because an add-on can't go in while the game runs. We install the add-on and activate it on your world, and you start the server again afterwards.

> [!note]
> A single `.mcaddon` file can hold more than one add-on, usually a behavior pack and a resource pack together. We unpack it and install all of them.

## Order matters

If several resource packs change the same thing, the order decides which one wins. You can move them up and down in the list.

> [!warning]
> If you remove a behavior pack that a world was using, everything it added disappears from that world, including the mobs and items it brought with it. Take a backup first.

## Requirements and shared worlds

The installed list includes discovered packs from the active world and server folders. It shows which worlds use each pack and its declared dependencies, including Script API modules. These declarations help diagnose compatibility, but they don't prove that a script loaded successfully.

Installing or enabling a pack checks required pack versions and its declared minimum Minecraft version. Required packs are activated first. Missing dependencies and dependency cycles stop activation. Disable dependent add-ons before disabling a pack they need.

A pack used by another world can't be removed or switched to a different version until those references are removed. This prevents fixing one world from breaking another. Pack changes need a stopped server, and only removing a pack takes a backup first. If an install fails, the previous files come back.

After restarting, open the console and look for content errors. "Installed · load unverified" means the files are present. It doesn't mean the game loaded the add-on.

## Add-on check and repair

The **Add-on check** on the Add-ons tab looks for four problems:

- Add-on files uploaded through **Files** straight into `behavior_packs` or `resource_packs`. The game never opens an archive, so these never load.
- Packs whose folders are on the server but were never activated on the world.
- Required packs that are missing, such as a behavior pack whose resource pack was never installed.
- Add-ons that need **Beta APIs**.

**Repair add-ons** fixes the first two and the last one. We take a backup and stop the game, activate the packs that were never activated, install every add-on file through the same installer an upload uses, turn on Beta APIs when an installed add-on needs it, and start the server again if it was running. A file we can't install stays where it was, and the console says why. A zip that holds no add-on at all is listed as not an add-on and left alone.

> [!note]
> Upload add-ons from the Add-ons tab, not from Files. The tab installs and activates them in one step.

## Beta APIs

Some add-ons use Minecraft's beta scripting, and their scripts only load when the **Beta APIs** experiment is on for the world. The installed list marks them as "Needs Beta APIs".

**Repair add-ons** turns it on for the active world when an installed add-on needs it. Once it's on, it can't be turned off safely, so the backup taken before the repair is your way back.

If we can't read the world's settings file, the check says so, and you can turn it on from your device instead:

1. Open the world on your device.
2. Go to **Settings → Experiments** and turn on **Beta APIs**.
3. Export the world as a `.mcworld` file.
4. Upload it from the **Worlds** tab and activate it.
