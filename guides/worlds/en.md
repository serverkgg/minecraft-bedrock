## Create, switch and copy worlds

Open **Worlds** to create a named world with an optional seed, upload a `.mcworld`, or switch between existing worlds. A new world generates when the server starts. The seed only affects a world that hasn't generated yet.

World changes need your server stopped. Stop it from the panel, make the change, then start it again. A delete and a reset are the exceptions: the panel stops the server, runs the change, and starts the server again if it was running.

**Copy world** makes an independent copy with a new name. It keeps the original world and its player progress. Shared add-ons remain shared, so check the add-on list before changing them.

## Take a world back to Bedrock

Choose **Export to Files**. After the operation completes, download the `.mcworld` from the `exports` folder in **Files** and open it in Minecraft Bedrock. Exporting again replaces that world's previous export. Delete old exports when you no longer need them.

The export includes the world's files, embedded packs and the exact shared pack versions its activation files reference. A missing pack stops export so you don't receive a world with broken add-on references.

## Upload a world

1. Export your world from Minecraft Bedrock as a `.mcworld` file.
2. Upload it from **Worlds**.
3. Activate it to play on it. An existing world with the same folder name is kept; rename the upload if you need to.

Serverk doesn't convert Java worlds into Bedrock worlds. Upload a Bedrock export. Archives with unsafe paths, unsupported links or excessive expanded size are rejected before installation.

## Turn on hardcore for a world

In hardcore, each player has one life, and a player who dies can't respawn. On Bedrock, hardcore belongs to the world itself, not to the server settings, so you set it for each world.

Hardcore doesn't change the difficulty on a Bedrock server. The server takes it from the **Difficulty** field in **Settings** every time it starts, so pick Hard there for the full hardcore experience.

1. Stop your server.
2. Open **Worlds**, choose **Set hardcore** on the world, then turn the switch on or off.
3. Start your server.

A ✓ in the **Hardcore** column marks each world that has it on. You can turn it off again from the same place at any time.

## Reset world

**Reset world** starts the active world over from its own seed. The server generates it again from the beginning, and builds, inventories and progress start over. On Bedrock a reset always covers the whole world: the Overworld, the Nether and the End together.

1. Activate the world you want to reset. Only the active world can be reset.
2. Open **Worlds**, choose **Reset world** on its row, and confirm.
3. The panel stops the server, resets the world, and starts the server again if it was running.

Nothing is deleted. The current world stays in **Worlds**, renamed with `-old`, and keeps taking its disk space. Activate it to go back to it, or delete it once you're sure you don't need it.

The add-ons activated on the world stay active. Hardcore, game rules and experiments such as Beta APIs belong to the world file, so they go back to their defaults. Set them again after the world generates. If an add-on needs Beta APIs, run **Repair add-ons** in **Add-ons**.

If the world first generated on an older version of the game, the new terrain can differ, because Minecraft changes world generation between versions.

## Reset from a copy

If you uploaded a world you built on, **Reset world** generates the terrain again from the seed, without your builds. **Reset from a copy** puts the active world back to a copy you keep untouched in the list, builds included.

1. Upload the world and activate it. Then choose **Copy world** on its row and save the copy under a name such as `original`. Don't activate or play on the copy.
2. Play on the active world as usual.
3. Whenever you want to start over, choose **Reset from a copy** in **World tools**, type the copy's folder name exactly as the **Folder** column shows it, and confirm.
4. The panel stops the server, copies the world, and starts the server again if it was running.

The copy must stay in **Worlds**. Once you delete it, there's nothing left to reset from. The copy doesn't change when you reset from it, so you can reset from it again whenever you want.

Nothing is deleted. Like **Reset world**, the current world stays in **Worlds**, renamed with `-old`. The copy takes the space of a second full world on your server, and each `-old` world keeps taking its space until you delete it.

The activated add-ons, hardcore and game rules come from the copy, because they're stored in the world's own files.

## Protect your progress

The Overworld, Nether and End share one LevelDB database. The panel doesn't reset individual Bedrock dimensions. Never edit the `db` directory by hand.

The panel takes no backup before a delete or a reset. A reset keeps the old world as `-old`, but a delete is final, so take a backup yourself before you delete a world or make any large change to it. Live backups use Bedrock's fresh save report and copy the reported file boundaries before resuming saving. If the server can't provide a consistent copy, the backup fails instead of pretending an unsafe copy succeeded.
