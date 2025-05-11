require("dotenv").config();
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const input = require("input");
const fetch = require("node-fetch");
const fs = require("fs");

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const botToken = process.env.BOT_TOKEN;
const targetChatId = parseInt(process.env.CHAT_ID);
const keywords = (process.env.KEYWORDS || "").split(",").map((w) => w.trim());

const stringSession = new StringSession(
  process.env.SESSION ||
    (fs.existsSync("session.txt")
      ? fs.readFileSync("session.txt", "utf8")
      : ""),
);

async function sendNotification(text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: targetChatId, text }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error("❌ Ошибка Telegram API:", data);
    } else {
      console.log("✅ Уведомление отправлено.");
    }
  } catch (error) {
    console.error("❌ Ошибка при отправке уведомления:", error);
  }
}

(async () => {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Введите номер телефона: "),
    password: async () => await input.text("Введите 2FA пароль (если есть): "),
    phoneCode: async () => await input.text("Введите код подтверждения: "),
    onError: (err) => console.log(err),
  });

  console.log("✅ Успешно авторизован!");
  fs.writeFileSync("session.txt", client.session.save());

  await client.sendMessage("me", { message: "Скрипт Telegram запущен!" });

  client.addEventHandler(async (event) => {
    const sender = await event.message.getSender();
    const isBot = sender?.bot;

    if (isBot) return;

    const text = event.message?.message;

    if (
      text &&
      keywords.some((word) => text.toLowerCase().includes(word.toLowerCase()))
    ) {
      console.log("Найдено:", text);

      let messageLink = null;

      try {
        const peer = event.message.peerId;
        const messageId = event.message.id;
        const entity = await client.getEntity(peer);

        if (entity.username) {
          messageLink = `https://t.me/${entity.username}/${messageId}`;
          await client.sendMessage("me", { message: messageLink });
        } else {
          console.log("⚠️ Группа/канал не имеет username, ссылка невозможна.");
        }
      } catch (error) {
        console.error("⚠️ Не удалось сформировать ссылку:", error);
      }

      const finalText = messageLink
        ? `💬 Найдено сообщение:\n\n${text}\n\n🔗 ${messageLink}`
        : `💬 Найдено сообщение:\n\n${text}`;

      await sendNotification(finalText);
    }
  }, new NewMessage({}));
})();
