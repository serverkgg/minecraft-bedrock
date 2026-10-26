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
	DIFFICULTIES,
	GAME_MODES,
	PACK_EXTENSIONS,
	PACK_STAGING,
	PERMISSION_LEVELS,
	PROPERTY_KEYS,
	WORLD_EXTENSIONS,
	WORLD_STAGING,
} from "../shared";

const CHAT_RESTRICTIONS: Bridge.Option[] = [
	{
		value: "None",
		label: {
			ar: "دون قيود",
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
			ar: "موقوف",
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
		ar: "الإصدار",
		en: "Version",
	},
	icon: BridgeIcon.Tag,
	sections: [
		{
			layout: BridgeLayout.Form,
			id: "channel",
			title: {
				ar: "إصدار السيرفر",
				en: "Server build",
			},
			help: {
				ar: "اختر الإصدار العادي أو البريفيو. يتابع السيرفر أحدث إصدار من قناته، إلا إذا اخترت رقم إصدار محددًا.",
				en: "Choose the release or the preview channel. Your server follows the channel's latest build unless you pick a build number.",
			},
			target: BridgeFormTarget.Variables,
			reinstall: true,
			confirm: BridgeConfirm.Normal,
			confirmText: {
				ar: "نأخذ نسخة احتياطية قبل تثبيت الإصدار الجديد. الرجوع من البريفيو يتطلب مابًا محفوظًا قبل التبديل، وليس مجرد تغيير رقم الإصدار.",
				en: "We take a backup before installing the new build. Returning from preview requires a world saved before the switch, not just a different build number.",
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
						ar: "يتيح البريفيو تجربة الجديد قبل الجميع، ويتطلب أن يكون كل اللاعبين على تطبيق Minecraft Preview.",
						en: "Preview lets you try what's coming next, and needs every player on the Minecraft Preview app.",
					},
					options: [
						{
							value: "release",
							label: {
								ar: "الإصدار العادي",
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
						ar: "رقم الإصدار",
						en: "Build",
					},
					help: {
						ar: "تابع أحدث إصدار، أو اختر رقمًا محددًا ليبقى السيرفر عليه. إذا كانت إضافاتك تستخدم Beta APIs، فاختر رقمًا محددًا.",
						en: "Follow the latest build, or pick a build number to keep your server on it. If your add-ons use Beta APIs, pick a build number.",
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
				ar: "اسم السيرفر ووضع اللعب والصعوبة. أي تعديل هنا يتطلب ريستارت.",
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
						ar: "السيد",
						en: "Seed",
					},
					help: {
						ar: "يُستخدم فقط لماب جديد لم يتولد بعد.",
						en: "Only used for a world that doesn't exist yet.",
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
						ar: "فرض وضع اللعب",
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
						ar: "السماح بالتشيتات",
						en: "Allow cheats",
					},
					warning: {
						ar: "يفعّل أوامر اللعبة داخل الماب، وهذا يغيّر طريقة اللعب.",
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
				ar: "من يستطيع الدخول، وكيف يتواصل اللاعبون.",
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
						ar: "التحقق من حساب Xbox",
						en: "Require an Xbox account",
					},
					warning: {
						ar: "عند إيقافه، لا يرسل بيدروك أرقام حسابات اللاعبين، وتتعطل قائمة الأوبريتر.",
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
						ar: "عند تفعيلها، لا يدخل إلا اللاعبون الموجودون في القائمة، وهي الطريقة الوحيدة لمنع أي لاعب من الدخول. وإذا كانت القائمة فارغة فلن يدخل أحد، لذلك أضف اللاعبين أولًا.",
						en: "With it on, only players on the list can join. It's your only way to keep someone out. With the list empty, nobody can join, so add your players first.",
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
						ar: "اتركه على NetherNet، فهي الطريقة التي تدخل بها إصدارات بيدروك الحالية. إذا ظهر الخطأ InitialConnection-13 للاعبي iPhone و iPad بينما يدخل لاعبو ويندوز و Android، فاختر RakNet حتى إصدار ماينكرافت 26.60، فهذا خلل من Mojang في بدء الاتصال عبر NetherNet.",
						en: "Keep it on NetherNet, the way current Bedrock clients join. If iPhone and iPad players get InitialConnection-13 while Windows and Android players join, choose RakNet until Minecraft 26.60. It's a Mojang bug in NetherNet signaling.",
					},
					warning: {
						ar: "يزيل إصدار ماينكرافت 26.60 طريقة RakNet من اللعبة والسيرفر معًا. عند تحديث سيرفرك إلى 26.60، نبدّلها إلى NetherNet تلقائيًا عند تشغيله.",
						en: "Minecraft 26.60 removes RakNet from both the game and the server. When you update your server to 26.60, we switch it back to NetherNet as it starts.",
					},
					options: TRANSPORTS,
				},
				{
					key: PROPERTY_KEYS.playerIdleTimeout,
					control: BridgeControl.Number,
					label: {
						ar: "طرد اللاعب الخامل بعد (بالدقائق)",
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
						ar: "منع تفاعل اللاعبين",
						en: "Disable player interaction",
					},
				},
				{
					key: PROPERTY_KEYS.texturepackRequired,
					control: BridgeControl.Boolean,
					label: {
						ar: "إلزام إضافة المظهر",
						en: "Require the resource pack",
					},
					warning: {
						ar: "يُطرد من السيرفر أي لاعب يرفض تنزيل الإضافة.",
						en: "Any player who declines the add-on download is disconnected.",
					},
				},
				{
					key: PROPERTY_KEYS.disableCustomSkins,
					control: BridgeControl.Boolean,
					label: {
						ar: "منع السكنات المخصصة",
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
				ar: "كلما زادت المسافات، زاد الحمل على السيرفر.",
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
					help: {
						ar: "كلما زادت، زادت مساحة الماب التي يحمّلها السيرفر حول كل لاعب، وزاد استهلاك المعالج. على الباقات الصغيرة تسبب القيمة العالية لاقًا.",
						en: "Higher values make the server load more chunks around every player, which costs CPU. On a small plan, a high value makes the server lag.",
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
					help: {
						ar: "كلما زادت، زادت مساحة الماب النشطة حول كل لاعب، وزاد استهلاك المعالج. على الباقات الصغيرة تسبب القيمة العالية لاقًا.",
						en: "Higher values keep more chunks active around every player, which costs CPU. On a small plan, a high value makes the server lag.",
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
		ar: "اللاعبون",
		en: "Players",
	},
	icon: BridgeIcon.Users,
	sections: [
		{
			layout: BridgeLayout.Table,
			id: "online",
			title: {
				ar: "المتصلون",
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
						ar: "معرّف اللاعب",
						en: "Account id",
					},
				},
			],
			empty: {
				ar: "لا يوجد لاعبون متصلون حاليًا.",
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
						ar: "اجعله أوبريتر",
						en: "Make operator",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "يستطيع الأوبريتر استخدام كل أوامر الإدارة داخل اللعبة، وتغيير الماب كما يشاء.",
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
						ar: "يموت اللاعب وتسقط كل أغراضه في مكانه.",
						en: "They die and drop everything they're carrying where they stand.",
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
				ar: "عند تفعيل القائمة البيضاء من الإعدادات، لا يدخل سيرفرك إلا اللاعبون الموجودون هنا. لا يوجد حظر في بيدروك، لذلك هذه هي الطريقة.",
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
						ar: "معرّف اللاعب",
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
					ar: "أضف لاعبًا",
					en: "Add a player",
				},
				placeholder: "Gamertag",
			},
			empty: {
				ar: "القائمة فارغة. يُملأ معرّف اللاعب تلقائيًا عند أول دخول للاعب.",
				en: "The list is empty. The account id fills itself in the first time that player joins.",
			},
			actions: [
				{
					id: "remove",
					label: {
						ar: "أزله",
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
				ar: "يحفظ بيدروك الصلاحيات بمعرّف اللاعب، لذلك يلزم أن يدخل اللاعب مرة واحدة قبل أن تجعله أوبريتر والسيرفر متوقف.",
				en: "Bedrock stores permissions by account id, so a player has to join once before you can make them an operator while the server is stopped.",
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
						ar: "معرّف اللاعب",
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
					ar: "أضف أوبريتر",
					en: "Add an operator",
				},
				placeholder: "Gamertag",
			},
			empty: {
				ar: "لا يوجد أوبريتر غيرك.",
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
						ar: "أزله",
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
				ar: "تُطبَّق فورًا على السيرفر الشغّال، وتعود إلى إعداداتك بعد الريستارت.",
				en: "These apply to the running server right away, and fall back to your settings after a restart.",
			},
			module: "gameplay",
			actions: [
				{
					id: "timeDay",
					label: {
						ar: "اجعله نهارًا",
						en: "Set day",
					},
				},
				{
					id: "timeNight",
					label: {
						ar: "اجعله ليلًا",
						en: "Set night",
					},
				},
				{
					id: "weatherClear",
					label: {
						ar: "طقس صافٍ",
						en: "Clear weather",
					},
				},
				{
					id: "weatherRain",
					label: {
						ar: "مطر",
						en: "Rain",
					},
				},
				{
					id: "weatherThunder",
					label: {
						ar: "رعد وبرق",
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
						ar: "فعّل القائمة البيضاء",
						en: "Allowlist on",
					},
				},
				{
					id: "allowlistOff",
					label: {
						ar: "وقّف القائمة البيضاء",
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
				ar: "لا يحتوي بيدروك على أمر say، لذلك نستخدم tellraw.",
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
						ar: "اعرض عنوانًا",
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
				ar: "أدوات المابات",
				en: "World tools",
			},
			module: "worldTools",
			actions: [
				{
					id: "create",
					label: {
						ar: "أنشئ ماب وفعّله",
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
								ar: "السيد (اختياري)",
								en: "Seed (optional)",
							},
							maxLength: 64,
						},
					],
				},
				{
					id: "resetFromCopy",
					label: {
						ar: "ريسيت من نسخة",
						en: "Reset from a copy",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "نستبدل الماب المفعّل بنسخة من الماب الذي تكتب اسمه، فتعود المباني وأغراض اللاعبين وتقدّمهم كما هي في تلك النسخة. يبقى الماب الحالي في قائمة المابات ويُضاف old إلى اسمه، ويشغل المساحة نفسها. لا يتغيّر الماب الذي كتبت اسمه، ونسخ الماب الكبير يستغرق وقتًا أطول.",
						en: "We replace the active world with a copy of the world you name, so builds, inventories and progress go back to how they are in that copy. Your current world stays in the Worlds list, renamed with -old, and takes the same space. The world you named stays as it is, and a large world takes a while to copy.",
					},
					fields: [
						{
							key: "source",
							control: BridgeControl.Text,
							label: {
								ar: "الماب الأصلي",
								en: "Source world",
							},
							help: {
								ar: "اكتب اسم المجلد تمامًا كما يظهر في عمود «المجلد» في قائمة المابات.",
								en: "Type the folder name exactly as it shows in the Folder column of the Worlds list.",
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
				ar: "أي تغيير على المابات يتطلب أن يكون سيرفرك متوقفًا، إلا الحذف والريسيت: نوقف السيرفر لهما ثم نشغّله من جديد إذا كان شغّالًا. في بيدروك تُحفظ الأبعاد كلها في قاعدة بيانات واحدة، لذلك يشمل الريسيت الماب كله ولا يمكن تنفيذه لبُعد واحد وحده.",
				en: "Every world change needs your server stopped, except a delete or a reset: we stop the server for them and start it again if it was running. Bedrock stores all dimensions together, so a reset covers the whole world and can't target a single dimension.",
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
						ar: "مفعّل",
						en: "Active",
					},
				},
				{
					key: "hardcore",
					label: {
						ar: "الهاردكور",
						en: "Hardcore",
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
				ar: "لا توجد مابات مرفوعة.",
				en: "No worlds uploaded yet.",
			},
			actions: [
				{
					id: "clone",
					label: {
						ar: "انسخ الماب",
						en: "Copy world",
					},
					fields: [
						{
							key: "name",
							control: BridgeControl.Text,
							label: {
								ar: "اسم الماب الجديد",
								en: "New world name",
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
						ar: "نجهّز ملف .mcworld داخل مجلد exports في الملفات. نزّله وافتحه في بيدروك.",
						en: "We prepare a .mcworld in the exports folder in Files. Download it and open it in Bedrock.",
					},
				},
				{
					id: "activate",
					label: {
						ar: "فعّل الماب",
						en: "Activate",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "نبدّل الماب المفعّل، ويلزم أن يكون سيرفرك متوقفًا. شغّله بعد ذلك ليُفتح الماب الجديد.",
						en: "We switch the active world, and your server must be stopped. Start it again afterwards to open the new world.",
					},
				},
				{
					id: "hardcore",
					label: {
						ar: "اضبط الهاردكور",
						en: "Set hardcore",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "حياة واحدة لكل لاعب، ومن يموت لا يمكنه العودة إلى اللعب. يستخدم السيرفر الصعوبة المحددة في الإعدادات، فاخترها «صعب» لتجربة هاردكور كاملة. يلزم أن يكون سيرفرك متوقفًا، وإيقاف الهاردكور متاح من هنا في أي وقت.",
						en: "One life per player, and a player who dies can't respawn. The server uses the difficulty set in Settings, so pick Hard there for the full hardcore experience. Your server must be stopped, and you can turn hardcore off again from here at any time.",
					},
					fields: [
						{
							key: "enabled",
							control: BridgeControl.Boolean,
							label: {
								ar: "تفعيل الهاردكور",
								en: "Turn on hardcore",
							},
						},
					],
				},
				{
					id: "delete",
					label: {
						ar: "احذف الماب",
						en: "Delete",
					},
					confirm: BridgeConfirm.Strong,
					confirmText: {
						ar: "حذف الماب يزيل الأوفرورلد والنذر والإند وكل ما بنيتموه نهائيًا. النسخة الاحتياطية هي طريقك الوحيد للرجوع، لذلك خذ نسخة احتياطية قبل المتابعة.",
						en: "Deleting the world removes the Overworld, Nether, End and everything you built for good. A backup is your only way back, so take one before you continue.",
					},
				},
				{
					id: "resetWorld",
					label: {
						ar: "ريسيت الماب",
						en: "Reset world",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "يتولد الماب من البداية بالسيد نفسه، وتبدأ المباني وأغراض اللاعبين وتقدّمهم من جديد. تبقى الإضافات المفعّلة على الماب كما هي، ويعود الهاردكور وقوانين اللعبة إلى الوضع الافتراضي. يبقى الماب الحالي في قائمة المابات ويُضاف old إلى اسمه، ويشغل المساحة نفسها. فعّله للرجوع إليه، أو احذفه عندما تتأكد.",
						en: "The world generates again from the start with its own seed, and builds, inventories and progress start over. The add-ons activated on the world stay, while hardcore and game rules go back to their defaults. Your current world stays in the Worlds list, renamed with -old, and takes the same space. Activate it to go back, or delete it once you're sure.",
					},
				},
			],
		},
	],
};

const addonsTab: Bridge.Tab = {
	id: "addons",
	title: {
		ar: "الإضافات",
		en: "Add-ons",
	},
	icon: BridgeIcon.Puzzle,
	sections: [
		{
			layout: BridgeLayout.Catalog,
			id: "catalog",
			title: {
				ar: "كتالوج الإضافات",
				en: "Add-on catalog",
			},
			help: {
				ar: "ابحث عن إضافة وثبّتها بضغطة وسيرفرك متوقف. نثبّتها ونفعّلها على مابك، ثم شغّل سيرفرك.",
				en: "Install an add-on in one click with your server stopped. We install it and activate it on your world. Start your server afterwards.",
			},
			module: "packCatalog",
		},
		{
			layout: BridgeLayout.Detail,
			id: "pack-health",
			title: {
				ar: "فحص الإضافات",
				en: "Add-on check",
			},
			help: {
				ar: "نفحص إضافات سيرفرك: ملفات رفعتها ولم تُثبَّت، وإضافات موجودة لكنها غير مفعّلة، ومتطلبات ناقصة، وإضافات تتطلب Beta APIs.",
				en: "We check your server's add-ons: uploaded files that never installed, add-ons that are present but not active, missing required add-ons, and add-ons that need Beta APIs.",
			},
			module: "packHealth",
			actions: [
				{
					id: "repair",
					label: {
						ar: "أصلح الإضافات",
						en: "Repair add-ons",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "نأخذ نسخة احتياطية ونوقف السيرفر، ثم نثبّت ملفات الإضافات غير المثبّتة، ونفعّل الإضافات غير المفعّلة، ونفعّل Beta APIs إذا كانت إحدى الإضافات تتطلبها، ثم نشغّل السيرفر من جديد إذا كان شغّالًا. بعد تفعيل Beta APIs لا يمكن إيقافها بأمان.",
						en: "We take a backup and stop the server, install the add-on files that never installed, activate the add-ons that aren't active, and turn on Beta APIs if an add-on needs it, then start the server again if it was running. Once Beta APIs is on, it can't be turned off safely.",
					},
				},
			],
		},
		{
			layout: BridgeLayout.Table,
			id: "packs",
			title: {
				ar: "الإضافات المثبّتة",
				en: "Installed add-ons",
			},
			help: {
				ar: "أي تغيير يتطلب أن يكون سيرفرك متوقفًا. عند الإزالة فقط نأخذ نسخة احتياطية ونشغّل السيرفر من جديد إذا كان شغّالًا. يحدد الترتيب أي إضافة تتقدم إذا غيّرت إضافتان الشيء نفسه.",
				en: "Every change needs your server stopped. Only removing an add-on takes a backup first and starts the server again if it was running. The order decides which add-on wins when two change the same thing.",
			},
			module: "packs",
			columns: [
				{
					key: "worlds",
					label: {
						ar: "المابات المستخدِمة لها",
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
						ar: "حالة التثبيت",
						en: "Install state",
					},
				},
				{
					key: "name",
					label: {
						ar: "الإضافة",
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
						ar: "الإصدار",
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
					ar: "ارفع إضافة",
					en: "Upload an add-on",
				},
				extensions: PACK_EXTENSIONS,
				staging: PACK_STAGING,
				mode: BridgeUploadMode.File,
			},
			empty: {
				ar: "لا توجد إضافات مثبّتة. ارفع ملف mcaddon أو mcpack ونثبّته لك.",
				en: "No add-ons installed. Upload a .mcaddon or .mcpack and we'll install it for you.",
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
						ar: "وقّفه",
						en: "Disable",
					},
				},
				{
					id: "moveUp",
					label: {
						ar: "انقله للأعلى",
						en: "Move up",
					},
				},
				{
					id: "moveDown",
					label: {
						ar: "انقله للأسفل",
						en: "Move down",
					},
				},
				{
					id: "remove",
					label: {
						ar: "أزله",
						en: "Remove",
					},
					confirm: BridgeConfirm.Normal,
					confirmText: {
						ar: "إذا أزلت إضافة سلوك يستخدمها ماب، يختفي من الماب كل ما أضافته الإضافة من وحوش وأغراض. خذ نسخة احتياطية أولًا.",
						en: "If you remove a behavior pack a world was using, everything it added disappears from that world, including the mobs and items it brought. Take a backup first.",
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
