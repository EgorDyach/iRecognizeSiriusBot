import { ConversationFlavor, Conversation } from "@grammyjs/conversations";
import { Bot, Context } from "grammy";

let token = process.env.BOT_TOKEN;
if (!token) token = "123";
export const bot = new Bot(token);

bot.api.setMyCommands([
  {
    command: "start",
    description: "Начать участие во флешмобе.",
  },
  {
    command: "menu",
    description: "Открыть меню участника.",
  },
]);

export type MyContext = Context & ConversationFlavor;
export type MyConversation = Conversation<MyContext>;

export const taskTypeEmoji = {
  photo: "📸",
  basic: "📝",
  friend: "👥",
};

export const taskTypeText = {
  photo: "📸 Фото-задание",
  friend: "👥 Собери команду",
  basic: "📝 Простое задание",
};

export const tasksKeyboardEmoji = {
  "not completed": "⭕️",
  completed: "✅",
  checking: "🔘",
  skipped: "⚫️",
};

export const tasksKeyboardName = {
  photo: "Фото-задание",
  friend: "Дружеское задание",
  basic: "Задание",
};
