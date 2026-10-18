import { type Bridge, BridgeKind, BridgeTerminalLevel } from "@serverkgg/bridge";

const player: Bridge.TerminalArg = {
	key: "player",
	label: {
		ar: "اللاعب",
		en: "Player",
	},
	required: true,
	module: "players",
	column: "name",
};

const listed: Bridge.TerminalArg = {
	key: "player",
	label: {
		ar: "اللاعب",
		en: "Player",
	},
	required: true,
	module: "allowlist",
	column: "name",
};

const operator: Bridge.TerminalArg = {
	key: "player",
	label: {
		ar: "اللاعب",
		en: "Player",
	},
	required: true,
	module: "operators",
	column: "name",
};

const STAMP = String.raw`\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}:\d{3}`;

const PACK_LOAD_ISSUES = /The following issues were found when loading packs:|Unable to find manifest in pack\./;

const SCRIPT_ERROR = /\[Scripting\].*\b(?:SyntaxError|ReferenceError|TypeError)\b/;

export const terminal: Bridge.Terminal = {
	kind: BridgeKind.Terminal,

	commands: [
		{
			name: "stop",
			summary: {
				ar: "يحفظ الماب ويوقف السيرفر.",
				en: "Saves the world and stops the server.",
			},
			danger: true,
		},
		{
			name: "list",
			summary: {
				ar: "يعرض اللاعبين المتصلين.",
				en: "Shows who is online.",
			},
		},
		{
			name: "kick",
			syntax: "kick <player> [reason]",
			summary: {
				ar: "يطرد لاعبًا، ويقبل الاسم أو معرّف اللاعب.",
				en: "Kicks a player. Takes a gamertag or an account id.",
			},
			danger: true,
			args: [
				player,
			],
		},
		{
			name: "allowlist",
			syntax: "allowlist <on|off|list|reload|add|remove> [player]",
			summary: {
				ar: "يتحكم في القائمة البيضاء، وهي الطريقة الوحيدة لمنع لاعب من الدخول في بيدروك.",
				en: "Controls the allowlist, your only way to keep a player out on Bedrock.",
			},
			args: [
				listed,
			],
		},
		{
			name: "permission",
			syntax: "permission <list|reload>",
			summary: {
				ar: "يعرض الصلاحيات أو يعيد قراءتها من الملف.",
				en: "Lists permissions or re-reads the file.",
			},
		},
		{
			name: "op",
			syntax: "op <player>",
			summary: {
				ar: "يعطي اللاعب صلاحية أوبريتر.",
				en: "Makes a player an operator.",
			},
			args: [
				player,
			],
		},
		{
			name: "deop",
			syntax: "deop <player>",
			summary: {
				ar: "يسحب صلاحية الأوبريتر.",
				en: "Takes the operator permission away.",
			},
			args: [
				operator,
			],
		},
		{
			name: "save",
			syntax: "save <hold|query|resume>",
			summary: {
				ar: "يوقف الحفظ ثم يستأنفه، ونستخدمه لأخذ النسخة الاحتياطية.",
				en: "Holds and resumes saving. This is what a backup uses.",
			},
		},
		{
			name: "changesetting",
			syntax: "changesetting <allow-cheats|difficulty> <value>",
			summary: {
				ar: "يغيّر إعدادًا أثناء التشغيل دون ريستارت، لكنه لا يُحفظ.",
				en: "Changes a setting live without a restart, but doesn't save it.",
			},
		},
		{
			name: "difficulty",
			syntax: "difficulty <peaceful|easy|normal|hard>",
			summary: {
				ar: "يغيّر صعوبة اللعب.",
				en: "Changes the difficulty.",
			},
		},
		{
			name: "gamemode",
			syntax: "gamemode <survival|creative|adventure> [player]",
			summary: {
				ar: "يغيّر وضع اللعب.",
				en: "Changes the game mode.",
			},
			args: [
				player,
			],
		},
		{
			name: "time",
			syntax: "time set <day|night|noon|midnight>",
			summary: {
				ar: "يغيّر وقت اليوم.",
				en: "Changes the time of day.",
			},
		},
		{
			name: "weather",
			syntax: "weather <clear|rain|thunder>",
			summary: {
				ar: "يغيّر الطقس.",
				en: "Changes the weather.",
			},
		},
		{
			name: "gamerule",
			syntax: "gamerule <rule> [value]",
			summary: {
				ar: "يعرض أو يغيّر قاعدة من قوانين اللعبة.",
				en: "Shows or changes a game rule.",
			},
		},
		{
			name: "tellraw",
			syntax: "tellraw @a <json>",
			summary: {
				ar: "يرسل رسالة إلى كل اللاعبين، لأن بيدروك لا يحتوي على أمر say.",
				en: "Sends a message to everyone. Bedrock has no say command.",
			},
		},
		{
			name: "title",
			syntax: "title @a title <text>",
			summary: {
				ar: "يعرض عنوانًا كبيرًا على شاشات اللاعبين.",
				en: "Shows a large title on players' screens.",
			},
		},
		{
			name: "give",
			syntax: "give <player> <item> [amount]",
			summary: {
				ar: "يعطي لاعبًا أغراضًا.",
				en: "Gives a player items.",
			},
			args: [
				player,
			],
		},
		{
			name: "clear",
			syntax: "clear [player]",
			summary: {
				ar: "يُفرغ حقيبة اللاعب.",
				en: "Empties a player's inventory.",
			},
			danger: true,
			args: [
				player,
			],
		},
		{
			name: "effect",
			syntax: "effect <player> <effect> [seconds] [amplifier]",
			summary: {
				ar: "يعطي لاعبًا تأثيرًا أو يزيله.",
				en: "Gives a player an effect or clears one.",
			},
			args: [
				player,
			],
		},
		{
			name: "xp",
			syntax: "xp <amount>[L] <player>",
			summary: {
				ar: "يعطي اللاعب خبرة أو مستويات.",
				en: "Gives a player experience or levels.",
			},
			args: [
				player,
			],
		},
		{
			name: "kill",
			syntax: "kill <target>",
			summary: {
				ar: "يقتل اللاعب أو الكائنات المستهدفة.",
				en: "Kills the targeted player or entities.",
			},
			danger: true,
			args: [
				player,
			],
		},
		{
			name: "tp",
			syntax: "tp <player> <destination>",
			summary: {
				ar: "ينقل لاعبًا.",
				en: "Teleports a player.",
			},
			args: [
				player,
			],
		},
		{
			name: "setworldspawn",
			syntax: "setworldspawn [x y z]",
			summary: {
				ar: "يحدد نقطة بداية الماب.",
				en: "Sets the world spawn point.",
			},
		},
		{
			name: "summon",
			syntax: "summon <entity> [x y z]",
			summary: {
				ar: "يستدعي كائنًا.",
				en: "Summons an entity.",
			},
		},
		{
			name: "fill",
			syntax: "fill <from> <to> <block>",
			summary: {
				ar: "يملأ منطقة ببلوك، ويستبدل ما فيها.",
				en: "Fills an area with a block, replacing what's there.",
			},
			danger: true,
		},
		{
			name: "function",
			syntax: "function <name>",
			summary: {
				ar: "يشغّل فنكشن من إضافة سلوك.",
				en: "Runs a function from a behavior pack.",
			},
		},
		{
			name: "scriptevent",
			syntax: "scriptevent <id> <message>",
			summary: {
				ar: "يرسل حدثًا إلى سكربت داخل إضافة.",
				en: "Sends an event to a script inside an add-on.",
			},
		},
	],

	rules: [
		{
			match: /Corruption:|IO error:|LevelDB/,
			level: BridgeTerminalLevel.Error,
		},
		{
			match: /Player (?:connected|disconnected|Spawned):/,
			level: BridgeTerminalLevel.Info,
		},
		{
			match: PACK_LOAD_ISSUES,
			level: BridgeTerminalLevel.Warn,
		},
		{
			match: SCRIPT_ERROR,
			level: BridgeTerminalLevel.Warn,
		},
		{
			match: new RegExp(`^${STAMP} ERROR\\]`),
			level: BridgeTerminalLevel.Error,
		},
		{
			match: new RegExp(`^${STAMP} WARN\\]`),
			level: BridgeTerminalLevel.Warn,
		},
		{
			match: /Unknown command|Syntax error|No targets matched|Could not find|Invalid /i,
			level: BridgeTerminalLevel.Warn,
		},
		{
			match: /Data saved\.|Saving\.\.\.|Changes to the (?:level|world) are (?:saved|resumed)/,
			level: BridgeTerminalLevel.Debug,
		},
		{
			match:
				/^NO LOG FILE!|Starting Server|Version:|Session ID:|Build ID:|Branch:|Commit ID:|Configuration:|Contents of server\.properties:|Level Name:|Game mode:|Difficulty:|Opening level|Pack Stack -|IPv[46] supported, port:|Signed in to signaling service|Accepting clients on|Waiting for Minecraft services/,
			level: BridgeTerminalLevel.Debug,
		},
		{
			match: new RegExp(`^${STAMP} DEBUG\\]`),
			level: BridgeTerminalLevel.Debug,
		},
	],
};
