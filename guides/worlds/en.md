## Create, switch and copy worlds

Open **Worlds** to create a named world with an optional seed, upload a `.mcworld`, or switch between existing worlds. A new world generates when the server starts. The seed only affects a world that hasn't generated yet.

World changes need your server stopped. Stop it from the panel, make the change, then start it again. Only a delete runs as a protected operation: the panel takes a backup, stops the server, deletes the world, and starts the server again if it was running. If the backup fails, nothing is deleted.

**Copy world** makes an independent copy with a new name. It keeps the original world and its player progress. Shared add-ons remain shared, so check the add-on list before changing them.

## Take a world back to Bedrock

Choose **Export to Files**. After the operation completes, download the `.mcworld` from the `exports` folder in **Files** and open it in Minecraft Bedrock. Exporting again replaces that world's previous export. Delete old exports when you no longer need them.

The export includes the world's files, embedded packs and the exact shared pack versions its activation files reference. A missing pack stops export so you don't receive a world with broken add-on references.

## Upload a world

1. Export your world from Minecraft Bedrock as a `.mcworld` file.
2. Upload it from **Worlds**.
3. Activate it to play on it. An existing world with the same folder name is kept; rename the upload if you need to.

Serverk doesn't convert Java worlds into Bedrock worlds. Upload a Bedrock export. Archives with unsafe paths, unsupported links or excessive expanded size are rejected before installation.

## Protect your progress

The Overworld, Nether and End share one LevelDB database. The panel doesn't reset individual Bedrock dimensions. Never edit the `db` directory by hand.

A recovery backup covers a delete only, so take one yourself before any large change to your world. Live backups use Bedrock's fresh save report and copy the reported file boundaries before resuming saving. If the server can't provide a consistent copy, the backup fails instead of pretending an unsafe copy succeeded.
