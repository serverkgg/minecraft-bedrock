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

The first time you join, Bedrock asks whether you trust the server. Accept it and continue. It won't ask again.

> [!note]
> Phones, tablets and Windows can all add servers normally. Xbox, PlayStation and Switch give you no field to add one. That's Microsoft's decision, not Serverk's. Most console players use a DNS app to add servers.

## The first thing to do

Open **Settings** and change the server name, the player slots and the difficulty. Anything you change here needs a restart to take effect.

@[open](files:server.properties)

To control who gets in, open the Players tab and read the allowlist guide.

## The console

The console gives you the same server commands you have in game. Try:

@[command](list)

> [!warning]
> The `stop` command stops the server. Use the stop button in the panel instead, because it takes its time and saves your world properly.
