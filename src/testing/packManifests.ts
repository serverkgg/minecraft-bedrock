import { type PackManifest, parsePackManifest } from "../packs";

export interface FixturePack {
	uuid: string;
	name: string;
	version: number[];
	engine: number[];
	modules: string[];
	dependencies: (
		| {
				uuid: string;
				version?: number[];
		  }
		| {
				module_name: string;
				version: string | number[];
		  }
	)[];
}

export const BEANS_BP_UUID = "1540965b-552e-4304-8175-c914e756821b";

export const BEANS_RP_UUID = "01cf9f1a-ff90-41b5-b844-77251387d9ef";

export const HAMMERS_BP_UUID = "2dc25948-6598-43a4-b138-7e117a82c1f1";

export const HAMMERS_RP_UUID = "394c213a-0a76-4208-8ba2-a305c575e919";

export const ADMIN_UTILS_BP_UUID = "9bf627d5-d1e0-4195-b581-897a2a34f372";

export const ADMIN_UTILS_RP_UUID = "7477870a-d721-44a1-beb6-5b39f9049e27";

export const BEANS_BP_4_2: FixturePack = {
	uuid: BEANS_BP_UUID,
	name: "pack.name",
	version: [
		4,
		0,
		2,
	],
	engine: [
		1,
		21,
		50,
	],
	modules: [
		"data",
		"script",
	],
	dependencies: [
		{
			uuid: BEANS_RP_UUID,
			version: [
				4,
				0,
				1,
			],
		},
		{
			module_name: "@minecraft/server",
			version: [
				2,
				4,
				0,
			],
		},
	],
};

export const BEANS_RP_4_2: FixturePack = {
	uuid: BEANS_RP_UUID,
	name: "pack.name",
	version: [
		4,
		0,
		2,
	],
	engine: [
		1,
		21,
		50,
	],
	modules: [
		"resources",
	],
	dependencies: [
		{
			uuid: BEANS_RP_UUID,
			version: [
				4,
				0,
				2,
			],
		},
	],
};

export const BEANS_BP_4_3: FixturePack = {
	...BEANS_BP_4_2,
	version: [
		4,
		0,
		3,
	],
};

export const BEANS_RP_4_3: FixturePack = {
	...BEANS_RP_4_2,
	version: [
		4,
		0,
		3,
	],
};

export const HAMMERS_BP: FixturePack = {
	uuid: HAMMERS_BP_UUID,
	name: "§eVanilla Hammers §l§6[BP] §r- §a§o(Compatibility with Achievements)",
	version: [
		3,
		1,
		0,
	],
	engine: [
		1,
		20,
		80,
	],
	modules: [
		"data",
		"script",
	],
	dependencies: [
		{
			uuid: HAMMERS_RP_UUID,
			version: [
				3,
				1,
				0,
			],
		},
		{
			module_name: "@minecraft/server",
			version: "2.5.0",
		},
		{
			module_name: "@minecraft/server-ui",
			version: "2.0.0",
		},
	],
};

export const HAMMERS_RP: FixturePack = {
	uuid: HAMMERS_RP_UUID,
	name: "§eVanilla Hammers §l§6[RP] §r- §a§o(Compatibility with Achievements)",
	version: [
		3,
		1,
		0,
	],
	engine: [
		1,
		20,
		80,
	],
	modules: [
		"resources",
	],
	dependencies: [
		{
			uuid: HAMMERS_BP_UUID,
			version: [
				3,
				1,
				0,
			],
		},
	],
};

export const ADMIN_UTILS_BP: FixturePack = {
	uuid: ADMIN_UTILS_BP_UUID,
	name: "§l§o§cAdmin§aUtils §b[26.50]",
	version: [
		1,
		1,
		23,
	],
	engine: [
		1,
		26,
		50,
	],
	modules: [
		"data",
		"script",
	],
	dependencies: [
		{
			uuid: ADMIN_UTILS_RP_UUID,
			version: [
				1,
				1,
				23,
			],
		},
		{
			module_name: "@minecraft/server",
			version: "2.11.0-beta",
		},
		{
			module_name: "@minecraft/server-ui",
			version: "2.3.0-beta",
		},
	],
};

export const ADMIN_UTILS_RP_DARK: FixturePack = {
	uuid: ADMIN_UTILS_RP_UUID,
	name: "§l§o§cAdmin§aUtils §b[26.50]",
	version: [
		1,
		1,
		23,
	],
	engine: [
		1,
		26,
		50,
	],
	modules: [
		"resources",
	],
	dependencies: [
		{
			uuid: ADMIN_UTILS_BP_UUID,
			version: [
				1,
				1,
				23,
			],
		},
	],
};

export const manifestText = (pack: FixturePack) => {
	return JSON.stringify({
		format_version: 2,
		header: {
			name: pack.name,
			description: "pack.description",
			min_engine_version: pack.engine,
			uuid: pack.uuid,
			version: pack.version,
		},
		modules: pack.modules.map((type) => ({
			type,
		})),
		dependencies: pack.dependencies,
	});
};

export const manifestOf = (pack: FixturePack): PackManifest => {
	const manifest = parsePackManifest(manifestText(pack));
	if (manifest === null) {
		throw new Error("invalid fixture");
	}
	return manifest;
};
