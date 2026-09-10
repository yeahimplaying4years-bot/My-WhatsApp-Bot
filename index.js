const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");

// =============== 𝐽𝑂𝑂 WhatsApp Bot ===============
// ضع رقم المالك في Railway Variables بهذا الشكل: 201XXXXXXXXX
const OWNER = (process.env.JOO_OWNER || "").replace(/\D/g, "");
const SECRET_CODE = process.env.JOO_SECRET_CODE || "JOO2026";
const PREFIX = process.env.JOO_PREFIX || ".";
const DATA_DIR = "./data";
const AUTH_DIR = "./auth_info";

fs.mkdirSync(DATA_DIR, { recursive: true });

function loadJSON(name, fallback) {
  const file = path.join(DATA_DIR, name);
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}
function saveJSON(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(data, null, 2));
}

let db = loadJSON("database.json", {
  status: "غير متاح حالياً",
  users: {},
  groups: {},
  mods: [],
  subscribers: [],
  unlocked: {}
});

const jokes = [
  "مرة واحد بخيل فتح مطعم... كتب على الباب: الأكل عندنا على قد الفلوس 😂",
  "واحد راح للدكتور قاله كل ما أشرب شاي عيني توجعني، قاله شيل المعلقة من الكوباية 😂",
  "مرة كمبيوتر عطس... قالوله يرحمك الله، قال: Thanks for the update 😂",
  "واحد سأل صاحبه: إيه أسرع حاجة؟ قاله الإجازة، بتخلص قبل ما تبدأ 😂"
];

const questions = [
  {q:"ما هي عاصمة مصر؟", a:["القاهرة","القاهره"], l:1},
  {q:"كم عدد أيام الأسبوع؟", a:["7","سبعة","سبعه"], l:1},
  {q:"ما هو الكوكب الأحمر؟", a:["المريخ"], l:2},
  {q:"ما أكبر محيط في العالم؟", a:["المحيط الهادئ","الهادئ"], l:2},
  {q:"ما العنصر الكيميائي رمزه Au؟", a:["الذهب"], l:3},
  {q:"من وضع قوانين الحركة الثلاثة؟", a:["نيوتن","إسحاق نيوتن","اسحاق نيوتن"], l:3},
  {q:"ما اسم أطول عظمة في جسم الإنسان؟", a:["عظمة الفخذ","الفخذ"], l:4},
  {q:"ما الدولة التي تقع فيها مدينة ماتشو بيتشو؟", a:["بيرو","البيرو"], l:4}
];

const teaseLines = [
  "😂 جامد! بس واضح إنك داخل تحدي البوت وانت مش مستعد!",
  "😎 يا سلام! ردك حلو... خد دي كمان: مين هيكسب، أنت ولا 𝐽𝑂𝑂؟",
  "🤣 أنا بهزر معاك بس متختفيش! قول حاجة تانية.",
  "🔥 كمل كمل... المداعبة لسه في أولها!",
  "😜 أنت كده بتشجع البوت يكمل عليك!"
];

function jidNum(jid) { return jid.split("@")[0].split(":")[0].replace(/\D/g,""); }
function isOwner(jid) { return OWNER && jidNum(jid) === OWNER; }
function isMod(jid) { return isOwner(jid) || db.mods.includes(jidNum(jid)); }
function mention(jid) { return "@" + jidNum(jid); }

function getText(msg) {
  const m = msg.message || {};
  return m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption || "";
}

function userState(jid) {
  if (!db.users[jid]) db.users[jid] = { game:null, tease:false, questionLevel:1, question:null, greeted:false };
  return db.users[jid];
}

function menu(secret=false) {
  let t = `╔══════ 🤖 𝐽𝑂𝑂 ══════╗
👋 أهلاً بك في بوت 𝐽𝑂𝑂

📌 الأقسام الأساسية:
🎮 .ألعاب
❓ .سؤال
😂 .نكتة
😄 .مداعبة
🌙 .حلم [اكتب حلمك]
🏓 .ping
ℹ️ .حالة

اكتب الأمر مباشرة.`;
  if (secret) t += `

🔐 قسم المالك:
👑 .اوامر_المالك
🛡️ .اوامر_المشرف`;
  return t + "\n╚══════════════════╝";
}

function ownerMenu() {
  return `👑 أوامر مالك 𝐽𝑂𝑂

📢 .اذاعة نص الرسالة
🟢 .متاح
🔴 .غير_متاح [رسالة]
🛡️ .اضف_مشرف رقم
❌ .حذف_مشرف رقم
📊 .احصائيات
🔐 .كود_جديد الكود
👥 .صلاحياتي
⚙️ .ترحيب_تشغيل / .ترحيب_ايقاف
👋 .وداع_تشغيل / .وداع_ايقاف

ملاحظة: الإذاعة ترسل فقط للمحادثات المسجلة التي تفاعلت مع البوت، وليس لإرسال رسائل قسرية أو عشوائية.`;
}

function modMenu() {
  return `🛡️ أوامر المشرف
👋 .ترحيب_تشغيل
👋 .ترحيب_ايقاف
🚪 .وداع_تشغيل
🚪 .وداع_ايقاف
📋 .قائمة`;
}

async function send(sock, jid, text, extra={}) {
  return sock.sendMessage(jid, { text, ...extra });
}

async function handleCommand(sock, msg, jid, sender, text, isGroup) {
  const state = userState(sender);
  const raw = text.trim();
  const lower = raw.toLowerCase();
  db.subscribers = [...new Set([...db.subscribers, jid])];

  // إجابة سؤال نشط
  if (state.question && !raw.startsWith(PREFIX)) {
    const q = questions[state.question.index];
    const answer = lower.replace(/[ًٌٍَُِّْـ]/g,"").trim();
    if (q.a.some(a => answer === a.toLowerCase())) {
      state.questionLevel = Math.min(4, q.l + 1);
      state.question = null;
      saveJSON("database.json", db);
      return send(sock, jid, `✅ إجابة صحيحة! 🔥 المستوى القادم أصعب: ${state.questionLevel}\nاكتب .سؤال`);
    }
    return send(sock, jid, "❌ مش هي دي الإجابة. حاول تاني أو اكتب .سؤال لسؤال جديد.");
  }

  // استمرار المداعبة
  if (state.tease && !raw.startsWith(PREFIX)) {
    const line = teaseLines[Math.floor(Math.random()*teaseLines.length)];
    return send(sock, jid, line);
  }

  if (!raw.startsWith(PREFIX)) {
    return send(sock, jid, `👋 أهلاً بك، أنا بوت 𝐽𝑂𝑂 🤖\nصاحب الرقم ${db.status}.\n\nاكتب .menu لمشاهدة الأقسام.`);
  }

  const body = raw.slice(PREFIX.length).trim();
  const [cmdRaw, ...args] = body.split(/\s+/);
  const cmd = cmdRaw.toLowerCase();
  const arg = args.join(" ");

  if (["menu","قائمة","القائمة"].includes(cmd)) {
    return send(sock, jid, menu(isOwner(sender) || db.unlocked[sender]));
  }
  if (cmd === "ping") return send(sock, jid, "🏓 Pong! بوت 𝐽𝑂𝑂 شغال ✅");
  if (cmd === "حالة") return send(sock, jid, `ℹ️ حالة صاحب الرقم: ${db.status}`);

  if (cmd === "ألعاب" || cmd === "العاب" || cmd === "games") {
    return send(sock, jid, `🎮 ألعاب 𝐽𝑂𝑂 السريعة
1️⃣ .خمن
2️⃣ .حجر
3️⃣ .سؤال
اكتب الأمر اللي عايزه.`);
  }
  if (cmd === "خمن") {
    state.game = Math.floor(Math.random()*10)+1;
    saveJSON("database.json", db);
    return send(sock, jid, "🎯 خمن رقم من 1 إلى 10 واكتبه في رسالة.");
  }
  if (state.game && !isNaN(Number(raw))) {
    const n = Number(raw);
    if (n === state.game) {
      state.game = null; saveJSON("database.json", db);
      return send(sock, jid, "🎉 صح! كسبت اللعبة 🔥");
    }
    return send(sock, jid, n > state.game ? "⬇️ أقل شوية!" : "⬆️ أعلى شوية!");
  }
  if (cmd === "حجر") {
    const choices = ["🪨 حجر","📄 ورقة","✂️ مقص"];
    return send(sock, jid, `🎲 اختيار 𝐽𝑂𝑂: ${choices[Math.floor(Math.random()*3)]}\nدلوقتي اختار: حجر / ورقة / مقص`);
  }

  if (cmd === "سؤال" || cmd === "اسئلة" || cmd === "أسئلة") {
    const available = questions.filter(q => q.l === state.questionLevel);
    const pool = available.length ? available : questions;
    const q = pool[Math.floor(Math.random()*pool.length)];
    state.question = { index: questions.indexOf(q) };
    saveJSON("database.json", db);
    return send(sock, jid, `❓ سؤال مستوى ${q.l}\n\n${q.q}`);
  }

  if (cmd === "نكتة" || cmd === "نكت") {
    return send(sock, jid, "😂 " + jokes[Math.floor(Math.random()*jokes.length)]);
  }

  if (cmd === "مداعبة") {
    state.tease = true; saveJSON("database.json", db);
    return send(sock, jid, "😜 بدأنا المداعبة! رد عليا بأي رسالة وأنا هكمل معاك. اكتب .وقف_مداعبة للإيقاف.");
  }
  if (cmd === "وقف_مداعبة") {
    state.tease = false; saveJSON("database.json", db);
    return send(sock, jid, "😄 تم إيقاف المداعبة.");
  }

  if (cmd === "حلم") {
    if (!arg) return send(sock, jid, "🌙 اكتب حلمك بعد الأمر، مثال: .حلم رأيت أني أطير");
    return send(sock, jid, `🌙 بخصوص حلمك: "${arg}"\nهذا تفسير عام للترفيه وليس حكماً مؤكداً؛ الأحلام قد تتأثر بالأفكار والمشاعر اليومية. ركّز على التفاصيل التي شعرت بها في الحلم وما تعنيه لك شخصياً.`);
  }

  // فتح القسم السري
  if (cmd === "فتح" || cmd === "unlock") {
    if (arg === SECRET_CODE || isOwner(sender)) {
      db.unlocked[sender] = true; saveJSON("database.json", db);
      return send(sock, jid, "🔓 تم فتح الأقسام الخاصة! اكتب .menu");
    }
    return send(sock, jid, "❌ الكود غير صحيح.");
  }

  // أوامر المالك
  if (cmd === "اوامر_المالك") {
    if (!isOwner(sender)) return send(sock, jid, "⛔ هذا القسم للمالك فقط.");
    return send(sock, jid, ownerMenu());
  }
  if (cmd === "اوامر_المشرف") {
    if (!isMod(sender)) return send(sock, jid, "⛔ للمشرفين فقط.");
    return send(sock, jid, modMenu());
  }

  if (cmd === "متاح" && isOwner(sender)) {
    db.status = "متاح الآن 🟢"; saveJSON("database.json", db);
    return send(sock, jid, "✅ تم تغيير الحالة إلى متاح.");
  }
  if (cmd === "غير_متاح" && isOwner(sender)) {
    db.status = arg || "غير متاح حالياً 🔴"; saveJSON("database.json", db);
    return send(sock, jid, "✅ تم تغيير الحالة.");
  }

  if (cmd === "اضف_مشرف" && isOwner(sender)) {
    const num = arg.replace(/\D/g,"");
    if (!num) return send(sock, jid, "اكتب رقم المشرف بعد الأمر مع كود الدولة.");
    if (!db.mods.includes(num)) db.mods.push(num);
    saveJSON("database.json", db);
    return send(sock, jid, `🛡️ تم إضافة ${num} كمشرف.`);
  }
  if (cmd === "حذف_مشرف" && isOwner(sender)) {
    const num = arg.replace(/\D/g,"");
    db.mods = db.mods.filter(x => x !== num);
    saveJSON("database.json", db);
    return send(sock, jid, `❌ تم حذف ${num} من المشرفين.`);
  }

  if (cmd === "احصائيات" && isOwner(sender)) {
    return send(sock, jid, `📊 إحصائيات 𝐽𝑂𝑂
👤 مستخدمون: ${Object.keys(db.users).length}
🛡️ مشرفون: ${db.mods.length}
📨 محادثات مسجلة: ${db.subscribers.length}`);
  }

  if (cmd === "اذاعة" && isOwner(sender)) {
    if (!arg) return send(sock, jid, "اكتب الرسالة بعد الأمر: .اذاعة مرحباً");
    let ok = 0;
    for (const target of db.subscribers.slice(0, 100)) {
      try { await send(sock, target, `📢 رسالة من 𝐽𝑂𝑂\n\n${arg}`); ok++; }
      catch {}
    }
    return send(sock, jid, `✅ تم إرسال الإعلان إلى ${ok} محادثة مسجلة.`);
  }

  // إعدادات الجروب
  if (["ترحيب_تشغيل","ترحيب_ايقاف","وداع_تشغيل","وداع_ايقاف"].includes(cmd)) {
    if (!isGroup || !isMod(sender)) return send(sock, jid, "⛔ الأمر للمشرف/المالك داخل الجروبات.");
    db.groups[jid] ||= { welcome:true, goodbye:true };
    if (cmd === "ترحيب_تشغيل") db.groups[jid].welcome = true;
    if (cmd === "ترحيب_ايقاف") db.groups[jid].welcome = false;
    if (cmd === "وداع_تشغيل") db.groups[jid].goodbye = true;
    if (cmd === "وداع_ايقاف") db.groups[jid].goodbye = false;
    saveJSON("database.json", db);
    return send(sock, jid, "✅ تم حفظ إعداد الجروب.");
  }

  return send(sock, jid, "🤖 مش فاهم الأمر. اكتب .menu");
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: "silent" }),
    browser: ["𝐽𝑂𝑂 Bot", "Chrome", "1.0.0"],
    markOnlineOnConnect: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) console.log("📱 امسح QR من واتساب > الأجهزة المرتبطة");
    if (connection === "open") console.log("✅ 𝐽𝑂𝑂 WhatsApp Bot متصل!");
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log("🔄 إعادة الاتصال...");
        setTimeout(startBot, 3000);
      } else {
        console.log("❌ تم تسجيل الخروج. احذف auth_info ثم اربط الحساب من جديد.");
      }
    }
  });

  sock.ev.on("group-participants.update", async (event) => {
    const settings = db.groups[event.id] || { welcome:true, goodbye:true };
    for (const participant of event.participants) {
      if (event.action === "add" && settings.welcome) {
        await send(sock, event.id,
          `🎉 أهلاً بك ${mention(participant)}\nنورت الجروب! أنا بوت 𝐽𝑂𝑂 🤖\n\n📌 الأقسام: 🎮 ألعاب | ❓ أسئلة | 😂 نكت | 😄 مداعبة | 🌙 أحلام\nاكتب .menu`,
          { mentions:[participant] });
      }
      if (event.action === "remove" && settings.goodbye) {
        await send(sock, event.id, `👋 وداعاً ${mention(participant)}\nنتمنى نشوفك مرة ثانية ❤️`, { mentions:[participant] });
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;
        const jid = msg.key.remoteJid;
        if (jid === "status@broadcast") continue;
        const sender = msg.key.participant || jid;
        const text = getText(msg);
        if (!text) continue;
        await handleCommand(sock, msg, jid, sender, text, jid.endsWith("@g.us"));
      } catch (e) {
        console.error("Message error:", e.message);
      }
    }
  });
}

console.log("🤖 جاري تشغيل 𝐽𝑂𝑂 WhatsApp Bot...");
startBot().catch(console.error);
