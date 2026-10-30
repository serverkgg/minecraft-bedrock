Create your Minecraft Bedrock server, watch it start, and get your first player in from a phone, Windows or a console.

## Before you start {#before-you-start}

- Minecraft on the device of everyone who'll play: a phone, a tablet, Windows or a console. Everyone plays together on your server.
- A Microsoft account for each player, because playing on servers needs that sign-in.
- Players on Xbox, PlayStation or Switch need one extra step, covered in [the consoles section](/games/minecraft-bedrock/guides/getting-started#consoles).

## 1. Create your server {#create}

From the [New server](/games/create) page, pick Minecraft Bedrock, then a region and a plan. The plan badged **Best fit** is a good start.

After you pay, the order page takes you to your server's panel, and we install and start your server on our own. A notice at the top of the panel offers a few optional steps: name your server, choose who can join, and invite your friends. Press **Continue setup** to do them now, or finish them later. They don't keep your server from running.

## 2. Watch the first start {#first-start}

The first start takes longer, because we download and install the Bedrock server first. Watch it from the **Console** tab, and pick **Bridge** at the top to see only the start steps.

@[open](console)

![The Console tab filtered to Bridge, with the first start's steps and the Running state.](guides/getting-started/first-start.webp)

Your server is ready when the log prints `Server started.` and the server shows **Running**.

## 3. Join from a phone, tablet or Windows {#join}

Your server address is at the top of the **Overview** tab, beside a button that copies it. The number after the colon is the port.

![The server address at the top of the Overview tab, with the port after the colon and a copy button.](guides/getting-started/server-address.webp "Your own address and port show here.")

:::when server.address
Your address:

@[field](server.host)

Your port:

@[field](server.port)

:::else
Your server is still setting up, so it has no address yet. The address appears here as soon as the install finishes.

@[open](console)
:::

Then inside Minecraft:

1. Press **Play**, then open the **Servers** tab
2. Scroll to the bottom of the list and press **Add Server**
3. Type any name in **Server Name**, the address in **Server Address**, and the port in the port field
4. Press **Save**, then pick your server in the list to join

The first time you join, Bedrock asks whether you trust the server. Accept it to continue. It won't ask again.

## 4. Send a command {#console}

Type commands in the box at the bottom of the **Console** tab, without the leading `/`. For example:

@[command](list)

@[command](time set day)

`list` shows who is online, and `time set day` makes it daytime.

![The command box at the bottom of the console, with list typed in.](guides/getting-started/console-command.webp)

The result shows up in the log right away.

> [!note] To stop the server, use the stop button. It sends the `stop` command, which saves the world and then stops the server.

## No Add Server on Xbox, PlayStation or Switch {#consoles}

Xbox, PlayStation and Switch have no in-game list where a player can add a server by its address. Console players join through BedrockConnect, a free open-source project: a DNS setting on the console sends the game's featured servers to a BedrockConnect server, which shows a server list where the player enters your address and port, then moves them to your server.

The DNS addresses the project lists:

- **Xbox** and **Switch**: primary `104.238.130.180`, secondary `8.8.8.8`.
- **PlayStation**: primary `45.55.68.52`, secondary `8.8.8.8`.

1. Open the console's internet settings and enter the two DNS addresses by hand.
2. Open Minecraft, go to the **Servers** tab, and join one of these featured servers: Mineville, Lifeboat, Enchanted, Galaxite or The Hive.
3. The BedrockConnect server list opens. Add your server's address and port there, and join.

On PS5, open **Settings** → **Network** → **Settings** → **Set Up Internet Connection**, then **Advanced Settings** on your connection. On PS4, open **Settings** → **Network** → **Set Up Internet Connection**, pick your connection type, then **Custom**. On both, set **DNS settings** to **Manual**.

> [!note]
> Serverk doesn't run BedrockConnect. The steps and addresses above come from the [project's page](https://github.com/Pugmatt/BedrockConnect), so check there if they change. The project says it has no app on the App Store or Google Play, and any app with its name isn't theirs.

> [!warning]
> BedrockConnect's page doesn't mention NetherNet, the connection Mojang uses for Bedrock servers. If this way in stops working, check the project's page.

## iPhone and iPad players get InitialConnection-13 {#iphone-ipad}

If iPhone and iPad players get `InitialConnection-13` while other players join, it's a Mojang bug in connecting over NetherNet, not a problem with your server. Mojang's bug tracker lists it as BDS-23108.

While your server is on a build older than 1.26.60, switch **Connection transport** to **RakNet (legacy)** in **Settings** and restart. Players keep the same address and port.

@[open](panel:settings)

> [!warning]
> This fix isn't available from 1.26.60 on. Mojang deprecated RakNet in Minecraft 26.60, and the server now shows an error when it isn't on NetherNet. So when your server updates to 1.26.60 or later, we switch **Connection transport** to **NetherNet**, and **Settings** no longer accepts RakNet. Your server's build is on the **Game version** card in **Overview**.

## Players see Outdated Server or Outdated Client {#updates}

A player sees **Outdated Server** when the game on their device is newer than your server, and **Outdated Client** when it's older. For Outdated Client, the player updates Minecraft on their device. For Outdated Server, your server needs the update.

While **Build** in the **Version** tab is set to **Follow the latest build**, your server moves to each new build, and we take a backup first. The **Game updates** card in **Manage** decides when: pick **When empty** and we update once the server has been empty for a few minutes, or right away if it's stopped, or pick **Ask me** and we notify you and update only when you say so. To update right away when a new build is out, press **Update now** on the **Game version** card in **Overview**.

To keep your server on one build, pick its number under **Build**. Your server stays on it until you pick another number or go back to **Follow the latest build**.

@[open](panel:version)

> [!warning]
> Mojang doesn't keep Beta APIs compatible between versions, so any update can change them and break the add-ons that use them. If your add-ons use Beta APIs, pick a build number, and move to the new build after their authors update them. Open the **Add-on check** on the **Add-ons** tab to see which add-ons need them.

## Players are asked again whether they trust the server {#nethernet}

Bedrock connects to your server over NetherNet, the connection Mojang uses for Bedrock servers. The address and port a player types reach your server first, and the game data then runs over a range of ports we reserve for your server. We set `server-port` and `server-udp-ports` in `server.properties` to those ports, so leave them as they are.

With NetherNet, Bedrock asks each player once whether they trust the server, then recognizes it by its identity key. We keep that key in `keys/server_identity_key.pem`, so the question doesn't come back after a restart or an update. If the file is deleted, every player is asked again, and accepting once more is all it takes. Don't share the file with anyone.

## Next {#next}

### Change a setting

Open **Settings** to change the **Server name**, **Player slots**, **Game mode** and **Difficulty**. A change there needs a restart.

@[open](panel:settings)

### Keep it to your friends

Bedrock has no ban, so the allowlist is your way to keep the server to your friends. The details are in the [players guide](/games/minecraft-bedrock/guides/players).

### Worlds and add-ons

Upload a world from your phone and switch between worlds with the [worlds guide](/games/minecraft-bedrock/guides/worlds), and install add-ons with the [add-ons guide](/games/minecraft-bedrock/guides/addons).
