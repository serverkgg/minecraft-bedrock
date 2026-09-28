import {
	type Bridge,
	BridgeConfirm,
	BridgeControl,
	BridgeFormTarget,
	BridgeIcon,
	BridgeLayout,
	BridgePlace,
	BridgeUploadMode,
} from "@serverkgg/bridge";
import { CHANNEL_VARIABLE, VERSION_VARIABLE } from "../install";
import {
	BedrockTransport,
	PACK_EXTENSIONS,
	PACK_STAGING,
	PROPERTY_KEYS,
	WORLD_EXTENSIONS,
	WORLD_STAGING,
} from "../shared";

const GAME_MODES: Bridge.Option[] = [
	{
		value: "survival",
		label: {
			ar: "البقاء",
			en: "Survival",
		},
	},
	{
		value: "creative",
		label: {
			ar: "الإبداع",
			en: "Creative",
		},
	},
	{
		value: "adventure",
		label: {
			ar: "المغامرة",
			en: "Adventure",
		},
	},
];

const DIFFICULTIES: Bridge.Option[] = [
	{
		value: "peaceful",
		label: {
			ar: "مسالم",
			en: "Peaceful",
		},
	},
	{
		value: "easy",
		label: {
			ar: "سهل",
			en: "Easy",
		},
	},
	{
		value: "normal",
		label: {
			ar: "عادي",
			en: "Normal",
		},
	},
	{
		value: "hard",
		label: {
			ar: "صعب",
			en: "Hard",
		},
	},
];

const PERMISSION_LEVELS: Bridge.Option[] = [
	{
		value: "visitor",
		label: {
			ar: "زائر",
			en: "Visitor",
		},
	},
	{
		value: "member",
		label: {
			ar: "عضو",
			en: "Member",
		},
	},
	{
		value: "operator",
		label: {
			ar: "أوبريتر",
			en: "Operator",
		},
	},
];

const CHAT_RESTRICTIONS: Bridge.Option[] = [
	{
		value: "None",
		label: {
			ar: "بدون قيود",
			en: "None",
		},
	},
	{
		value: "Dropped",
		label: {
			ar: "يُتجاهل",
			en: "Dropped",
		},
	},
	{
		value: "Disabled",
		label: {
			ar: "مقفل",
			en: "Disabled",
		},
	},
];

const TRANSPORTS: Bridge.Option[] = [
	{
		value: BedrockTransport.NetherNet,
		label: {
			ar: "NetherNet",
			en: "NetherNet",
		},
	},
	{
		value: BedrockTransport.RakNet,
		label: {
			ar: "RakNet (القديم)",
			en: "RakNet (legacy)",
		},
	},
];

const MESSAGE_FIELD: Bridge.Field = {
	key: "message",
	control: BridgeControl.Text,
	label: {
		ar: "الرسالة",
		en: "Message",
	},
	maxLength: 200,
};

const REASON_FIELD: Bridge.Field = {
	key: "reason",
	control: BridgeControl.Text,
	label: {
		ar: "السبب",
		en: "Reason",
	},
	maxLength: 100,
};

const versionTab: Bridge.Tab = {
	id: "version",
	title: {
		ar: "النسخة",
		en: "Version",
	},
	icon: BridgeIcon.Tag,
	sections: [
		{
			layout: BridgeLayout.Form,
			id: "channel",
			title: {
				ar: "نسخة السيرفر",
				en: "Server build",
			},
			help: {
				ar: "اختر تشتغل على النسخة العادية ولا نسخة البريفيو، وثبّت رقم نسخة معيّن لو تبي.",
				en: "Choose the release or the preview build, and pin a specific version if you want one.",
			},
			target: BridgeFormTarget.Variables,
			reinstall: true,
			confirm: BridgeConfirm.Strong,
			confirmText: {
				ar: "بنأخذ نسخة للرجوع قبل تركيب النسخة الجديدة. الرجوع من البريفيو يحتاج ماب محفوظة قبل التبديل، مو بس تغيير رقم النسخة.",
				en: "We create a recovery backup before installing the new build. Returning from preview requires a world saved before the switch, not just a different build number.",
			},
			fields: [
				{
					key: CHANNEL_VARIABLE,
					control: BridgeControl.Select,
					label: {
						ar: "القناة",
						en: "Channel",
					},
					help: {
						ar: "البريفيو يجرّب الجديد قبل الكل، ويحتاج كل اللاعبين يكونون على تطبيق Minecraft Preview.",
						en: "Preview tries what is coming next, and needs every player on the Minecraft Preview app.",
					},
					options: [
						{
							value: "release",
							label: {
								ar: "النسخة العادية",
								en: "Release",
							},
						},
						{
							value: "preview",
							label: {
								ar: "بريفيو",
								en: "Preview",
							},
						},
					],
				},
				{
					key: VERSION_VARIABLE,
					control: BridgeControl.Select,
					label: {
						ar: "رقم النسخة",
						en: "Build",
					},
					help: {
						ar: "احتفظ بالنسخة المركّبة، أو اختر رقم النسخة الجديدة عشان تحدّث.",
						en: "Keep the installed build, or select a new build number to update.",
					},
					options: {
						module: "gameVersion",
					},
				},
			],
		},
	],
};

const settingsTab: Bridge.Tab = {
	id: "settings",
	title: {
		ar: "الإعدادات",
		en: "Settings",
	},
	icon: BridgeIcon.Settings,
	sections: [
		{
			layout: BridgeLayout.Form,
			id: "world",
			title: {
				ar: "الماب واللعب",
				en: "World and play",
			},
			help: {
				ar: "اسم السيرفر ووضع اللعب والصعوبة. أي تعديل هنا يبي إعادة تشغيل.",
				en: "Your server name, game mode and difficulty. Anything here needs a restart.",
			},
			target: BridgeFormTarget.Settings,
			module: "settings",
			restartHint: true,
			fields: [
				{
					key: PROPERTY_KEYS.serverName,
					control: BridgeControl.Text,
					label: {
						ar: "اسم السيرفر",
						en: "Server name",
					},
					maxLength: 64,
				},
				{
					key: PROPERTY_KEYS.levelSeed,
					control: BridgeControl.Text,
					label: {
						ar: "السييد",
						en: "Seed",
					},
					help: {
						ar: "يشتغل بس على ماب جديدة ما انبنت بعد.",
						en: "Only used for a world that does not exist yet.",
					},
					maxLength: 64,
				},
				{
					key: PROPERTY_KEYS.gamemode,
					control: BridgeControl.Select,
					label: {
						ar: "وضع اللعب",
						en: "Game mode",
					},
					options: GAME_MODES,
				},
				{
					key: PROPERTY_KEYS.forceGamemode,
					control: BridgeControl.Boolean,
					label: {
						ar: "افرض وضع اللعب",
						en: "Force game mode",
					},
				},
				{
					key: PROPERTY_KEYS.difficulty,
					control: BridgeControl.Select,
					label: {
						ar: "الصعوبة",
						en: "Difficulty",
					},
					options: DIFFICULTIES,
				},
				{
					key: PROPERTY_KEYS.allowCheats,
					control: BridgeControl.Boolean,
					label: {
						ar: "اسمح بالتشيتات",
						en: "Allow cheats",
					},
					warning: {
						ar: "يخلي أوامر اللعبة تشتغل داخل الماب، وهذا يغيّر طريقة اللعب.",
						en: "Turns game commands on inside the world, which changes how it plays.",
					},
				},
				{
					key: PROPERTY_KEYS.maxPlayers,
					control: BridgeControl.Number,
					label: {
						ar: "عدد اللاعبين",
						en: "Player slots",
					},
					min: 1,
					max: 64,
				},
				{
					key: PROPERTY_KEYS.defaultPlayerPermissionLevel,
					control: BridgeControl.Select,
					label: {
						ar: "صلاحية اللاعب الجديد",
						en: "Default permission",
					},
					options: PERMISSION_LEVELS,
				},
			],
		},
		{
			layout: BridgeLayout.Form,
			id: "access",
			title: {
				ar: "الدخول والشات",
				en: "Access and chat",
			},
			help: {
				ar: "مين يقدر يدخل، وكيف يتكلمون.",
				en: "Who can get in, and how they talk.",
			},
			target: BridgeFormTarget.Settings,
			module: "settings",
			restartHint: true,
			fields: [
				{
					key: PROPERTY_KEYS.onlineMode,
					control: BridgeControl.Boolean,
					label: {
						ar: "تحقق من حساب إكس بوكس",
						en: "Require an Xbox account",
					},
					warning: {
						ar: "لو قفلته، بيدروك ما يعطينا أرقام حسابات اللاعبين، وقائمة الأوبريتر بتوقف عن الشغل.",
						en: "Turning it off stops Bedrock giving us player account ids, and the operator list stops working.",
					},
				},
				{
					key: PROPERTY_KEYS.allowList,
					control: BridgeControl.Boolean,
					label: {
						ar: "القائمة البيضاء",
						en: "Allowlist",
					},
					help: {
						ar: "لما تشغّلها، ما يدخل إلا اللي في القائمة — وهذي طريقتك الوحيدة تمنع أحد.",
						en: "With it on, only players on the list can join — and it is your only way to keep someone out.",
					},
				},
				{
					key: PROPERTY_KEYS.transport,
					control: BridgeControl.Select,
					label: {
						ar: "طريقة الاتصال",
						en: "Connection transport",
					},
					help: {
						ar: "خله على NetherNet. هذي الطريقة اللي تدخل فيها نسخ بيدروك الجديدة.",
						en: "Keep it on NetherNet. It is how current Bedrock clients join.",
					},
					warning: {
						ar: "موجانق بيشيل RakNet في نسخة 1.26.60، واللاعبين على النسخ الأحدث ما بيقدرون يدخلون عليه.",
						en: "Mojang removes RakNet in 1.26.60, and players on newer clients cannot join over it.",
					},
					options: TRANSPORTS,
				},
				{
					key: PROPERTY_KEYS.playerIdleTimeout,
					control: BridgeControl.Number,
					label: {
						ar: "طرد الواقف (بالدقائق)",
						en: "Kick idle players after (minutes)",
					},
					min: 0,
					max: 600,
				},
				{
					key: PROPERTY_KEYS.chatRestriction,
					control: BridgeControl.Select,
					label: {
						ar: "قيود الشات",
						en: "Chat restriction",
					},
					options: CHAT_RESTRICTIONS,
				},
				{
					key: PROPERTY_KEYS.disablePlayerInteraction,
					control: BridgeControl.Boolean,
					label: {
						ar: "امنع تفاعل اللاعبين",
						en: "Disable player interaction",
					},
				},
				{
					key: PROPERTY_KEYS.texturepackRequired,
					control: BridgeControl.Boolean,
					label: {
						ar: "الزم أدون المظهر",
						en: "Require the resource pack",
					},
					warning: {
						ar: "أي لاعب يرفض ينزّل الأدون بينطرد من السيرفر.",
						en: "Any player who declines the pack download gets disconnected.",
					},
				},
				{
					key: PROPERTY_KEYS.disableCustomSkins,
					control: BridgeControl.Boolean,
					label: {
						ar: "امنع السكنات المخصصة",
						en: "Disable custom skins",
					},
				},
			],
		},
		{
			layout: BridgeLayout.Form,
			id: "performance",
			title: {
				ar: "الأداء",
				en: "Performance",
			},
			help: {
				ar: "كل ما زدت المسافات، زاد الحمل على السيرفر.",
				en: "The further the server draws, the more work it does.",
			},
			target: BridgeFormTarget.Settings,
			module: "settings",
			restartHint: true,
			fields: [
				{
					key: PROPERTY_KEYS.viewDistance,
					control: BridgeControl.Slider,
					label: {
						ar: "مسافة الرؤية",
						en: "View distance",
					},
					min: 5,
					max: 96,
					step: 1,
				},
				{
					key: PROPERTY_KEYS.tickDistance,
					control: BridgeControl.Slider,
					label: {
						ar: "مسافة التفاعل",
						en: "Tick distance",
					},
					min: 4,
					max: 12,
					step: 1,
				},
				{
					key: PROPERTY_KEYS.maxThreads,
					control: BridgeControl.Number,
					label: {
						ar: "عدد الخيوط",
						en: "Threads",
					},
					min: 0,
					max: 16,
				},
				{
					key: PROPERTY_KEYS.clientSideChunkGeneration,
					control: BridgeControl.Boolean,
					label: {
						ar: "توليد التضاريس عند اللاعب",
						en: "Client-side chunk generation",
					},
				},
			],
		},
	],
};

const playersTab: Bridge.Tab = {
	id: "players",
	title: {
		ar: "اللاعبين",
		en: "Players",
	},
	icon: BridgeIcon.Users,
	sections: [
		{
			layout: BridgeLayout.Table,
			id: "online",
			title: {
				ar: "الحاضرين",
				en: "Online",
			},
			place: BridgePlace.Players,
			module: "players",
			columns: [
				{
					key: "name",
					label: {
						ar: "اللاعب",
						en: "Player",
					},
				},
				{
					key: "xuid",
					label: {
						ar: "رقم الحساب",
						en: "Account id",
					},
				},
			],
			empty: {
				ar: "ما فيه أحد داخل الحين.",
				en: "Nobody is online right now.",
			},
			actions: [
				{
					id: "kick",
					label: {
						ar: "اطرد",
						en: "Kick",
					},
					confirm: BridgeConfirm.Normal,
					fields: [
						REASON_FIELD,
					],
				},
				{
					id: "op",
					label: {
						ar: "خله أوبريتر",
						en: "Make operator",
					},
					confirm: BridgeConfirm.Strong,
					confirmText: {
						ar: "الأوبريتر يقدر يستخدم كل أوامر الإدارة داخل اللعبة، ويغيّر الماب كيف ما يبي.",
						en: "An operator can run every admin command in game and change the world however they like.",
					},
				},
				{
					id: "deop",
					label: {
						ar: "اسحب الأوبريتر",
						en: "Remove operator",
					},
					confirm: BridgeConfirm.Normal,
				},
				{
					id: "gamemode",
					label: {
						ar: "غيّر وضع اللعب",
						en: "Set game mode",
					},
					fields: [
						{
							key: "mode",
							control: BridgeControl.Select,
							label: {
								ar: "الوضع",
								en: "Mode",
							},
							options: GAME_MODES,
						},
					],
				},
				{
					id: "kill",
					label: {
						ar: "اقتله",
						en: "Kill",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "بيموت ويطيح كل اللي معه في مكانه.",
						en: "They die and drop everything they are carrying where they stand.",
					},
				},
			],
		},
		{
			layout: BridgeLayout.Table,
			id: "allowlist",
			title: {
				ar: "القائمة البيضاء",
				en: "Allowlist",
			},
			help: {
				ar: "لما تشغّل القائمة البيضاء من الإعدادات، ما يدخل سيرفرك إلا اللي هنا. في بيدروك ما فيه حظر، فهذي طريقتك.",
				en: "With the allowlist on in Settings, only the players here can join. Bedrock has no ban, so this is your way.",
			},
			place: BridgePlace.Players,
			module: "allowlist",
			columns: [
				{
					key: "name",
					label: {
						ar: "اللاعب",
						en: "Player",
					},
				},
				{
					key: "xuid",
					label: {
						ar: "رقم الحساب",
						en: "Account id",
					},
				},
				{
					key: "seen",
					label: {
						ar: "آخر دخول",
						en: "Last seen",
					},
				},
			],
			add: {
				label: {
					ar: "ضيف لاعب",
					en: "Add a player",
				},
				placeholder: "Gamertag",
			},
			empty: {
				ar: "القائمة فاضية. رقم الحساب يتعبّى لحاله أول ما يدخل اللاعب.",
				en: "The list is empty. The account id fills itself in the first time that player joins.",
			},
			actions: [
				{
					id: "remove",
					label: {
						ar: "شيله",
						en: "Remove",
					},
					confirm: BridgeConfirm.Normal,
					offline: true,
				},
			],
		},
		{
			layout: BridgeLayout.Table,
			id: "operators",
			title: {
				ar: "الأوبريتر",
				en: "Operators",
			},
			help: {
				ar: "بيدروك يحفظ الصلاحيات برقم الحساب، فاللاعب لازم يدخل مرة قبل تقدر تعطيه أوبريتر والسيرفر مطفي.",
				en: "Bedrock stores permissions by account id, so a player has to join once before you can op them while the server is off.",
			},
			place: BridgePlace.Players,
			module: "operators",
			columns: [
				{
					key: "name",
					label: {
						ar: "اللاعب",
						en: "Player",
					},
				},
				{
					key: "xuid",
					label: {
						ar: "رقم الحساب",
						en: "Account id",
					},
				},
				{
					key: "permission",
					label: {
						ar: "الصلاحية",
						en: "Permission",
					},
				},
			],
			add: {
				label: {
					ar: "ضيف أوبريتر",
					en: "Add an operator",
				},
				placeholder: "Gamertag",
			},
			empty: {
				ar: "ما فيه أوبريتر غيرك.",
				en: "Nobody else is an operator.",
			},
			actions: [
				{
					id: "setPermission",
					label: {
						ar: "غيّر الصلاحية",
						en: "Change permission",
					},
					offline: true,
					fields: [
						{
							key: "level",
							control: BridgeControl.Select,
							label: {
								ar: "الصلاحية",
								en: "Permission",
							},
							options: PERMISSION_LEVELS,
						},
					],
				},
				{
					id: "remove",
					label: {
						ar: "شيله",
						en: "Remove",
					},
					confirm: BridgeConfirm.Normal,
					offline: true,
				},
			],
		},
	],
};

const liveTab: Bridge.Tab = {
	id: "live",
	title: {
		ar: "التحكم",
		en: "Controls",
	},
	icon: BridgeIcon.Gamepad,
	sections: [
		{
			layout: BridgeLayout.Actions,
			id: "world",
			title: {
				ar: "الماب",
				en: "World",
			},
			help: {
				ar: "هذي تشتغل على طول على السيرفر الشغّال، وترجع لإعداداتك بعد إعادة التشغيل.",
				en: "These apply to the running server right away, and fall back to your settings after a restart.",
			},
			module: "gameplay",
			actions: [
				{
					id: "timeDay",
					label: {
						ar: "خلها نهار",
						en: "Set day",
					},
				},
				{
					id: "timeNight",
					label: {
						ar: "خلها ليل",
						en: "Set night",
					},
				},
				{
					id: "weatherClear",
					label: {
						ar: "صفّي الجو",
						en: "Clear weather",
					},
				},
				{
					id: "weatherRain",
					label: {
						ar: "نزّل مطر",
						en: "Rain",
					},
				},
				{
					id: "weatherThunder",
					label: {
						ar: "نزّل رعد",
						en: "Thunder",
					},
				},
				{
					id: "difficulty",
					label: {
						ar: "غيّر الصعوبة",
						en: "Set difficulty",
					},
					fields: [
						{
							key: "difficulty",
							control: BridgeControl.Select,
							label: {
								ar: "الصعوبة",
								en: "Difficulty",
							},
							options: DIFFICULTIES,
						},
					],
				},
				{
					id: "allowlistOn",
					label: {
						ar: "شغّل القائمة البيضاء",
						en: "Allowlist on",
					},
				},
				{
					id: "allowlistOff",
					label: {
						ar: "اقفل القائمة البيضاء",
						en: "Allowlist off",
					},
				},
				{
					id: "reloadPermissions",
					label: {
						ar: "أعد قراءة الصلاحيات",
						en: "Reload permissions",
					},
				},
			],
		},
		{
			layout: BridgeLayout.Actions,
			id: "broadcast",
			title: {
				ar: "رسالة للاعبين",
				en: "Message players",
			},
			help: {
				ar: "بيدروك ما فيه أمر say، فنستخدم tellraw.",
				en: "Bedrock has no say command, so we use tellraw.",
			},
			module: "broadcast",
			actions: [
				{
					id: "say",
					label: {
						ar: "أرسل رسالة",
						en: "Send a message",
					},
					fields: [
						MESSAGE_FIELD,
					],
				},
				{
					id: "title",
					label: {
						ar: "اعرض عنوان",
						en: "Show a title",
					},
					fields: [
						MESSAGE_FIELD,
					],
				},
			],
		},
	],
};

const worldsTab: Bridge.Tab = {
	id: "worlds",
	title: {
		ar: "المابات",
		en: "Worlds",
	},
	icon: BridgeIcon.Map,
	sections: [
		{
			layout: BridgeLayout.Actions,
			id: "new-world",
			title: {
				ar: "ماب جديدة",
				en: "New world",
			},
			module: "worldTools",
			actions: [
				{
					id: "create",
					label: {
						ar: "أنشئ ماب وفعّلها",
						en: "Create and activate world",
					},
					confirm: BridgeConfirm.Normal,
					fields: [
						{
							key: "name",
							control: BridgeControl.Text,
							label: {
								ar: "اسم الماب",
								en: "World name",
							},
							maxLength: 64,
						},
						{
							key: "seed",
							control: BridgeControl.Text,
							label: {
								ar: "السييد (اختياري)",
								en: "Seed (optional)",
							},
							maxLength: 64,
						},
					],
				},
			],
		},
		{
			layout: BridgeLayout.Table,
			id: "worlds",
			title: {
				ar: "المابات",
				en: "Worlds",
			},
			help: {
				ar: "أي تغيير على المابات يبي سيرفرك واقف. الحذف بس ناخذ له نسخة استرجاع ونرجّع السيرفر شغّال إذا كان شغّال. على بيدروك الأبعاد كلها في قاعدة بيانات وحدة، فما نقدر نصفّر بُعد لحاله.",
				en: "Every world change needs your server stopped. Only a delete saves a recovery backup and restarts the server if it was running. Bedrock stores all dimensions together, so a single dimension cannot be reset separately.",
			},
			module: "worlds",
			columns: [
				{
					key: "name",
					label: {
						ar: "الاسم",
						en: "Name",
					},
				},
				{
					key: "folder",
					label: {
						ar: "المجلد",
						en: "Folder",
					},
				},
				{
					key: "size",
					label: {
						ar: "الحجم",
						en: "Size",
					},
				},
				{
					key: "active",
					label: {
						ar: "مفعّلة",
						en: "Active",
					},
				},
			],
			upload: {
				label: {
					ar: "ارفع ماب",
					en: "Upload a world",
				},
				extensions: WORLD_EXTENSIONS,
				staging: WORLD_STAGING,
				mode: BridgeUploadMode.File,
			},
			empty: {
				ar: "ما فيه مابات مرفوعة.",
				en: "No worlds uploaded yet.",
			},
			actions: [
				{
					id: "clone",
					label: {
						ar: "انسخ الماب",
						en: "Clone world",
					},
					fields: [
						{
							key: "name",
							control: BridgeControl.Text,
							label: {
								ar: "اسم النسخة",
								en: "Copy name",
							},
							maxLength: 64,
						},
					],
				},
				{
					id: "export",
					label: {
						ar: "صدّر إلى الملفات",
						en: "Export to Files",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "بنجهّز ملف .mcworld داخل مجلد exports في الملفات. تقدر تنزّله وتفتحه في بيدروك.",
						en: "We prepare a .mcworld in the exports folder in Files. Download it and open it in Bedrock.",
					},
				},
				{
					id: "activate",
					label: {
						ar: "فعّلها",
						en: "Activate",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "بنبدّل الماب المفعّلة، ولازم سيرفرك يكون واقف. شغّله بعدها عشان تفتح الماب الجديدة.",
						en: "We switch the active world, and your server must be stopped. Start it again afterwards to open the new world.",
					},
				},
				{
					id: "delete",
					label: {
						ar: "احذفها",
						en: "Delete",
					},
					confirm: BridgeConfirm.Strong,
					confirmText: {
						ar: "حذف الماب يشيل الأوفرورلد والنذر والإند وكل شيء بنيتوه. بنأخذ نسخة للرجوع قبل الحذف؛ لو النسخ فشل، الحذف ما يكمل.",
						en: "Deleting the world removes the Overworld, Nether, End and everything you built. We create a recovery backup first; if backup fails, deletion stops.",
					},
				},
			],
		},
	],
};

const addonsTab: Bridge.Tab = {
	id: "addons",
	title: {
		ar: "الأدونات",
		en: "Add-ons",
	},
	icon: BridgeIcon.Puzzle,
	sections: [
		{
			layout: BridgeLayout.Catalog,
			id: "catalog",
			title: {
				ar: "كتالوج الأدونات",
				en: "Add-on catalog",
			},
			help: {
				ar: "دوّر على أدون وركّبه بضغطة وسيرفرك واقف. نركّبه ونفعّله على مابك، وبعدها شغّل سيرفرك.",
				en: "Install an add-on in one click with your server stopped. We install it and activate it on your world; start your server afterwards.",
			},
			module: "packCatalog",
		},
		{
			layout: BridgeLayout.Detail,
			id: "pack-health",
			title: {
				ar: "فحص الأدونات",
				en: "Add-on check",
			},
			help: {
				ar: "نشيّك على أدونات سيرفرك: ملفات رفعتها وما تركّبت، أدونات موجودة بس مو مفعّلة، متطلبات ناقصة، وأدونات تحتاج Beta APIs.",
				en: "We check your server's add-ons: uploaded files that never installed, packs that are present but not active, missing required packs, and packs that need Beta APIs.",
			},
			module: "packHealth",
			actions: [
				{
					id: "repair",
					label: {
						ar: "صلّح الأدونات",
						en: "Repair add-ons",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "نحفظ نسخة استرجاع ونوقف السيرفر، نركّب ملفات الأدونات اللي ما تركّبت، نفعّل الأدونات اللي مو مفعّلة، ونفعّل Beta APIs إذا فيه أدون يحتاجها، وبعدين نرجّع السيرفر شغّال إذا كان شغّال. Beta APIs إذا تفعّلت ما تنقفل بأمان.",
						en: "We save a recovery backup and stop the server, install the add-on files that never installed, activate the packs that are not active, and turn on Beta APIs if an add-on needs it, then start the server again if it was running. Once Beta APIs is on it cannot be turned off safely.",
					},
				},
			],
		},
		{
			layout: BridgeLayout.Table,
			id: "packs",
			title: {
				ar: "الأدونات المركّبة",
				en: "Installed add-ons",
			},
			help: {
				ar: "أي تغيير يبي سيرفرك واقف. الحذف بس ناخذ له نسخة استرجاع ونرجّع السيرفر شغّال إذا كان شغّال. الترتيب يقرر مين يطلع فوق لو أدونين غيّروا نفس الشي.",
				en: "Every change needs your server stopped. Only removing an add-on saves a recovery backup and restarts the server if it was running. Order decides which pack wins when two change the same thing.",
			},
			module: "packs",
			columns: [
				{
					key: "worlds",
					label: {
						ar: "المابات اللي تستخدمه",
						en: "Used by worlds",
					},
				},
				{
					key: "requirements",
					label: {
						ar: "المتطلبات",
						en: "Requirements",
					},
				},
				{
					key: "load",
					label: {
						ar: "حالة التركيب",
						en: "Install state",
					},
				},
				{
					key: "name",
					label: {
						ar: "الأدون",
						en: "Add-on",
					},
				},
				{
					key: "kind",
					label: {
						ar: "النوع",
						en: "Kind",
					},
				},
				{
					key: "version",
					label: {
						ar: "النسخة",
						en: "Version",
					},
				},
				{
					key: "enabled",
					label: {
						ar: "مفعّل",
						en: "Enabled",
					},
				},
				{
					key: "order",
					label: {
						ar: "الترتيب",
						en: "Order",
					},
				},
			],
			upload: {
				label: {
					ar: "ارفع أدون",
					en: "Upload an add-on",
				},
				extensions: PACK_EXTENSIONS,
				staging: PACK_STAGING,
				mode: BridgeUploadMode.File,
			},
			empty: {
				ar: "ما فيه أدونات مركّبة. ارفع ملف mcaddon أو mcpack وبنركّبه لك.",
				en: "No add-ons installed. Upload a .mcaddon or .mcpack and we install it for you.",
			},
			actions: [
				{
					id: "enable",
					label: {
						ar: "فعّله",
						en: "Enable",
					},
				},
				{
					id: "disable",
					label: {
						ar: "عطّله",
						en: "Disable",
					},
				},
				{
					id: "moveUp",
					label: {
						ar: "حركه فوق",
						en: "Move up",
					},
				},
				{
					id: "moveDown",
					label: {
						ar: "حركه تحت",
						en: "Move down",
					},
				},
				{
					id: "remove",
					label: {
						ar: "احذفه",
						en: "Remove",
					},
					confirm: BridgeConfirm.Strong,
					confirmText: {
						ar: "لو شلت أدون سلوك وماب شغّالة عليه، كل شي جابه الأدون بيختفي من الماب — الوحوش والأشياء اللي أضافها. خذ نسخة احتياطية قبل.",
						en: "If you remove a behavior pack a world was using, everything it added disappears from that world — the mobs and items it brought. Take a backup first.",
					},
				},
			],
		},
	],
};

export const panel: Bridge.Panel = {
	tabs: [
		versionTab,
		settingsTab,
		playersTab,
		liveTab,
		worldsTab,
		addonsTab,
	],
};
