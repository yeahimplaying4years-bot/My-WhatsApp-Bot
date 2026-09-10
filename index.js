const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs");
const path = require("path");

// ========================================
// 🤖 JOO WhatsApp Bot
// ========================================

// رقم المالك
const OWNER = (process.env.JOO_OWNER || "").replace(/\D/g, "");

// رقم واتساب الذي سيتم ربط البوت عليه
const PHONE_NUMBER = (process.env.JOO_PHONE || "").replace(/\D/g, "");

const SECRET_CODE = process.env.JOO_SECRET_CODE || "JOO2026";
const PREFIX = process.env.JOO_PREFIX || ".";

const DATA_DIR = "./data";
const AUTH_DIR = "./auth_info";

fs.mkdirSync(DATA_DIR, { recursive: true });


// ========================================
// 💾 قاعدة البيانات
// ========================================

function loadJSON(name, fallback) {
  const file = path.join(DATA_DIR, name);

  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function saveJSON(name, data) {
  fs.writeFileSync(
    path.join(DATA_DIR, name),
    JSON.stringify(data, null, 2)
  );
}


let db = loadJSON("database.json", {
  status: "غير متاح حالياً 🔴",
  users: {},
  groups: {},
  mods: [],
  subscribers: [],
  unlocked: {}
});


// ========================================
// 😂 النكت
// ========================================

const jokes = [

  "مرة واحد بخيل فتح مطعم... كتب على الباب: الأكل عندنا على قد الفلوس 😂",

  "واحد راح للدكتور قاله كل ما أشرب شاي عيني توجعني، قاله شيل المعلقة من الكوباية 😂",

  "مرة كمبيوتر عطس... قالوله يرحمك الله، قال: Thanks for the update 😂",

  "واحد سأل صاحبه: إيه أسرع حاجة؟ قاله الإجازة، بتخلص قبل ما تبدأ 😂",

  "مرة واحد نام متأخر... صحي بدري عشان يشوف هو كان نايم ليه 😂"

];


// ========================================
// ❓ الأسئلة
// ========================================

const questions = [

  {
    q: "ما هي عاصمة مصر؟",
    a: ["القاهرة", "القاهره"],
    l: 1
  },

  {
    q: "كم عدد أيام الأسبوع؟",
    a: ["7", "سبعة", "سبعه"],
    l: 1
  },

  {
    q: "ما هو الكوكب الأحمر؟",
    a: ["المريخ"],
    l: 2
  },

  {
    q: "ما أكبر محيط في العالم؟",
    a: ["المحيط الهادئ", "الهادئ"],
    l: 2
  },

  {
    q: "ما العنصر الكيميائي رمزه Au؟",
    a: ["الذهب"],
    l: 3
  },

  {
    q: "من وضع قوانين الحركة الثلاثة؟",
    a: [
      "نيوتن",
      "إسحاق نيوتن",
      "اسحاق نيوتن"
    ],
    l: 3
  },

  {
    q: "ما اسم أطول عظمة في جسم الإنسان؟",
    a: [
      "عظمة الفخذ",
      "الفخذ"
    ],
    l: 4
  },

  {
    q: "ما الدولة التي تقع فيها مدينة ماتشو بيتشو؟",
    a: [
      "بيرو",
      "البيرو"
    ],
    l: 4
  }

];


// ========================================
// 😜 المداعبة
// ========================================

const teaseLines = [

  "😂 جامد! بس واضح إنك داخل تحدي البوت وانت مش مستعد!",

  "😎 يا سلام! ردك حلو... خد دي كمان: مين هيكسب، أنت ولا JOO؟",

  "🤣 أنا بهزر معاك بس متختفيش! قول حاجة تانية.",

  "🔥 كمل كمل... المداعبة لسه في أولها!",

  "😜 أنت كده بتشجع البوت يكمل عليك!"

];


// ========================================
// 🔧 أدوات
// ========================================

function jidNum(jid) {

  return jid
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");

}


function isOwner(jid) {

  return OWNER && jidNum(jid) === OWNER;

}


function isMod(jid) {

  return (
    isOwner(jid) ||
    db.mods.includes(jidNum(jid))
  );

}


function mention(jid) {

  return "@" + jidNum(jid);

}


function getText(msg) {

  const m = msg.message || {};

  return (

    m.conversation ||

    m.extendedTextMessage?.text ||

    m.imageMessage?.caption ||

    m.videoMessage?.caption ||

    ""

  );

}


function userState(jid) {

  if (!db.users[jid]) {

    db.users[jid] = {

      game: null,

      tease: false,

      questionLevel: 1,

      question: null,

      greeted: false

    };

  }

  return db.users[jid];

}


// ========================================
// 📋 القائمة
// ========================================

function menu(secret = false) {

  let text = `

╔══════════════════╗
      🤖 JOO BOT
╚══════════════════╝

👋 أهلاً بك في بوت JOO

📌 الأقسام الأساسية

🎮 .ألعاب

❓ .سؤال

😂 .نكتة

😄 .مداعبة

🌙 .حلم اكتب حلمك

🏓 .ping

ℹ️ .حالة

━━━━━━━━━━━━━━

📖 اكتب الأمر مباشرة

`;

  if (secret) {

    text += `

🔐 الأقسام الخاصة

👑 .اوامر_المالك

🛡️ .اوامر_المشرف

`;

  }

  return text;

}


// ========================================
// 👑 قائمة المالك
// ========================================

function ownerMenu() {

  return `

👑 أوامر مالك JOO

━━━━━━━━━━━━━━

📢 .اذاعة نص الرسالة

🟢 .متاح

🔴 .غير_متاح رسالة

🛡️ .اضف_مشرف رقم

❌ .حذف_مشرف رقم

📊 .احصائيات

⚙️ .ترحيب_تشغيل

⚙️ .ترحيب_ايقاف

👋 .وداع_تشغيل

👋 .وداع_ايقاف

━━━━━━━━━━━━━━

`;

}


// ========================================
// 🛡️ قائمة المشرف
// ========================================

function modMenu() {

  return `

🛡️ أوامر المشرف

━━━━━━━━━━━━━━

👋 .ترحيب_تشغيل

👋 .ترحيب_ايقاف

🚪 .وداع_تشغيل

🚪 .وداع_ايقاف

📋 .قائمة

`;

}


// ========================================
// 📤 إرسال رسالة
// ========================================

async function send(sock, jid, text, extra = {}) {

  return sock.sendMessage(

    jid,

    {
      text,
      ...extra
    }

  );

}


// ========================================
// 🤖 الأوامر والردود
// ========================================

async function handleCommand(
  sock,
  msg,
  jid,
  sender,
  text,
  isGroup
) {

  const state = userState(sender);

  const raw = text.trim();

  const lower = raw.toLowerCase();


  // حفظ المحادثة

  if (!db.subscribers.includes(jid)) {

    db.subscribers.push(jid);

  }


  // =====================================
  // 👋 أول رسالة من شخص جديد
  // =====================================

  if (!state.greeted && !isGroup) {

    state.greeted = true;

    saveJSON("database.json", db);


    await send(

      sock,

      jid,

      `⚠️ تحذير

التعامل مع أي شخص أو رقم عبر الإنترنت يحتاج حذر.

لا ترسل كلمات السر أو الأكواد أو معلوماتك الخاصة لأي شخص.

🤖 مرحباً بيك!

أنا بوت JOO 🤖

أقدر أساعدك وأتفاعل مع رسائلك.

📌 اكتب:

.menu

لمشاهدة كل الأوامر ❤️`

    );


    // لو المستخدم أرسل رسالة عادية
    // نكمل الرد بعدها

    if (!raw.startsWith(PREFIX)) {

      return send(

        sock,

        jid,

        "😊 أهلاً بيك! أنا هنا معاك. اكتب أي رسالة أو استخدم .menu 🤖"

      );

    }

  }


  // =====================================
  // ❓ إجابة سؤال
  // =====================================

  if (

    state.question &&

    !raw.startsWith(PREFIX)

  ) {

    const q = questions[state.question.index];


    const answer = lower

      .replace(/[ًٌٍَُِّْـ]/g, "")

      .trim();


    if (

      q.a.some(

        a => answer === a.toLowerCase()

      )

    ) {

      state.questionLevel = Math.min(

        4,

        q.l + 1

      );


      state.question = null;


      saveJSON(

        "database.json",

        db

      );


      return send(

        sock,

        jid,

        `✅ إجابة صحيحة! 🔥

المستوى القادم:

${state.questionLevel}

اكتب .سؤال`

      );

    }


    return send(

      sock,

      jid,

      "❌ مش هي دي الإجابة 😅 حاول تاني."

    );

  }


  // =====================================
  // 🎯 لعبة التخمين
  // =====================================

  if (

    state.game &&

    !raw.startsWith(PREFIX) &&

    !isNaN(Number(raw))

  ) {

    const number = Number(raw);


    if (

      number === state.game

    ) {

      state.game = null;


      saveJSON(

        "database.json",

        db

      );


      return send(

        sock,

        jid,

        "🎉 صح! كسبت اللعبة 🔥"

      );

    }


    return send(

      sock,

      jid,

      number > state.game

        ? "⬇️ أقل شوية!"

        : "⬆️ أعلى شوية!"

    );

  }


  // =====================================
  // 😜 المداعبة
  // =====================================

  if (

    state.tease &&

    !raw.startsWith(PREFIX)

  ) {

    const line = teaseLines[

      Math.floor(

        Math.random() *

        teaseLines.length

      )

    ];


    return send(

      sock,

      jid,

      line

    );

  }


  // =====================================
  // 💬 الرد على أي رسالة عادية
  // =====================================

  if (!raw.startsWith(PREFIX)) {

    const replies = [

      "😊 أهلاً بيك! عامل إيه؟",

      "🤖 أنا JOO Bot وموجود معاك!",

      "😄 جميل! كمل كلام معايا.",

      "🔥 تمام يا بطل!",

      "❤️ نورت البوت!",

      "😎 حلو الكلام ده!"

    ];


    const reply = replies[

      Math.floor(

        Math.random() *

        replies.length

      )

    ];


    return send(

      sock,

      jid,

      reply

    );

  }


  // =====================================
  // 📌 قراءة الأمر
  // =====================================

  const body = raw

    .slice(PREFIX.length)

    .trim();


  const [

    cmdRaw,

    ...args

  ] = body.split(/\s+/);


  const cmd = (

    cmdRaw || ""

  ).toLowerCase();


  const arg = args.join(" ");


  // =====================================
  // 📋 القائمة
  // =====================================

  if (

    [

      "menu",

      "قائمة",

      "القائمة"

    ].includes(cmd)

  ) {

    return send(

      sock,

      jid,

      menu(

        isOwner(sender) ||

        db.unlocked[sender]

      )

    );

  }


  // =====================================
  // 🏓 Ping
  // =====================================

  if (cmd === "ping") {

    return send(

      sock,

      jid,

      "🏓 Pong!\n\n🤖 JOO Bot شغال ✅"

    );

  }


  // =====================================
  // ℹ️ الحالة
  // =====================================

  if (cmd === "حالة") {

    return send(

      sock,

      jid,

      `ℹ️ الحالة:

${db.status}`

    );

  }


  // =====================================
  // 🎮 الألعاب
  // =====================================

  if (

    cmd === "ألعاب" ||

    cmd === "العاب" ||

    cmd === "games"

  ) {

    return send(

      sock,

      jid,

      `🎮 ألعاب JOO

1️⃣ .خمن

2️⃣ .حجر

3️⃣ .سؤال

اكتب الأمر اللي عايزه 🔥`

    );

  }


  // =====================================
  // 🎯 خمن
  // =====================================

  if (cmd === "خمن") {

    state.game =

      Math.floor(

        Math.random() * 10

      ) + 1;


    saveJSON(

      "database.json",

      db

    );


    return send(

      sock,

      jid,

      "🎯 خمن رقم من 1 إلى 10"

    );

  }


  // =====================================
  // 🪨 حجر ورقة مقص
  // =====================================

  if (cmd === "حجر") {

    const choices = [

      "🪨 حجر",

      "📄 ورقة",

      "✂️ مقص"

    ];


    return send(

      sock,

      jid,

      `🎲 اختيار JOO:

${

  choices[

    Math.floor(

      Math.random() * 3

    )

  ]

}

😎 دلوقتي اختار:
حجر / ورقة / مقص`

    );

  }


  // =====================================
  // ❓ سؤال
  // =====================================

  if (

    cmd === "سؤال" ||

    cmd === "اسئلة" ||

    cmd === "أسئلة"

  ) {

    const available = questions.filter(

      q => q.l === state.questionLevel

    );


    const pool =

      available.length

        ? available

        : questions;


    const q = pool[

      Math.floor(

        Math.random() *

        pool.length

      )

    ];


    state.question = {

      index: questions.indexOf(q)

    };


    saveJSON(

      "database.json",

      db

    );


    return send(

      sock,

      jid,

      `❓ سؤال مستوى ${q.l}

${q.q}`

    );

  }


  // =====================================
  // 😂 نكتة
  // =====================================

  if (

    cmd === "نكتة" ||

    cmd === "نكت"

  ) {

    return send(

      sock,

      jid,

      "😂 " +

      jokes[

        Math.floor(

          Math.random() *

          jokes.length

        )

      ]

    );

  }


  // =====================================
  // 😜 مداعبة
  // =====================================

  if (cmd === "مداعبة") {

    state.tease = true;


    saveJSON(

      "database.json",

      db

    );


    return send(

      sock,

      jid,

      `😜 بدأنا المداعبة!

رد عليا بأي رسالة 😂

اكتب:

.وقف_مداعبة

للإيقاف`

    );

  }


  if (cmd === "وقف_مداعبة") {

    state.tease = false;


    saveJSON(

      "database.json",

      db

    );


    return send(

      sock,

      jid,

      "😄 تم إيقاف المداعبة."

    );

  }


  // =====================================
  // 🌙 حلم
  // =====================================

  if (cmd === "حلم") {

    if (!arg) {

      return send(

        sock,

        jid,

        `🌙 اكتب حلمك بعد الأمر

مثال:

.حلم رأيت أني أطير`

      );

    }


    return send(

      sock,

      jid,

      `🌙 حلمك:

"${arg}"

هذا تفسير عام للترفيه وليس حكماً مؤكداً.

الأحلام قد تتأثر بالأفكار والمشاعر اليومية ❤️`

    );

  }


  // =====================================
  // 🔐 فتح القسم
  // =====================================

  if (

    cmd === "فتح" ||

    cmd === "unlock"

  ) {

    if (

      arg === SECRET_CODE ||

      isOwner(sender)

    ) {

      db.unlocked[sender] = true;


      saveJSON(

        "database.json",

        db

      );


      return send(

        sock,

        jid,

        "🔓 تم فتح الأقسام الخاصة!"

      );

    }


    return send(

      sock,

      jid,

      "❌ الكود غير صحيح."

    );

  }


  // =====================================
  // 👑 أوامر المالك
  // =====================================

  if (cmd === "اوامر_المالك") {

    if (!isOwner(sender)) {

      return send(

        sock,

        jid,

        "⛔ هذا القسم للمالك فقط."

      );

    }


    return send(

      sock,

      jid,

      ownerMenu()

    );

  }


  // =====================================
  // 🛡️ أوامر المشرف
  // =====================================

  if (cmd === "اوامر_المشرف") {

    if (!isMod(sender)) {

      return send(

        sock,

        jid,

        "⛔ للمشرفين فقط."

      );

    }


    return send(

      sock,

      jid,

      modMenu()

    );

  }


  // =====================================
  // 🟢 متاح
  // =====================================

  if (

    cmd === "متاح" &&

    isOwner(sender)

  ) {

    db.status = "متاح الآن 🟢";


    saveJSON(

      "database.json",

      db

    );


    return send(

      sock,

      jid,

      "✅ تم تغيير الحالة إلى متاح."

    );

  }


  // =====================================
  // 🔴 غير متاح
  // =====================================

  if (

    cmd === "غير_متاح" &&

    isOwner(sender)

  ) {

    db.status =

      arg ||

      "غير متاح حالياً 🔴";


    saveJSON(

      "database.json",

      db

    );


    return send(

      sock,

      jid,

      "✅ تم تغيير الحالة."

    );

  }


  // =====================================
  // 🛡️ إضافة مشرف
  // =====================================

  if (

    cmd === "اضف_مشرف" &&

    isOwner(sender)

  ) {

    const num = arg.replace(

      /\D/g,

      ""

    );


    if (!num) {

      return send(

        sock,

        jid,

        "اكتب رقم المشرف مع كود الدولة."

      );

    }


    if (

      !db.mods.includes(num)

    ) {

      db.mods.push(num);

    }


    saveJSON(

      "database.json",

      db

    );


    return send(

      sock,

      jid,

      `🛡️ تم إضافة:

${num}

كمشرف.`

    );

  }


  // =====================================
  // ❌ حذف مشرف
  // =====================================

  if (

    cmd === "حذف_مشرف" &&

    isOwner(sender)

  ) {

    const num = arg.replace(

      /\D/g,

      ""

    );


    db.mods = db.mods.filter(

      x => x !== num

    );


    saveJSON(

      "database.json",

      db

    );


    return send(

      sock,

      jid,

      `❌ تم حذف:

${num}

من المشرفين.`

    );

  }


  // =====================================
  // 📊 إحصائيات
  // =====================================

  if (

    cmd === "احصائيات" &&

    isOwner(sender)

  ) {

    return send(

      sock,

      jid,

      `📊 إحصائيات JOO

👤 المستخدمون:
${Object.keys(db.users).length}

🛡️ المشرفون:
${db.mods.length}

📨 المحادثات:
${db.subscribers.length}`

    );

  }


  // =====================================
  // 📢 إذاعة
  // =====================================

  if (

    cmd === "اذاعة" &&

    isOwner(sender)

  ) {

    if (!arg) {

      return send(

        sock,

        jid,

        `اكتب الرسالة بعد الأمر

مثال:

.اذاعة مرحباً ❤️`

      );

    }


    let ok = 0;


    for (

      const target of db.subscribers.slice(0, 100)

    ) {

      try {

        await send(

          sock,

          target,

          `📢 رسالة من JOO

${arg}`

        );


        ok++;

      } catch {}

    }


    return send(

      sock,

      jid,

      `✅ تم الإرسال إلى:

${ok}

محادثة.`

    );

  }


  // =====================================
  // ⚙️ إعدادات الجروب
  // =====================================

  if (

    [

      "ترحيب_تشغيل",

      "ترحيب_ايقاف",

      "وداع_تشغيل",

      "وداع_ايقاف"

    ].includes(cmd)

  ) {

    if (

      !isGroup ||

      !isMod(sender)

    ) {

      return send(

        sock,

        jid,

        "⛔ الأمر للمشرف أو المالك داخل الجروبات."

      );

    }


    if (!db.groups[jid]) {

      db.groups[jid] = {

        welcome: true,

        goodbye: true

      };

    }


    if (

      cmd === "ترحيب_تشغيل"

    ) {

      db.groups[jid].welcome = true;

    }


    if (

      cmd === "ترحيب_ايقاف"

    ) {

      db.groups[jid].welcome = false;

    }


    if (

      cmd === "وداع_تشغيل"

    ) {

      db.groups[jid].goodbye = true;

    }


    if (

      cmd === "وداع_ايقاف"

    ) {

      db.groups[jid].goodbye = false;

    }


    saveJSON(

      "database.json",

      db

    );


    return send(

      sock,

      jid,

      "✅ تم حفظ إعداد الجروب."

    );

  }


  // =====================================
  // ❌ أمر غير معروف
  // =====================================

  return send(

    sock,

    jid,

    "🤖 مش فاهم الأمر 😅\n\nاكتب .menu"

  );

}


// ========================================
// 🚀 تشغيل البوت
// ========================================

async function startBot() {

  console.log(

    "🤖 جاري تشغيل JOO WhatsApp Bot..."

  );


  const {

    state,

    saveCreds

  } = await useMultiFileAuthState(

    AUTH_DIR

  );


  const {

    version

  } = await fetchLatestBaileysVersion();


  const sock = makeWASocket({

    version,

    auth: state,

    printQRInTerminal: false,

    logger: pino({

      level: "silent"

    }),

    browser: [

      "JOO Bot",

      "Chrome",

      "1.0.0"

    ],

    markOnlineOnConnect: false

  });


  // =====================================
  // 💾 حفظ الجلسة
  // =====================================

  sock.ev.on(

    "creds.update",

    saveCreds

  );


  // =====================================
  // 📱 Pairing Code
  // =====================================

  if (!state.creds.registered) {

    if (!PHONE_NUMBER) {

      console.log(

        "❌ لم يتم العثور على JOO_PHONE"

      );


      console.log(

        "ضع رقم واتساب في Railway Variables"

      );


    } else {

      try {

        console.log(

          "📱 جاري إنشاء كود الربط..."

        );


        const code = await sock.requestPairingCode(

          PHONE_NUMBER

        );


        console.log(

          "\n================================"

        );


        console.log(

          "🔐 PAIRING CODE: " + code

        );


        console.log(

          "================================\n"

        );


        console.log(

          "افتح واتساب > الأجهزة المرتبطة"

        );


        console.log(

          "ثم ربط جهاز باستخدام رقم الهاتف"

        );


      } catch (error) {

        console.log(

          "❌ خطأ في إنشاء Pairing Code:"

        );


        console.log(

          error.message

        );

      }

    }

  }


  // =====================================
  // 🔌 حالة الاتصال
  // =====================================

  sock.ev.on(

    "connection.update",

    ({

      connection,

      lastDisconnect

    }) => {

      if (

        connection === "connecting"

      ) {

        console.log(

          "🔄 جاري الاتصال بواتساب..."

        );

      }


      if (

        connection === "open"

      ) {

        console.log(

          "✅ JOO WhatsApp Bot متصل!"

        );

      }


      if (

        connection === "close"

      ) {

        const code =

          lastDisconnect

            ?.error

            ?.output

            ?.statusCode;


        if (

          code !==

          DisconnectReason.loggedOut

        ) {

          console.log(

            "🔄 إعادة الاتصال..."

          );


          setTimeout(

            startBot,

            3000

          );

        } else {

          console.log(

            "❌ تم تسجيل الخروج."

          );


          console.log(

            "احذف auth_info ثم أعد الربط."

          );

        }

      }

    }

  );


  // =====================================
  // 👥 دخول وخروج الأعضاء
  // =====================================

  sock.ev.on(

    "group-participants.update",

    async event => {

      const settings =

        db.groups[event.id] ||

        {

          welcome: true,

          goodbye: true

        };


      for (

        const participant

        of event.participants

      ) {


        // دخول

        if (

          event.action === "add" &&

          settings.welcome

        ) {

          await send(

            sock,

            event.id,

            `🎉 أهلاً بك ${mention(participant)}

نورت الجروب ❤️

🤖 أنا بوت JOO

اكتب .menu`,

            {

              mentions: [

                participant

              ]

            }

          );

        }


        // خروج

        if (

          event.action === "remove" &&

          settings.goodbye

        ) {

          await send(

            sock,

            event.id,

            `👋 وداعاً ${mention(participant)}

نتمنى نشوفك مرة ثانية ❤️`,

            {

              mentions: [

                participant

              ]

            }

          );

        }

      }

    }

  );


  // =====================================
  // 💬 استقبال الرسائل
  // =====================================

  sock.ev.on(

    "messages.upsert",

    async ({

      messages,

      type

    }) => {

      if (

        type !== "notify"

      ) {

        return;

      }


      for (

        const msg

        of messages

      ) {

        try {


          if (

            !msg.message ||

            msg.key.fromMe

          ) {

            continue;

          }


          const jid =

            msg.key.remoteJid;


          if (

            jid ===

            "status@broadcast"

          ) {

            continue;

          }


          const sender =

            msg.key.participant ||

            jid;


          const text =

            getText(msg);


          if (!text) {

            continue;

          }


          await handleCommand(

            sock,

            msg,

            jid,

            sender,

            text,

            jid.endsWith("@g.us")

          );


        } catch (error) {

          console.error(

            "❌ Message Error:",

            error.message

          );

        }

      }

    }

  );

}


// ========================================
// 🤖 بدء البوت
// ========================================

startBot()

  .catch(

    error =>

      console.error(

        "❌ Start Error:",

        error

      )

  );
