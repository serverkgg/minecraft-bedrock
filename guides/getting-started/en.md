## Your server is ready

Your Bedrock server runs from the first moment and needs no setup to work. All you need is the address and the port:

@[field](server.address)

:::when server.address
Put the address in the **Server Address** field and the port in the **Port** field. Bedrock keeps them apart, unlike Java.
:::else
The server is still being set up. Your address will appear here as soon as it's done.
:::

## Joining from your device

It's almost the same everywhere: open the game, choose **Play**, open the **Servers** tab, and scroll down to **Add Server**.

1. **Server Name**: anything you like. It's only for you.
2. **Server Address**: the address above, without the port.
3. **Port**: the number above.

Hit **Save** and your server appears in the list.

## Joining from Xbox, PlayStation or Switch {#consoles}

Phones, tablets and Windows add a server with the steps above. Xbox, PlayStation and Switch give you no field to add one. That's Microsoft's decision, not Serverk's. Console players join through BedrockConnect, a free open-source project: a DNS setting on the console sends the game's featured servers to a BedrockConnect server, which shows a server list where the player types your address and port.

The DNS addresses the project lists for its main server:

- **Xbox** and **Switch**: primary DNS `104.238.130.180`, secondary DNS `8.8.8.8`.
- **PlayStation**: primary DNS `45.55.68.52`, secondary DNS `8.8.8.8`.

1. Open the console's internet settings and enter the two DNS addresses by hand.
2. Open Minecraft, go to the **Servers** tab, and join one of the featured servers that support the redirect: Mineville, Lifeboat, Enchanted, Galaxite or The Hive.
3. The BedrockConnect server list opens. Enter your server's address and port there, and join.

On PS5, the DNS is under **Settings** → **Network** → **Settings** → **Set Up Internet Connection** → **Advanced Settings**, where you set **DNS Settings** to **Manual**. On PS4, open **Settings** → **Network** → **Set Up Internet Connection**, pick your connection type, then **Custom**, set **DNS Settings** to **Manual**, and leave the other screens on **Automatic**, **Do Not Specify** or **Do Not Use**.

> [!note]
> Serverk doesn't run BedrockConnect and hasn't tested it with our servers. The steps and addresses above come from the [project's page](https://github.com/Pugmatt/BedrockConnect), so check there if they change. The project says it has no app on the App Store or Google Play, and any app with its name isn't theirs.

> [!warning]
> BedrockConnect hasn't announced NetherNet support. Minecraft 26.60 removes RakNet, the old connection method, so this way in may stop working with 26.60 until the project adds NetherNet.

## How players connect {#nethernet}

Bedrock connects to your server over NetherNet, Mojang's new connection method. The address and port a player types reach your server first, and the game data then runs over a range of ports we reserve for your server. We set those ports on every start, so a change you make to `server-port` or `server-udp-ports` in `server.properties` is replaced on the next start.

The first time you join, Bedrock asks whether you trust the server. Accept it and continue. It won't ask again.

### iPhone and iPad players {#iphone-ipad}

If iPhone and iPad players get `InitialConnection-13` while Windows and Android players join, it's a Mojang bug in NetherNet signaling, not a problem with your server. Until Minecraft 26.60, switch **Connection transport** to **RakNet** in **Settings** and restart. Players keep the same address and port.

@[open](panel:settings)

> [!warning]
> Minecraft 26.60 removes RakNet from both the game and the server, so no player on 26.60 can join over it. When you update your server to 26.60, we switch **Connection transport** back to **NetherNet** as it starts, and **Settings** no longer accepts **RakNet**.

## The first thing to do

Open **Settings** and change the server name, the player slots and the difficulty. Anything you change here needs a restart to take effect.

@[open](files:server.properties)

To control who gets in, open the Players tab and read the allowlist guide.

## Updates {#updates}

Your server stays on the build it has installed. A restart doesn't change it, and we don't update it for you. To update, open **Version** and pick the new build number under **Build**. We take a backup before installing it.

@[open](panel:version)

Minecraft on your players' devices, from phones to consoles and Windows, usually updates on its own. So after each new Mojang release, players see **Outdated Server** until you update your server. A player who sees **Outdated Client** has an older game than your server and needs to update it.

> [!warning]
> An update can break add-ons that use Beta APIs. Those APIs change with almost every major Minecraft release, so such an add-on may stop loading until its author updates it. Before you update, open the **Add-on check** on the **Add-ons** tab to see which add-ons need Beta APIs.

## The console

The console gives you the same server commands you have in game. Try:

@[command](list)

> [!warning]
> The `stop` command stops the server. Use the stop button in the panel instead, because it takes its time and saves your world properly.
