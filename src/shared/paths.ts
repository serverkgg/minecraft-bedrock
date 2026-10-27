export const CONFIG_FILE = "server.properties";

export const ALLOWLIST_FILE = "allowlist.json";

export const PERMISSIONS_FILE = "permissions.json";

export const SERVER_BINARY = "bedrock_server";

export const WORLDS_DIRECTORY = "worlds";

export const BEHAVIOR_PACKS_DIRECTORY = "behavior_packs";

export const RESOURCE_PACKS_DIRECTORY = "resource_packs";

export const LEVEL_FILE = "level.dat";

export const LEVEL_NAME_FILE = "levelname.txt";

export const WORLD_DATABASE_DIRECTORY = "db";

export const PLAYER_LEDGER_FILE = ".serverk-players.json";

export const PACK_SIDECAR_FILE = ".serverk-packs.json";

export const DOWNLOAD_STAGING = ".serverk-download";

export const WORLD_STAGING = ".serverk-uploads/worlds";

export const PACK_STAGING = ".serverk-uploads/packs";

export const WORLD_SCRATCH = ".serverk-staging/world";

export const PACK_SCRATCH = ".serverk-staging/pack";

export const WORLD_EXTENSIONS = [
	"mcworld",
	"mctemplate",
	"zip",
];

export const PACK_EXTENSIONS = [
	"mcaddon",
	"mcpack",
	"zip",
];

export const isUnder = (path: string, directory: string) => {
	return path === directory || path.startsWith(`${directory}/`);
};

export const nameOf = (path: string) => {
	return path.split("/").at(-1) ?? "";
};

export const extensionOf = (path: string) => {
	const name = nameOf(path);
	const dot = name.lastIndexOf(".");

	return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
};

export const withoutExtension = (name: string) => {
	const dot = name.lastIndexOf(".");

	return dot <= 0 ? name : name.slice(0, dot);
};

export const worldPath = (folder: string) => `${WORLDS_DIRECTORY}/${folder}`;
