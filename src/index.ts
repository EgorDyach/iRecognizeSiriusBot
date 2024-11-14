// IMPORTS
import format from "pg-format";
import { db } from "./db";
import plural from "plural-ru";
import {
  Bot,
  session,
  API_CONSTANTS,
  Keyboard,
  InlineKeyboard,
  Context,
  Middleware,
} from "grammy";
import {
  Conversation,
  ConversationFlavor,
  conversations,
  createConversation,
} from "@grammyjs/conversations";
import fs from "fs";

import * as dotenv from "dotenv";
dotenv.config();
//
//
//
//
//
// CONSTANTS
//
let token = process.env.BOT_TOKEN;
if (!token) token = "123";
const bot = new Bot(token);

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

type MyContext = Context & ConversationFlavor;
type MyConversation = Conversation<MyContext>;

const taskTypeEmoji = {
  photo: "📸",
  basic: "📝",
  friend: "👥",
};

const taskTypeText = {
  photo: "📸 Фото-задание",
  friend: "👥 Собери команду",
  basic: "📝 Простое задание",
};

const tasksKeyboardEmoji = {
  "not completed": "⭕️",
  completed: "✅",
  checking: "🔘",
};

const tasksKeyboardName = {
  photo: "Фото-задание",
  friend: "Дружеское задание",
  basic: "Задание",
};
//
//
//
//
//
// KEYBOARDS
//
const IKViewLevel = new InlineKeyboard()
  .text("< Назад", "viewLevel_cancel")
  .text("test level", "viewLevel_0")
  .text("level 1", "viewLevel_1")
  .row()
  .text("level 2", "viewLevel_2")
  .text("level 3", "viewLevel_3")
  .text("level 4", "viewLevel_4");

const IKRemoveLevel = new InlineKeyboard()
  .text("< Назад", "removeLevel_cancel")
  .text("test level", "removeLevel_0")
  .text("level 1", "removeLevel_1")
  .row()
  .text("level 2", "removeLevel_2")
  .text("level 3", "removeLevel_3")
  .text("level 4", "removeLevel_4");

const IKAddLevel = new InlineKeyboard()
  .text("< Назад", "addTaskLevel_cancel")
  .text("test level", "addTaskLevel_0")
  .text("level 1", "addTaskLevel_1")
  .row()
  .text("level 2", "addTaskLevel_2")
  .text("level 3", "addTaskLevel_3")
  .text("level 4", "addTaskLevel_4");

const IKAdminMenu = new InlineKeyboard()
  .text("Просмотреть отчеты", "reviewTasks")
  .row()
  .text("Добавить задание", "addTaskMenu")
  .row()
  .text("Просмотреть задания", "viewTaskMenu")
  .row()
  .text("Разблокировать уровень", "unlockLevelMenu")
  .row()
  .text("Удалить задание", "removeTaskMenu")
  .row()
  .text("Выйти из админов", "leaveAdmin");

const IKUserMenu = new InlineKeyboard()
  .text("🔢 Уровни", "levels")
  .row()
  .text("👀 Рейтинг", "rating")
  .row()
  .text("📋 Правила", "rules")
  .row()
  .text("📞 Контакты", "contacts");

const IKRules = new InlineKeyboard()
  .text("🗓 Календарь проведения", "rulesItem_calendar")
  .row()
  .text("📋 Алгоритм участия", "rulesItem_algorithm")
  .row()
  .text("📊 Этапы флешмоба", "rulesItem_steps")
  .row()
  .text("🏆 Итоги", "rulesItem_results")
  .row()
  .text("В меню", "openMenu");

const IKCancelAddingTask = new InlineKeyboard().text(
  "< Отмена",
  "cancelAddingTask"
);

const IKUnlockMenu = new InlineKeyboard()
  .text("✅ Открыть", "unlockLevel")
  .text("< Отмена", "openMenu");

const IKOpenMenu = new InlineKeyboard().text("В меню", "openMenu");

//
//
//
//
//
// UTILS

async function createNewTask(conversation: MyConversation, ctx: MyContext) {
  await ctx.editMessageText("Введите само задание.", {
    reply_markup: IKCancelAddingTask,
  });

  const msg = await conversation.waitFor(":text", {
    otherwise: async (ctx) => {
      if (ctx.callbackQuery?.data === "cancelAddingTask") {
        await setMenu(ctx);
        return;
      }
      await ctx.reply("Необходимо ввести задание.");
    },
  });

  await ctx.reply("Вводить описание заданию?", {
    reply_markup: new Keyboard().text("Да").text("Нет").resized().oneTime(),
  });
  const yesOrNoRes = await conversation.waitFor(":text", {
    otherwise: async (ctx) => {
      if (ctx.callbackQuery?.data === "cancelAddingTask") {
        await setMenu(ctx);
        return;
      }
      await ctx.reply('Необходимо ввести "Да" или "Нет".');
    },
  });
  let yesOrNo = yesOrNoRes.message?.text;
  while (yesOrNo !== "Да" && yesOrNo !== "Нет") {
    await ctx.reply(
      'Необходимо ответить "Да" или "Нет", вводить описание заданию?',
      {
        reply_markup: new Keyboard().text("Да").text("Нет").resized().oneTime(),
      }
    );
    const yesOrNoRes = await conversation.waitFor(":text", {
      otherwise: async (ctx) =>
        await ctx.reply('Необходимо ввести "Да" или "Нет".'),
    });

    yesOrNo = yesOrNoRes.message?.text;
  }
  let description = null;

  if (yesOrNo === "Да") {
    await ctx.reply("Введите описание задания.");
    const msg = await conversation.waitFor(":text", {
      otherwise: async (ctx) => {
        await ctx.reply("Необходимо ввести описание задания.");
      },
    });
    description = msg.message?.text;
  }

  await ctx.reply("Прикреплять фото к заданию?", {
    reply_markup: new Keyboard().text("Да").text("Нет").resized().oneTime(),
  });
  const yesOrNoRes2 = await conversation.waitFor(":text", {
    otherwise: async (ctx) =>
      await ctx.reply('Необходимо ввести "Да" или "Нет".'),
  });
  yesOrNo = yesOrNoRes2.message?.text;
  while (yesOrNo !== "Да" && yesOrNo !== "Нет") {
    await ctx.reply(
      'Необходимо ответить "Да" или "Нет", прикреплять фото к заданию?',
      {
        reply_markup: new Keyboard().text("Да").text("Нет").resized().oneTime(),
      }
    );
    const yesOrNoRes2 = await conversation.waitFor(":text", {
      otherwise: async (ctx) =>
        await ctx.reply('Необходимо ввести "Да" или "Нет".'),
    });

    yesOrNo = yesOrNoRes2.message?.text;
  }

  let photo = null;
  if (yesOrNo === "Да") {
    await ctx.reply("Пришлите фото к заданию.");
    const msg = await conversation.waitFor(":photo", {
      otherwise: async (ctx) =>
        await ctx.reply("Необходимо прислать фото к заданию."),
    });
    photo = msg.message?.photo;
    while (!photo) {
      await ctx.reply("Необходимо прислать фото к заданию.");
      const msg = await conversation.waitFor("msg");
      photo = msg.message?.photo;
    }
  }

  await ctx.reply("Введите ответ на задание.", {
    reply_markup: { remove_keyboard: true },
  });
  const answer = await conversation.waitFor(":text", {
    otherwise: async (ctx) =>
      await ctx.reply("Необходимо прислать ответ в текстовом формате."),
  });

  if (photo) {
    await ctx.replyWithPhoto(photo[photo.length - 1].file_id, {
      // @ts-ignore
      caption: `🔢 Уровень: ${ctx.session.addingTaskLevel}
Тип: ${(() => {
        // @ts-ignore
        return taskTypeText[ctx.session.addingTaskType];
      })()}
👉🏻 Задание: ${msg.message?.text}
${
  !!description
    ? `
📖 Описание: ${description}`
    : ""
}
❗️ Ответ: ${answer.message?.text}`,
    });
  } else {
    await ctx.reply(
      // @ts-ignore
      `🔢 Уровень: ${ctx.session.addingTaskLevel}
Тип: ${(() => {
        // @ts-ignore
        return taskTypeText[ctx.session.addingTaskType];
      })()}

👉🏻 Задание: ${msg.message?.text}
${
  !!description
    ? `
  📖 Описание: ${description}`
    : ""
}
❗️ Ответ: ${answer.message?.text}`
    );
  }
  await db.query(
    "INSERT INTO level_tasks (task_type, task, task_description, answer, photo, level) VALUES ($1, $2, $3, $4, $5, $6)",
    [
      // @ts-ignore
      ctx.session.addingTaskType,
      msg.message?.text,
      description,
      answer.message?.text,
      photo ? photo[photo?.length - 1].file_id : null,
      // @ts-ignore
      ctx.session.addingTaskLevel,
    ]
  );
  await ctx.reply("✅ Задание успешно создано!", {
    reply_markup: IKAdminMenu,
  });
}

async function greeting(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply("Как вас зовут? (ФИО)");
  const nameRes = await conversation.waitFor("msg:text", {
    otherwise: async (ctx) => await ctx.reply("Необходимо ввести ФИО."),
  });
  let name = nameRes.message?.text || "";
  while (name.split(" ").length < 3) {
    await ctx.reply("Необходимо ввести ФИО.");
    const nameRes = await conversation.waitFor("msg:text", {
      otherwise: async (ctx) => await ctx.reply("Необходимо ввести ФИО."),
    });
    name = nameRes.message?.text || "";
  }

  await db.query("UPDATE users SET name = $1 WHERE id = $2", [
    name,
    ctx.from?.id,
  ]);

  await ctx.reply("Приятно познакомиться!");

  await ctx.reply("С какого вы курса?");
  let course = await conversation.waitFor("msg:text", {
    otherwise: async (ctx) => await ctx.reply("Необходимо ввести номер курса."),
  });
  while (isNaN(Number(course.message?.text))) {
    await ctx.reply("Введите номер курса (число).");
    course = await conversation.waitFor(":text", {
      otherwise: async (ctx) =>
        await ctx.reply("Необходимо ввести номер курса."),
    });
  }
  await db.query("UPDATE users SET course = $1 WHERE id = $2", [
    course.message?.text,
    ctx.from?.id,
  ]);
  await ctx.reply("А из какой группы?");
  const group = await conversation.waitFor("msg:text", {
    otherwise: async (ctx) =>
      await ctx.reply("Необходимо ввести название группы."),
  });
  await db.query("UPDATE users SET college_group = $1 WHERE id = $2", [
    group.message?.text,
    ctx.from?.id,
  ]);
  await ctx.reply(
    "Теперь пришлите мне свое портретное фото!\nВажно, это фото будет использоваться для проверки выполнения заданий по селфи!"
  );
  const photo = await conversation.waitFor("msg:photo", {
    otherwise: async (ctx) =>
      await ctx.reply("Необходимо прислать портретное фото."),
  });

  await db.query("UPDATE users SET photo = $1 WHERE id = $2", [
    photo.message?.photo[photo.message?.photo.length - 1].file_id,
    ctx.from?.id,
  ]);
  const getLevelTasks = async (
    level: number,
    taskType: "basic" | "photo" | "friend",
    limit: number
  ) => {
    return (
      await db.query(
        `SELECT * FROM level_tasks WHERE level = $1 AND task_type = $2 ORDER BY RANDOM() LIMIT $3;`,
        [level, taskType, limit]
      )
    ).rows.map((el) => [el.id, ctx.from?.id, "not completed", level, null]);
  };
  const levels0 = await getLevelTasks(0, "basic", 1);
  const levels1basic = await getLevelTasks(1, "basic", 4);
  const levels1photo = await getLevelTasks(1, "photo", 1);
  const levels2basic = await getLevelTasks(2, "basic", 4);
  const levels2photo = await getLevelTasks(2, "photo", 2);
  const levels2friend = await getLevelTasks(2, "friend", 1);
  const levels3basic = await getLevelTasks(3, "basic", 6);
  const levels3photo = await getLevelTasks(3, "photo", 1);
  const levels3friend = await getLevelTasks(3, "friend", 1);
  const levels4basic = await getLevelTasks(4, "basic", 3);
  const values = [
    ...levels0,
    ...levels1basic,
    ...levels1photo,
    ...levels2basic,
    ...levels2photo,
    ...levels2friend,
    ...levels3basic,
    ...levels3photo,
    ...levels3friend,
    ...levels4basic,
  ];
  console.log(values);
  await db.query(
    format(
      "INSERT INTO tasks_status (task_id, user_id, status, level, friendship_id) VALUES %L",
      values
    )
  );

  await ctx.reply("Приятно познакомиться!");
  await ctx.reply("📃 <b><u>Меню</u></b>", {
    reply_markup: IKUserMenu,
    parse_mode: "HTML",
  });
}
const getTextAnswer = async (conversation: MyConversation, ctx: MyContext) => {
  await ctx.reply(
    "Для выполнения задания пришлите текстовое сообщение с ответом."
  );
  const res = await conversation.waitFor(":text", {
    otherwise: async (ctx) =>
      await ctx.reply(
        "Необходимо прислать текстовое сообщение с нужным ответом."
      ),
  });
  // @ts-ignore
  await db.query(
    "UPDATE tasks_status SET user_answer_text = $1, status =  $2 WHERE id = $3;",
    [
      // @ts-ignore
      res.message.text,
      "checking",
      // @ts-ignore
      ctx.session.taskId,
    ]
  );
  await db.query(
    "INSERT INTO tasks (tasks_status_id, checked_by) VALUES ($1, $2)",
    // @ts-ignore
    [ctx.session.taskId, null]
  );
  await ctx.reply("Ваше задание на проверке.", {
    reply_markup: IKUserMenu,
  });
};
const getPhotoAnswer = async (conversation: MyConversation, ctx: MyContext) => {
  await ctx.reply(
    "Для выполнения задания пришлите фото-селфи с нужным ответом."
  );
  const photoRes = await conversation.waitFor(":photo", {
    otherwise: async (ctx) =>
      await ctx.reply("Необходимо прислать фото-селфи с нужным ответом."),
  });
  await db.query(
    "UPDATE tasks_status SET user_answer_photo = $1, user_answer_text = $2 AND status = $3 WHERE id = $4",
    [
      photoRes.message?.photo.at(-1)?.file_id || null,
      photoRes.message?.caption || null,
      "checking",
      // @ts-ignore
      ctx.session.taskId,
    ]
  );
  await db.query(
    "INSERT INTO tasks (tasks_status_id, checked_by) VALUES ($1, $2)",
    // @ts-ignore
    [ctx.session.taskId, null]
  );
  await ctx.reply("Ваше задание на проверке.", {
    reply_markup: IKUserMenu,
  });
};

const getFriendAnswer = async (
  conversation: MyConversation,
  ctx: MyContext
) => {
  const myKeyboard = new Keyboard()
    .text("Создать команду")
    .text("Присоединиться");
  await ctx.reply(
    "Для выполнения задания необходимо создать свою команду или присоединиться к кому-то.",
    { reply_markup: myKeyboard }
  );
  const res = await conversation.waitFor(":text", {
    otherwise: async (ctx) =>
      await ctx.reply(
        "Необходимо выбрать 'Создать команду' или 'Присоединиться'."
      ),
  });
  let text = res.message?.text;
  while (text !== "Создать команду" && text !== "Присоедниться") {
    await ctx.reply(
      "Необходимо выбрать 'Создать команду' или 'Присоединиться'."
    );
    const res = await conversation.waitFor(":text", {
      otherwise: async (ctx) =>
        await ctx.reply(
          "Необходимо выбрать 'Создать команду' или 'Присоединиться'."
        ),
    });
    text = res.message?.text;
  }
  if (text === "Присоедниться") {
    const myKeyboard = new Keyboard().text("Создать команду").text("В меню");
    await ctx.reply(
      "Введите ник одного из участников команды в формате @example.",
      {
        reply_markup: myKeyboard,
      }
    );
    const res = await conversation.waitFor(":text", {
      otherwise: async (ctx) =>
        await ctx.reply(
          "Необходимо ввести ник одного из участников команды в формате @example.",
          {
            reply_markup: myKeyboard,
          }
        ),
    });
    let nick = res.message?.text;
    let friendShipRes = await db.query(
      "SELECT * FROM friendships WHERE $1 = ANY(users_nicks);",
      [nick]
    );
    while (
      !friendShipRes.rowCount &&
      nick !== "Создать команду" &&
      nick !== "В меню"
    ) {
      await ctx.reply(
        "Не удалось найти такую команду. Убедитесь в правильности ника.",
        {
          reply_markup: myKeyboard,
        }
      );
      const res = await conversation.waitFor(":text", {
        otherwise: async (ctx) =>
          await ctx.reply(
            "Необходимо ввести ник одного из участников команды в формате @example.",
            {
              reply_markup: myKeyboard,
            }
          ),
      });
      nick = res.message?.text;
      friendShipRes = await db.query(
        "SELECT * FROM friendships WHERE $1 = ANY(users_nicks);",
        [nick]
      );
    }
    if (nick === "В меню") {
      await setMenu(ctx);
      return;
    }
    if (friendShipRes.rowCount) {
      const user = await db.query("SELECT * FROM users WHERE id = $1", [
        ctx.from?.id,
      ]);
      await db.query(
        "UPDATE friendships SET users_nicks = $1 AND users_ids = $2 WHERE id = $3",
        [
          [...friendShipRes.rows[0].users_nicks, user.rows[0].nick],
          [...friendShipRes.rows[0].users_nicks, user.rows[0].id],
          friendShipRes.rows[0].id,
        ]
      );
      await db.query("UPDATE users SET friendship_id = $1 WHERE id = $2", [
        friendShipRes.rows[0].id,
        user.rows[0].id,
      ]);
      return;
    }
  }
  await ctx.reply("Окей, создали под вас команду");
};
bot.use(
  session({
    initial() {
      // return empty object for now
      return {
        addingTaskLevel: 0,
        addingTaskType: "basic",
        taskId: 0,
      };
    },
  }) as Middleware<Context>
);

// Install the conversations plugin.
bot.use(conversations() as Middleware<Context>);
bot.use(createConversation(greeting) as Middleware<Context>);
bot.use(createConversation(createNewTask) as Middleware<Context>);
bot.use(createConversation(getPhotoAnswer) as Middleware<Context>);
bot.use(createConversation(getTextAnswer) as Middleware<Context>);
bot.use(createConversation(getFriendAnswer) as Middleware<Context>);

// HELPERS

async function isSuperAdmin(id: number) {
  try {
    const user = (await db.query(`SELECT * FROM users WHERE id = $1`, [id]))
      .rows[0];
    if (user && user.role === "super_admin") return true;
  } catch (e) {
    return false;
  }
  return false;
}

async function isAdmin(id: number) {
  try {
    const user = (await db.query(`SELECT * FROM users WHERE id = $1`, [id]))
      .rows[0];
    if (!user || user.role === "student") {
      return false;
    }
  } catch (e) {
    return false;
  }
  return true;
}

bot.command("start", async (ctx) => {
  const user = (
    await db.query(`SELECT * FROM users WHERE id = $1`, [ctx.from?.id])
  ).rows[0];
  if (!user) {
    await db.query(
      `INSERT INTO users (id, nick, name, photo, college_group, course, role, points)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [
        ctx.from?.id,
        (ctx.from?.username || "").toLowerCase(),
        null,
        null,
        null,
        null,
        "student",
        0,
      ]
    );
    await ctx.reply(
      "Привет! Для участия во флешмобе необходимо пройти обязательную регистрацию!"
    );
    // @ts-ignore
    await ctx.conversation.enter("greeting");
    return;
  }
  await setMenu(ctx);
});

const setMenu = async (ctx: Context) => {
  const isAdminRes = await isAdmin(ctx.from?.id || 0);
  try {
    await ctx.editMessageText(
      "📃 <b><u>Меню</u></b>",
      isAdminRes
        ? { parse_mode: "HTML", reply_markup: IKAdminMenu }
        : { parse_mode: "HTML", reply_markup: IKUserMenu }
    );
  } catch (e) {
    console.log(e);
    await ctx.reply(
      "📃 <b><u>Меню</u></b>",
      isAdminRes
        ? { parse_mode: "HTML", reply_markup: IKAdminMenu }
        : { parse_mode: "HTML", reply_markup: IKUserMenu }
    );
  }
};

bot.on("callback_query:data", async (ctx) => {
  await ctx.answerCallbackQuery();
  const data = ctx.callbackQuery.data;

  const [action, id] = data.split("_");

  switch (action) {
    case "openMenu":
      await setMenu(ctx);
      break;

    case "unlockLevelMenu":
      const settings_ = await db.query("SELECT * FROM settings");
      const curLev = settings_.rows[0].level;
      await ctx.editMessageText(
        `Вы уверены, что хотите открыть уровень ${curLev + 1}?`,
        { reply_markup: IKUnlockMenu }
      );
      break;

    case "unlockLevel":
      await ctx.editMessageText(`Загрузка...`);
      const settings__ = await db.query("SELECT * FROM settings");
      const newLev = settings__.rows[0].level + 1;
      await db.query("UPDATE settings SET level = $1 WHERE id = 1", [newLev]);
      const usersRows = await db.query(
        "SELECT * FROM users WHERE role = 'student'"
      );
      for (const item of usersRows.rows) {
        await bot.api.sendMessage(
          item.id,
          `🎉 Открыт <b><u>уровень ${newLev}</u></b>!`,
          {
            parse_mode: "HTML",
          }
        );
      }
      await ctx.editMessageText(`🎉 Открыт <b><u>уровень ${newLev}</u></b>!`, {
        parse_mode: "HTML",
        reply_markup: IKOpenMenu,
      });
      break;

    case "cancelAddingTask":
      // @ts-ignore
      await ctx.conversation.exit("createNewTask");
      break;

    case "superAdminMenu":
      const isAdminRes = await isAdmin(ctx.from?.id || 0);
      await ctx.editMessageText(
        "<b><u>Меню</u></b>",
        isAdminRes
          ? { parse_mode: "HTML", reply_markup: IKAdminMenu }
          : { parse_mode: "HTML", reply_markup: IKAdminMenu }
      );
      break;
    //
    //
    // SUPERADMIN
    //
    case "leaveAdmin":
      await db.query("UPDATE users SET role = $1 WHERE id = $2", [
        "student",
        ctx.from.id,
      ]);
      await ctx.editMessageText("Спасибо за вашу помощь! 🫶🏻");
      await ctx.reply("📃 <b><u>Меню</u></b>", {
        reply_markup: IKUserMenu,
        parse_mode: "HTML",
      });
      break;
    case "removeTaskMenu":
      await ctx.editMessageText(
        "Выберите уровень, на котором хотите удалить задание.",
        {
          reply_markup: IKRemoveLevel,
        }
      );
      break;

    case "removeLevel":
      if (id === "cancel") {
        await setMenu(ctx);
        return;
      }
      const items = await db.query(
        "SELECT * FROM level_tasks WHERE level = $1",
        [Number(id)]
      );
      const inlineKeyboard = new InlineKeyboard()
        .text("< Назад", "removeTask_back")
        .row();

      if (!items.rowCount) {
        await ctx.editMessageText("Не удалось найти ни одного задания.", {
          reply_markup: inlineKeyboard,
        });
        return;
      }

      items.rows.map((item, index) => {
        const newKeyboard = inlineKeyboard.text(
          `${taskTypeEmoji[item.task_type as keyof typeof taskTypeEmoji]} ${
            item.task
          }`,
          `removeTask_${item.id}`
        );
        if (index % 2) {
          newKeyboard.row();
        }
      });
      await ctx.editMessageText("Выберите задание, которое хотите удалить.", {
        reply_markup: inlineKeyboard,
      });
      break;

    case "removeTask":
      if (id === "back") {
        await ctx.editMessageText(
          "Выберите уровень, на котором хотите удалить задание.",
          {
            reply_markup: IKRemoveLevel,
          }
        );
        return;
      }
      try {
        await db.query("DELETE FROM level_tasks WHERE id = $1", [id]);
        await ctx.editMessageText("✅ Успешно удалено!", {
          reply_markup: new InlineKeyboard().text("< Назад", "removeTask_back"),
        });
      } catch (error) {
        const inlineKeyboard = new InlineKeyboard()
          .text("< Назад", "removeTask_back")
          .row();
        await ctx.editMessageText(
          `Не удалось удалить задание: ${String(error)}.`,
          {
            reply_markup: inlineKeyboard,
          }
        );
      }
      break;

    case "viewTaskMenu":
      await ctx.editMessageText(
        "Выберите уровень, который хотите просмотреть.",
        {
          reply_markup: IKViewLevel,
        }
      );
      break;

    case "viewLevel":
      if (id === "cancel") {
        await setMenu(ctx);
        return;
      }
      const viewItems = await db.query(
        "SELECT * FROM level_tasks WHERE level = $1",
        [Number(id)]
      );
      const viewInlineKeyboard = new InlineKeyboard()
        .text("< Назад", "viewLevel_cancel")
        .row();

      if (!viewItems.rowCount) {
        await ctx.editMessageText("Не удалось найти ни одного задания.", {
          reply_markup: viewInlineKeyboard,
        });
        return;
      }

      viewItems.rows.map((item, index) => {
        const newKeyboard = viewInlineKeyboard.text(
          `${taskTypeEmoji[item.task_type as keyof typeof taskTypeEmoji]} ${
            item.task
          }`,
          `viewTask_${item.id}`
        );
        if (index % 2) {
          newKeyboard.row();
        }
      });
      await ctx.editMessageText("Выберите задание, которое хотите удалить.", {
        reply_markup: viewInlineKeyboard,
      });
      break;
      break;
    case "addTaskMenu":
      await ctx.editMessageText(
        "Выберите уровень, на который хотите добавить задание.",
        {
          reply_markup: IKAddLevel,
        }
      );
      break;

    case "viewTask":
      break;
    case "addTaskLevel":
      if (id === "cancel") {
        await setMenu(ctx);
        return;
      }
      // @ts-ignore
      ctx.session.addingTaskLevel = id;
      const inlineKeyboardAdd = new InlineKeyboard()
        .text("<br Назад", "addTask_back")
        .row()
        .text("📸 Фото-задание", "addTask_photo")
        .row()
        .text("👥 Собери команду", "addTask_friend")
        .row()
        .text("📝 Простое задание", "addTask_basic");

      await ctx.editMessageText("Выберите задание, которое хотите добавить.", {
        reply_markup: inlineKeyboardAdd,
      });
      break;

    case "addTask":
      if (id === "back") {
        await ctx.editMessageText(
          "Выберите уровень, на котором хотите добавить задание.",
          {
            reply_markup: IKAddLevel,
          }
        );
        return;
      }
      // @ts-ignore
      ctx.session.addingTaskType = id;
      // @ts-ignore
      await ctx.conversation.enter("createNewTask");
      break;

    // USER
    case "contacts":
      await ctx.editMessageText(
        `<b><u>Контакты</u></b>

🤖 Ник бота: @iRecognizeSiriusbot;
📞 Контакты администратора: @irinka_potapova;
📆 Даты флешмоба: 16 нояб. – 8 дек.`,
        {
          parse_mode: "HTML",
          reply_markup: IKOpenMenu,
        }
      );
      break;
    case "rules":
      await ctx.editMessageText(
        `🤖 Флешмоб <b>«Я узнаю Сириус»</b>

📅 Период проведения: <i>11 ноября – 9 декабря 2024 года</i>

📍 Территория проведения: <b>ФТ «Сириус»</b>

👥 Участники: <i>обучающиеся Научно-технологического университета «Сириус»</i>

💬 Удачи всем участникам!`,
        {
          parse_mode: "HTML",
          reply_markup: IKRules,
        }
      );
      break;
    case "rulesItem":
      switch (id) {
        case "calendar":
          await ctx.editMessageText(
            `🗓 <b><u>Календарь проведения</u></b>

✔️ <b>11 – 15 ноября</b>: регистрация
✔️ <b>16 – 17 ноября</b>: старт первого этапа и первые задания
✔️ <b>23 – 24 ноября</b>: старт второго этапа
✔️ <b>30 ноября – 1 декабря</b>: старт третьего этапа
✔️ <b>8 декабря</b>: очный этап
✔️ <b>9 декабря</b>: подведение итогов и размещение таблицы с результатами
✔️ <b>9 – 16 декабря</b>: вручение наград лидерам
`,
            {
              parse_mode: "HTML",
              reply_markup: new InlineKeyboard().text("< Назад", "rules"),
            }
          );
          break;
        case "algorithm":
          await ctx.editMessageText(
            `📋 <b><u>Алгоритм участия</u></b>

📝 <b>Регистрация</b>:
✔️ Каждый участник должен зарегистрироваться индивидуально, указав полное ФИО, группу, курс и отправив портретное фото.
✔️ Регистрация открыта с 11 ноября до 8 декабря включительно. Присоединиться можно на любом этапе, но нужно выполнить все предыдущие задания.

✍️ <b>Задания</b>:
✔️ С 16 ноября по 9 декабря вы будете получать задания. Каждый новый этап открывается по субботам. Задания можно выполнять в течение всей недели.
✔️ Пропуск задания возможен, но это повлияет на количество заработанных баллов.
✔️ Задания делятся на 3 типа:

    📸 Фото-задание - необходимо найти локацию и сфотографироваться на ее фоне;

    👥 Собери команду - необходимо собрать себе команду, с которой вы будете дальше выполнять задания (P.S. за это начисляются доп. баллы);

    📝 Простое задание - необходимо ответить на вопрос о ФТ «Сириус».

    
🚫 <b>Ограничения</b>:
✔️ Использование программ и приложений для фотомонтажа недопустимо. За это участник будет дисквалифицирован.`,
            {
              parse_mode: "HTML",
              reply_markup: new InlineKeyboard().text("< Назад", "rules"),
            }
          );
          break;
        case "steps":
          await ctx.editMessageText(
            `📋 <b><u>📊 Этапы флешмоба</u></b>

1️⃣ <b>Первый этап (с 16 ноября):</b>
✔️ 5 баллов за выход на локацию
✔️ 1 балл за остальные задания

2️⃣ <b>Второй этап (с 23 ноября):</b>
✔️ 4 задания по 1 баллу
✔️ 1 задание – 3 балла
✔️ 2 задания – 5 баллов

3️⃣ <b>Третий этап (с 30 ноября):</b>
✔️ 6 заданий по 1 баллу
✔️ 1 задание – 3 балла
✔️ 3 задания по 5 баллов

4️⃣ <b>Четвертый этап (с 7 декабря):</b>
✔️ 3 задания, 1 балл за каждое.

ℹ️ <b>Очный финал (8 декабря):</b>
✔️ 5 заданий, 5 баллов за каждое, дополнительные баллы за контент и скорость выполнения.`,
            {
              parse_mode: "HTML",
              reply_markup: new InlineKeyboard().text("< Назад", "rules"),
            }
          );
          break;

        case "results":
          await ctx.editMessageText(
            `📋 <b><u>📊 🏆 Итоги</u></b>

🎉 <u><i>9 декабря</i></u> будет опубликована рейтинговая таблица с баллами.

🎁 Награждаются <b>команды-победительницы</b> (от 5 до 10 команд) и игрок с <b>максимальным</b> индивидуальным количеством баллов.`,
            {
              parse_mode: "HTML",
              reply_markup: new InlineKeyboard().text("< Назад", "rules"),
            }
          );
          break;
        default:
          await ctx.editMessageText(
            `🤖 Флешмоб <b>«Я узнаю Сириус»</b>

📅 Период проведения: <i>11 ноября – 9 декабря 2024 года</i>

📍 Территория проведения: <b>ФТ «Сириус»</b>

👥 Участники: <i>обучающиеся Научно-технологического университета «Сириус»</i>

💬 Удачи всем участникам!`,
            {
              parse_mode: "HTML",
              reply_markup: IKRules,
            }
          );
          break;
      }
      break;
    case "rating":
      const points = (
        await db.query("SELECT * FROM users WHERE id = $1", [ctx.from.id])
      ).rows[0].points;
      console.log(points);
      const maxRating = await db.query(`SELECT *
FROM users
ORDER BY points DESC
LIMIT 10;`);

      await ctx.editMessageText(
        `<b><u>📊 Рейтинг</u></b>

✍️ У вас <b>${plural(points || 0, "%d балл", "%d балла", "%d баллов")}</b>

<i>P.S. Баллы можно заработать, выполняя задания, объединяясь в команы и придя на очный этап!</i>`,
        {
          reply_markup: IKOpenMenu,
          parse_mode: "HTML",
        }
      );
      break;
    case "levels":
      const allLevels = await db.query(
        "SELECT * FROM tasks_status WHERE user_id = $1",
        [ctx.from.id]
      );
      const settings = await db.query("SELECT * FROM settings");

      await ctx.editMessageText("🔢 <b><u>Уровни</u></b>", {
        reply_markup: new InlineKeyboard()
          .text(
            `${
              !allLevels.rows.filter(
                (el) => el.level === 0 && el.status !== "completed"
              ).length
                ? "✅ "
                : ""
            }Пробный уровень`,
            "levelMenu_0"
          )
          .row()
          .text(
            `${
              settings.rows[0].level < 1
                ? "🚫 "
                : allLevels.rows.filter(
                    (el) => el.level === 0 && el.status !== "completed"
                  ).length
                ? "🔒 "
                : !allLevels.rows.filter(
                    (el) => el.level === 1 && el.status !== "completed"
                  ).length
                ? "✅ "
                : ""
            }Уровень 1`,
            settings.rows[0].level < 1 ||
              allLevels.rows.filter(
                (el) => el.level === 0 && el.status !== "completed"
              ).length
              ? "nothing"
              : "levelMenu_1"
          )
          .row()
          .text(
            `${
              settings.rows[0].level < 2
                ? "🚫 "
                : allLevels.rows.filter(
                    (el) => el.level === 1 && el.status !== "completed"
                  ).length
                ? "🔒 "
                : !allLevels.rows.filter(
                    (el) => el.level === 2 && el.status !== "completed"
                  ).length
                ? "✅ "
                : ""
            }Уровень 2`,
            settings.rows[0].level < 2 ||
              allLevels.rows.filter(
                (el) => el.level === 1 && el.status !== "completed"
              ).length
              ? "nothing"
              : "levelMenu_2"
          )
          .row()
          .text(
            `${
              settings.rows[0].level < 3
                ? "🚫 "
                : allLevels.rows.filter(
                    (el) => el.level === 2 && el.status !== "completed"
                  ).length
                ? "🔒 "
                : !allLevels.rows.filter(
                    (el) => el.level === 3 && el.status !== "completed"
                  ).length
                ? "✅ "
                : ""
            }Уровень 3`,
            settings.rows[0].level < 3 ||
              allLevels.rows.filter(
                (el) => el.level === 2 && el.status !== "completed"
              ).length
              ? "nothing"
              : "levelMenu_3"
          )
          .row()
          .text(
            `${
              settings.rows[0].level < 4
                ? "🚫 "
                : allLevels.rows.filter(
                    (el) => el.level === 3 && el.status !== "completed"
                  ).length
                ? "🔒 "
                : !allLevels.rows.filter(
                    (el) => el.level === 4 && el.status !== "completed"
                  ).length
                ? "✅ "
                : ""
            }Уровень 4`,
            settings.rows[0].level < 4 ||
              allLevels.rows.filter(
                (el) => el.level === 3 && el.status !== "completed"
              ).length
              ? "nothing"
              : "levelMenu_4"
          )
          .row()
          .text("В меню", "openMenu"),
        parse_mode: "HTML",
      });
      break;
    case "levelMenu":
      const levelTasks = (
        await db.query(
          "SELECT * FROM tasks_status WHERE user_id = $1 AND level = $2",
          [ctx.from.id, id]
        )
      ).rows;
      const tasks = (
        await db.query(
          `SELECT * FROM level_tasks WHERE id in (${levelTasks
            .map((_, index) => `$${index + 1}`)
            .join(", ")})`,
          levelTasks.map((el) => el.task_id)
        )
      ).rows;
      const tasksKeyboard = new InlineKeyboard();

      tasks.forEach((item, index) => {
        const levelItem = levelTasks.find((el) => el.task_id === item.id);
        if (levelItem)
          tasksKeyboard
            .text(
              `${
                tasksKeyboardEmoji[
                  levelItem.status as keyof typeof tasksKeyboardEmoji
                ]
              } ${
                tasksKeyboardName[
                  item.task_type as keyof typeof tasksKeyboardName
                ]
              } ${index + 1}`,
              levelItem.status !== "not completed"
                ? "nothing"
                : `task_${levelItem.id}`
            )
            .row();
      });
      tasksKeyboard.text("< Назад", "levels");
      await ctx.editMessageText(
        id === "0" ? "Пробный уровень" : `Уровень ${id}`,
        {
          reply_markup: tasksKeyboard,
        }
      );
      break;
    case "task":
      const taskLevel = (
        await db.query("SELECT * FROM tasks_status WHERE id = $1", [id])
      ).rows[0];
      const task = (
        await db.query("SELECT * FROM level_tasks WHERE id = $1", [
          taskLevel.task_id,
        ])
      ).rows[0];
      await ctx.editMessageText(
        `${taskTypeText[task.task_type as keyof typeof taskTypeText]}

✏️ Задание: ${task.task}
${
  task.description
    ? `
📑 Описание: ${task.description}`
    : ""
}`
      );
      if (task.photo) {
        await ctx.replyWithPhoto(task.photo);
      }
      // @ts-ignore
      ctx.session.taskId = id;
      switch (task.task_type) {
        case "photo":
          // @ts-ignore
          await ctx.conversation.enter("getPhotoAnswer");
          break;
        case "basic":
          // @ts-ignore
          await ctx.conversation.enter("getTextAnswer");
          break;
        case "friend":
          // @ts-ignore
          await ctx.conversation.enter("getFriendAnswer");
          break;
        default:
          break;
      }

    default:
      break;
  }
});

bot.catch((ctx) => {
  console.log(ctx.error);
  fs.appendFile(
    "botError.txt",
    `\n\n${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}: ${
      ctx.error
    }`,
    () => {}
  );
});

bot.command("menu", async (ctx) => {
  try {
    await setMenu(ctx);
  } catch (e) {
    console.log(e);
    const isAdminRes = await isAdmin(ctx.from?.id || 0);
    await ctx.reply("<b><u>Меню</u></b>", {
      parse_mode: "HTML",
      reply_markup: isAdminRes ? IKAdminMenu : IKAdminMenu,
    });
  }
});

bot.start({
  allowed_updates: API_CONSTANTS.ALL_UPDATE_TYPES,
  onStart: async () => {
    console.log("Бот запущен");
    try {
      await db.query("SELECT * FROM users");
    } catch (e) {
      await db.query(`CREATE TABLE users (
  ID SERIAL PRIMARY KEY,
  nick VARCHAR(100),
  name VARCHAR(100),
  photo VARCHAR(100),
  college_group VARCHAR(15),
  course INT,
  role VARCHAR(15),
  friendship_id INT,
  points INT
)`);
    }
    try {
      await db.query("SELECT * FROM tasks_status");
    } catch (e) {
      await db.query(`CREATE TABLE tasks_status (
  ID SERIAL PRIMARY KEY,
  task_id INT,
  user_id INT,
  status VARCHAR(15),
  friendship_id INT,
  level INT,
  user_answer_photo VARCHAR(100),
  user_answer_text VARCHAR(5000)
)`);
    }
    try {
      await db.query("SELECT * FROM level_tasks");
    } catch (e) {
      await db.query(`
        CREATE TABLE level_tasks (
  ID SERIAL PRIMARY KEY,
  task_type VARCHAR(10),
  task VARCHAR(500),
  task_description VARCHAR(5000),
  answer VARCHAR(500),
  photo VARCHAR(100),
  level INT,
  is_open BOOLEAN
)`);
    }
    try {
      await db.query("SELECT * FROM friendships");
    } catch (e) {
      await db.query(`CREATE TABLE friendships (
  ID SERIAL PRIMARY KEY,
  users_nicks VARCHAR(100)[],
  users_ids INT[],
  waiting_ids INT[]
)`);
    }
    try {
      await db.query("SELECT * FROM tasks");
    } catch (e) {
      await db.query(`CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  tasks_status_id INT,
  checked_by INT
)`);
    }
    try {
      await db.query("SELECT * FROM settings");
    } catch (e) {
      await db.query(`CREATE TABLE settings (
  ID SERIAL PRIMARY KEY,
  level INT
  )`);
    }
    try {
      await db.query("SELECT * FROM team_names");
    } catch (e) {
      await db.query(`CREATE TABLE team_names (
  ID SERIAL PRIMARY KEY,
  name VARCHAR(50),
  is_busy BOOLEAN
  )`);
    }
  },
});
