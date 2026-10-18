## Bedrock has no ban

This is the first thing to know, especially coming from Java: a Bedrock server has no ban command at all. There's no `ban` and no banned-players list. You get two things:

- **Kick** (`kick`): removes a player now, but they can walk straight back in.
- **The allowlist**: this is your real way to keep someone out.

## The allowlist

Once it's on, nobody joins your server unless their name is on it. So to keep a player out: turn the list on, and make sure their name isn't on it.

@[command](allowlist on)

And to add someone:

@[command](allowlist add PlayerName)

> [!warning]
> The moment you turn the allowlist on, every player who isn't on it is locked out, not just the one you wanted to stop. Add all of your friends before you turn it on.

With the allowlist on and the list empty, nobody can join, you included. So add your players first: in **Players**, type each gamertag in **Add a player** on the **Allowlist** table, with the server running or stopped. You can add a player who has never joined, and their account id fills in the first time they join. Then turn the allowlist on in **Settings**, or with **Allowlist on** in **Controls** while the server runs. **Controls** applies it right away; to keep it on after a restart, turn it on in **Settings** too.

The name you type is the player's gamertag. If it has a space in it, wrap it in quotes.

## Operators

An operator is a player who can run admin commands in game. While the server is running, one command does it:

@[command](op PlayerName)

> [!note]
> Bedrock stores permissions by account id (XUID), not by name, and we only learn a player's id after they join once. So if the server is stopped and that player has never joined, we can't make them an operator. Start the server, let them join once, and then you can make them an operator any time.

Because it's stored by account id, a player who changes their gamertag keeps their permissions.

## Require an Xbox account {#online-mode}

**Require an Xbox account** (`online-mode`) in **Settings** is on by default. Keep it on: Microsoft recommends it for any server open to the internet. With it off, Bedrock stops sending player account ids, so the operator list stops working. We haven't verified what the allowlist does with it off, so don't rely on the allowlist to keep anyone out then.
