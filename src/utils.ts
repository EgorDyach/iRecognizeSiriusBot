import { Context, InlineKeyboard, Keyboard } from "grammy";
import { db } from "./db";
import {
  IKCancelAddingTask,
  IKAdminMenu,
  IKUserMenu,
  IKUserFriendshipMenu,
} from "./keyboards";
import { MyConversation, MyContext, bot, taskTypeText } from "./constants";
import { isAdmin, checkFriendship } from "./helpers";
import { SELECT_USER } from "./sqlQueries";

export async function createNewTask(
  conversation: MyConversation,
  ctx: MyContext
) {
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
  await ctx.reply("Введите само задание.", {
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
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
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
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
    await ctx.reply("Введите описание задания.");
    const msg = await conversation.waitFor(":text", {
      otherwise: async (ctx) => {
        await ctx.reply("Необходимо ввести описание задания.");
      },
    });
    description = msg.message?.text;
  }
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
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
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
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
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
  await ctx.reply("Введите ответ на задание.", {
    reply_markup: { remove_keyboard: true },
  });
  const answer = await conversation.waitFor(":text", {
    otherwise: async (ctx) =>
      await ctx.reply("Необходимо прислать ответ в текстовом формате."),
  });

  if (photo) {
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
    await ctx.replyWithPhoto(photo[photo.length - 1].file_id, {
      caption: `🔢 Уровень: ${
        // @ts-ignore
        ctx.session.addingTaskLevel === 5
          ? "Финал"
          : // @ts-ignore
            ctx.session.addingTaskLevel
      }
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
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
    await ctx.reply(
      `🔢 Уровень: ${
        // @ts-ignore
        ctx.session.addingTaskLevel === 5
          ? "Финал"
          : // @ts-ignore
            ctx.session.addingTaskLevel
      }
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
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
  await ctx.reply("✅ Задание успешно создано!", {
    reply_markup: IKAdminMenu,
  });
}

export async function greeting(conversation: MyConversation, ctx: MyContext) {
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
  await ctx.reply("Как вас зовут? (ФИО)");
  const nameRes = await conversation.waitFor("msg:text", {
    otherwise: async (ctx) => await ctx.reply("Необходимо ввести ФИО."),
  });
  let name = nameRes.message?.text || "";
  while (name.split(" ").length < 3) {
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
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
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
  await ctx.reply("Приятно познакомиться!");
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
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
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
  await ctx.reply("А из какой группы?");
  const group = await conversation.waitFor("msg:text", {
    otherwise: async (ctx) =>
      await ctx.reply("Необходимо ввести название группы."),
  });
  await db.query("UPDATE users SET college_group = $1 WHERE id = $2", [
    group.message?.text,
    ctx.from?.id,
  ]);
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
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
  await db.query("UPDATE users SET role = $1 WHERE id = $2", [
    "student_is_checking",
    ctx.from?.id,
  ]);
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
  await ctx.reply(
    "Отлично! Мы проверим ваш аккаунт, пришлем вам результат и вы сможете принять участие!"
  );
}
export const getTextAnswer = async (
  conversation: MyConversation,
  ctx: MyContext
) => {
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
  await ctx.reply(
    "Для выполнения задания пришлите текстовое сообщение с ответом."
  );
  const res = await conversation.waitFor("message:text", {
    drop: false,
    otherwise: async (ctx) => {
      if (ctx.callbackQuery) {
        return;
      }
      try {
        await ctx.editMessageReplyMarkup();
      } catch {}
      await ctx.reply(
        "Необходимо прислать текстовое сообщение с нужным ответом."
      );
    },
  });
  if (
    res.message &&
    (res.message.text === "/menu" || res.message.text === "/start")
  ) {
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
    return await setMenu(ctx);
  }
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
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
  await ctx.reply("Ваше задание на проверке.", {
    reply_markup: IKUserMenu,
  });
};
export const getPhotoAnswer = async (
  conversation: MyConversation,
  ctx: MyContext
) => {
  await ctx.reply(
    "Для выполнения задания пришлите фото-селфи с нужным ответом."
  );
  let photoRes = await conversation.waitFor("message", {
    otherwise: async (ctx) => {
      if (ctx.callbackQuery) {
        return;
      }
      try {
        await ctx.editMessageReplyMarkup();
      } catch {}
      await ctx.reply("Необходимо прислать фото-селфи с нужным ответом.");
    },
  });
  let rtext = photoRes.message.text;
  let rphoto = photoRes.message.photo;

  if (rtext === "/menu" || rtext === "/start") {
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
    await setMenu(ctx);
    return;
  }
  while (!rphoto) {
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
    await ctx.reply("Необходимо прислать фото-селфи с нужным ответом.");
    photoRes = await conversation.waitFor("message", {
      otherwise: async (ctx) => {
        if (ctx.callbackQuery) {
          return;
        }
        try {
          await ctx.editMessageReplyMarkup();
        } catch {}
        await ctx.reply("Необходимо прислать фото-селфи с нужным ответом.");
      },
    });
    rphoto = photoRes.message.photo;
    rtext = photoRes.message.text;
  }
  await db.query(
    "UPDATE tasks_status SET user_answer_photo = $1, user_answer_text = $2, status = $3 WHERE id = $4",
    [
      rphoto.at(-1)?.file_id || null,
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
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
  await ctx.reply("Ваше задание на проверке.", {
    reply_markup: IKUserMenu,
  });
};

export const getFriendAnswer = async (
  conversation: MyConversation,
  ctx: MyContext
) => {
  const user_ = await db.query(
    "SELECT * FROM users WHERE id = $1 AND friendship_id IS NOT NULL",
    [ctx.from?.id]
  );
  const myKeyboard = new Keyboard()
    .text("Создать команду")
    .text("Присоединиться")
    .resized();
  if (user_.rowCount) {
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
    const task = await db.query("SELECT * FROM tasks_status WHERE id = $1", [
      // @ts-ignore
      ctx.session.taskId,
    ]);
    if (task.rows[0].level !== 2 && task.rows[0].level !== 3) {
      await ctx.reply(
        "Не удалось найти задание. Обратитесь к администраторам @djekti."
      );
      return;
    }
    await ctx.reply(
      `У вас уже имеется команда. Вы можете перейдите в другую команду или же дождаться, пока в вашей команде наберется ${
        task.rows[0].level === 2 ? 2 : 4
      } человека. Задание зачтется автоматически.`,
      {
        reply_markup: new InlineKeyboard()
          .text("🔄 Перейти в другую команду", "changeCommand")
          .row()
          .text("🗿 Ожидать участников", "openMenu"),
      }
    );
    return;
  } else {
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
    await ctx.reply(
      "Для выполнения задания необходимо создать свою команду или присоединиться к кому-то.",
      { reply_markup: myKeyboard }
    );
  }
  const res = await conversation.waitFor(":text", {
    otherwise: async (ctx) =>
      await ctx.reply(
        "Необходимо выбрать 'Создать команду' или 'Присоединиться'."
      ),
  });
  let text = res.message?.text;
  while (text !== "Создать команду" && text !== "Присоединиться") {
    await ctx.reply(
      "Необходимо выбрать 'Создать команду' или 'Присоединиться'."
    );
    const res = await conversation.waitFor(":text", {
      otherwise: async (ctx) => {
        if (ctx.callbackQuery) {
          return;
        }
        await ctx.reply(
          "Необходимо выбрать 'Создать команду' или 'Присоединиться'."
        );
      },
    });
    text = res.message?.text;
  }
  if (text === "Присоединиться") {
    const myKeyboard = new Keyboard().text("В меню").resized();
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
    await ctx.reply(
      "Введите ID команды в формате, получить его можно у одного из сокомандников.",
      {
        reply_markup: myKeyboard,
      }
    );
    const res = await conversation.waitFor(":text", {
      otherwise: async (ctx) =>
        await ctx.reply(
          "Введите ID команды в формате, получить его можно у одного из сокомандников.",
          {
            reply_markup: myKeyboard,
          }
        ),
    });
    let id = res.message?.text;
    if (id === "В меню" || id === "/menu" || id === "/start") {
      await setMenu(ctx);
      return;
    }
    let friendShipRes;
    if (!isNaN(Number(id)))
      friendShipRes = await db.query(
        "SELECT * FROM friendships WHERE id = $1;",
        [id]
      );

    while (friendShipRes && !friendShipRes.rowCount) {
      await ctx.reply(
        "Не удалось найти такую команду. Убедитесь в правильности ID и введите заново ID.",
        {
          reply_markup: myKeyboard,
        }
      );
      const res = await conversation.waitFor(":text", {
        otherwise: async (ctx) =>
          await ctx.reply(
            "Введите ID команды, получить его можно у одного из сокомандников.",
            {
              reply_markup: myKeyboard,
            }
          ),
      });
      id = res.message?.text;
      if (!isNaN(Number(id)))
        friendShipRes = await db.query(
          "SELECT * FROM friendships WHERE id = $1;",
          [id]
        );
    }
    if (!friendShipRes) {
      await ctx.reply("Не удалось найти команду.", {
        reply_markup: { remove_keyboard: true },
      });
      await setMenu(ctx);
      return;
    }
    if (friendShipRes.rowCount) {
      const task_status = await db.query(
        "SELECT * FROM tasks_status WHERE id = $1",
        [
          // @ts-ignore
          ctx.session.taskId,
        ]
      );
      if (
        (task_status.rows[0].level < 3 &&
          friendShipRes.rows[0].users_ids.length >= 2) ||
        (task_status.rows[0].level >= 3 &&
          friendShipRes.rows[0].users_ids.length >= 4)
      ) {
        try {
          await ctx.editMessageReplyMarkup();
        } catch {}
        return await ctx.reply("Команда заполнена.", {
          reply_markup: {
            remove_keyboard: true,
          },
        });
      }
      const user = await db.query(SELECT_USER, [ctx.from?.id]);
      await db.query(
        "UPDATE friendships SET users_nicks = $1, users_ids = $2 WHERE id = $3",
        [
          [
            ...friendShipRes.rows[0].users_nicks,
            user.rows[0].nick ? user.rows[0].nick : "noneNick",
          ],
          [...friendShipRes.rows[0].users_ids, user.rows[0].id],
          friendShipRes.rows[0].id,
        ]
      );
      await db.query(
        "UPDATE friendships SET users_nicks = $1, users_ids = $2 WHERE id = $3",
        [
          friendShipRes.rows[0].users_nicks.filter(
            (el: string) => el !== user.rows[0].nick
          ),

          friendShipRes.rows[0].users_ids.filter(
            (el: number) => el !== user.rows[0].id
          ),
          user.rows[0].friendship_id,
        ]
      );
      const t = await db.query(
        `UPDATE users 
SET friendship_id = $1 
WHERE id = $2 
RETURNING *;`,
        [friendShipRes.rows[0].id, user.rows[0].id]
      );
      try {
        await ctx.editMessageReplyMarkup();
      } catch {}
      await ctx.reply(`Добавили вас в команду ${friendShipRes.rows[0].name}.`);
      await setMenu(ctx);
      for (const user of friendShipRes.rows[0].users_ids) {
        await bot.api.sendMessage(
          user,
          `👤 В вашу команду вступил игрок @${
            ctx.from?.username ? ctx.from?.username : ""
          }.`
        );
      }
      if ([...friendShipRes.rows[0].users_ids, ctx.from?.id].length === 2) {
        const r = await db.query(
          "SELECT * FROM level_tasks WHERE level = 2 AND task_type=$1",
          ["friend"]
        );
        for (const user of [...friendShipRes.rows[0].users_ids, ctx.from?.id]) {
          await db.query(
            "UPDATE tasks_status SET status = $1 WHERE user_id = $2 AND task_id = $3",
            ["completed", user, r.rows[0].id]
          );
          await db.query("UPDATE users SET points = points + 3 WHERE id = $1", [
            user,
          ]);
          await db.query(
            "INSERT INTO points_history (user_id, task_id, date, count, comment) VALUES ($1, $2, $3, $4, $5)",
            [user, r.rows[0].id, new Date().toISOString(), 3, `made 2 team`]
          );
          try {
            await ctx.editMessageReplyMarkup();
          } catch {}
          await bot.api.sendMessage(
            user,
            " 🎉 Вы выполнили задание на создание команды из 2 человек!"
          );
        }
        return;
      }
      if ([...friendShipRes.rows[0].users_ids, ctx.from?.id].length === 4) {
        const r = await db.query(
          "SELECT * FROM level_tasks WHERE level = 3 AND task_type=$1",
          ["friend"]
        );
        for (const user of [...friendShipRes.rows[0].users_ids, ctx.from?.id]) {
          await db.query(
            "UPDATE tasks_status SET status = $1 WHERE user_id = $2 AND task_id = $3",
            ["completed", user, r.rows[0].id]
          );
          await db.query("UPDATE users SET points = points + 3 WHERE id = $1", [
            user,
          ]);
          await db.query(
            "INSERT INTO points_history (user_id, task_id, date, count, comment) VALUES ($1, $2, $3, $4, $5)",
            [user, r.rows[0].id, new Date().toISOString(), 3, `made 4 team`]
          );
          try {
            await ctx.editMessageReplyMarkup();
          } catch {}
          await bot.api.sendMessage(
            user,
            " 🎉 Вы выполнили задание на создание команды из 4 человек!"
          );
        }
      }
      return;
    }
  }
  // Select a random team name that is not busy
  const selectedNameResult = await db.query(
    `SELECT ID, name
     FROM team_names
     WHERE is_busy = FALSE
     ORDER BY RANDOM()
     LIMIT 1`
  );

  const selectedName = selectedNameResult.rows[0];

  const user = await db.query(
    `SELECT nick, ID
     FROM users
     WHERE ID = $1`,
    [ctx.from?.id]
  );

  const newFriendshipIdResult = await db.query(
    `SELECT COALESCE(MAX(ID), 100000) + 1 AS new_id
     FROM friendships`
  );

  const newFriendshipId = newFriendshipIdResult.rows[0].new_id;

  // Insert the new friendship
  const insertResult = await db.query(
    `INSERT INTO friendships (ID, users_nicks, users_ids, name)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [newFriendshipId, [user.rows[0].nick], [user.rows[0].id], selectedName.name]
  );

  // Update the team name to set it as busy
  await db.query(
    `UPDATE team_names
     SET is_busy = TRUE
     WHERE ID = $1`,
    [selectedName.id]
  );

  await db.query(`UPDATE users SET friendship_id  = $1 WHERE id = $2`, [
    newFriendshipId,
    user.rows[0].id,
  ]);

  const r = await db.query("SELECT * FROM level_tasks WHERE task_type=$1", [
    "friend",
  ]);

  console.log(
    `SELECT * FROM tasks_status WHERE user_id = $1 AND task_id in (${r.rows.map(
      (_, index) => index + 2
    )})`,
    [ctx.from?.id, ...r.rows.map((el) => el.id)]
  );
  const user_tasks = await db.query(
    `SELECT * FROM tasks_status WHERE user_id = $1 AND task_id in (${r.rows.map(
      (_, index) => `$${index + 2}`
    )})`,
    [ctx.from?.id, ...r.rows.map((el) => el.id)]
  );
  console.log(r.rows);
  await db.query(
    "UPDATE tasks_status SET status = $1 WHERE task_id = $2 AND user_id = $3",
    [
      "waiting_fr",
      user_tasks.rows[0].status === "not completed"
        ? user_tasks.rows[0].id
        : user_tasks.rows[1].id,
      user.rows[0].id,
    ]
  );

  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
  await ctx.reply(
    `Команда создана! Название вашей команды: <b>${insertResult.rows[0].name}</b>. 

Для выполнения уровня необходимо добавить сокомандника.

Для добавление ваш сокомандник должен ввести ID: ${insertResult.rows[0].id}.`,
    {
      parse_mode: "HTML",
      reply_markup: {
        remove_keyboard: true,
      },
    }
  );
  await setMenu(ctx);
};

export const setMenu = async (ctx: Context) => {
  const user = (await db.query(SELECT_USER, [ctx.from?.id])).rows[0];
  if (user.role === "student_not_checked") {
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
    await ctx.reply("Необходимо пройти регистрацию!");
    return;
  }
  if (user.role === "student_is_checking") {
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
    await ctx.reply("Необходимо дождаться проверки!");
    return;
  }
  const isFriendship = await checkFriendship(ctx.from?.id || 0);
  try {
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
    await ctx.reply(
      "📃 <b><u>Меню</u></b>",
      user.role.includes("admin")
        ? { parse_mode: "HTML", reply_markup: IKAdminMenu }
        : {
            parse_mode: "HTML",
            reply_markup: isFriendship ? IKUserFriendshipMenu : IKUserMenu,
          }
    );
  } catch (e) {
    console.log(e);
    await ctx.reply(
      "📃 <b><u>Меню</u></b>",
      user.role.includes("admin")
        ? { parse_mode: "HTML", reply_markup: IKAdminMenu }
        : {
            parse_mode: "HTML",
            reply_markup: isFriendship ? IKUserFriendshipMenu : IKUserMenu,
          }
    );
  }
};

export const changeCommand = async (
  conversation: MyConversation,
  ctx: MyContext
) => {
  const t = await db.query(
    "SELECT * FROM level_tasks WHERE task_type = $1 AND level = 3",
    ["friend"]
  );
  const td = await db.query(
    "SELECT * FROM tasks_status WHERE task_id = $1 AND user_id = $2",
    [t.rows[0].id, ctx.from?.id]
  );
  const user = await db.query("SELECT * FROM users WHERE id = $1", [
    ctx.from?.id,
  ]);
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
  await ctx.reply(
    "Введите ID, его можно получить у любого члена новой команды.",
    {
      reply_markup: new InlineKeyboard()
        .text("⚫️ Пропуск задания", `skipTaskConfirm_${td.rows[0].id}`)
        .row()
        .text("< Назад", "changeCommand_back"),
    }
  );
  const msg = await conversation.waitFor("msg:text", {
    otherwise: async (ctx) => {
      if (ctx.callbackQuery) {
        return;
      }
      await ctx.reply("Необходимо прислать ID новой команды.");
    },
  });
  let id = msg.message?.text;
  if (msg.message?.text === "/start" || msg.message?.text === "/menu") {
    await setMenu(ctx);
    return;
  }
  let friendShipRes;
  if (!isNaN(Number(id)))
    friendShipRes = await db.query("SELECT * FROM friendships WHERE id = $1;", [
      msg.message?.text,
    ]);
  const myKeyboard = new Keyboard().text("< Назад").text("Меню").resized();
  while (
    (!friendShipRes ||
      !friendShipRes.rowCount ||
      friendShipRes.rows[0].id === user.rows[0].friendship_id) &&
    id !== "/start" &&
    id !== "/menu" &&
    id !== "< Назад" &&
    id !== "Меню"
  ) {
    if (
      friendShipRes &&
      friendShipRes.rowCount &&
      friendShipRes.rows[0].id === user.rows[0].friendship_id &&
      !isNaN(Number(id))
    ) {
      await ctx.reply("Необходимо ввести id отличный от id вашей команды.");
    } else
      await ctx.reply(
        "Не удалось найти такую команду. Убедитесь в правильности ID и введите заново ID.",
        {
          reply_markup: myKeyboard,
        }
      );
    const res = await conversation.waitFor(":text", {
      otherwise: async (ctx) => {
        if (ctx.callbackQuery) return;
        await ctx.reply(
          "Введите ID команды, получить его можно у одного из сокомандников.",
          {
            reply_markup: myKeyboard,
          }
        );
      },
    });
    id = res.message?.text;
    if (!isNaN(Number(id)))
      friendShipRes = await db.query(
        "SELECT * FROM friendships WHERE id = $1;",
        [id]
      );
    console.log(friendShipRes?.rows);
  }
  if (id === "/menu" || id === "/start" || id === "Меню" || !friendShipRes) {
    setMenu(ctx);
    return;
  }
  if (id === "< Назад") {
    await ctx.conversation.exit();
    return await ctx.conversation.enter("changeCommand");
  }
  if (
    friendShipRes.rows[0].users_ids.length >= (td.rows[0].level === 2 ? 2 : 4)
  ) {
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
    await ctx.reply("Команда заполнена.");
    return await setMenu(ctx);
  }

  const userFriendship = await db.query(
    "SELECT * FROM friendships WHERE id = $1",
    [user.rows[0].friendship_id]
  );
  console.log(
    userFriendship.rows,
    ctx.from?.id,
    userFriendship.rows[0].users_ids.filter(
      (el: string | undefined) => el !== ctx.from?.id
    )
  );

  await db.query(
    "UPDATE friendships SET users_nicks = $1, users_ids = $2 WHERE id = $3",
    [
      userFriendship.rows[0].users_nicks.filter(
        (el: string) =>
          (el || "").toLowerCase() !== (ctx.from?.username || "").toLowerCase()
      ),
      userFriendship.rows[0].users_ids.filter(
        (el: string | undefined) => el !== ctx.from?.id + ""
      ),
      user.rows[0].friendship_id,
    ]
  );

  await db.query(
    "UPDATE friendships SET users_nicks = $1, users_ids = $2 WHERE id = $3",
    [
      [...friendShipRes.rows[0].users_nicks, ctx.from?.username],
      [...friendShipRes.rows[0].users_ids, ctx.from?.id],
      friendShipRes.rows[0].id,
    ]
  );

  await db.query("UPDATE users SET friendship_id = $1 WHERE id = $2", [
    friendShipRes.rows[0].id,
    ctx.from?.id,
  ]);
  await ctx.reply(`Ваша новая команда: ${friendShipRes.rows[0].name}.
    
ID: ${friendShipRes.rows[0].id}.`);
  if ([...friendShipRes.rows[0].users_ids, ctx.from?.id].length === 4) {
    const r = await db.query(
      "SELECT * FROM level_tasks WHERE level = 3 AND task_type=$1",
      ["friend"]
    );
    for (const user of [...friendShipRes.rows[0].users_ids, ctx.from?.id]) {
      await db.query(
        "UPDATE tasks_status SET status = $1 WHERE user_id = $2 AND task_id = $3",
        ["completed", user, r.rows[0].id]
      );
      await db.query("UPDATE users SET points = points + 3 WHERE id = $1", [
        user,
      ]);
      await db.query(
        "INSERT INTO points_history (user_id, task_id, date, count, comment) VALUES ($1, $2, $3, $4, $5)",
        [user, r.rows[0].id, new Date().toISOString(), 3, `change to 4 team`]
      );
      try {
        await ctx.editMessageReplyMarkup();
      } catch {}
      await bot.api.sendMessage(
        user,
        " 🎉 Вы выполнили задание на создание команды из 4 человек!"
      );
    }
  }
  await setMenu(ctx);
};

export const msgForStudent = async (
  conversation: MyConversation,
  ctx: MyContext
) => {
  await ctx.reply("Пришлите сообщение.");
  const res = await conversation.waitFor("msg:text", {
    otherwise: async (ctx) => await ctx.reply("Пришлите сообщение."),
  });
  if (
    res.message?.text === "/menu" ||
    res.message?.text === "/start" ||
    !res.message?.text
  ) {
    await setMenu(ctx);
    return;
  }
  if (res.message?.text.length <= 10) {
    ctx.reply("Минимальная длина сообщения от 10 символов.");
    await setMenu(ctx);
  }
  const students = await db.query("SELECT * FROM users WHERE role = $1", [
    "student",
  ]);
  for (const user of students.rows) {
    if (res.message?.text) await bot.api.sendMessage(user.id, res.message.text);
  }
  await ctx.reply("Сообщение отправлено.");
  await setMenu(ctx);
};

export const msgForNotStudent = async (
  conversation: MyConversation,
  ctx: MyContext
) => {
  await ctx.reply("Пришлите сообщение.");
  const res = await conversation.waitFor("msg:text", {
    otherwise: async (ctx) => await ctx.reply("Пришлите сообщение."),
  });
  if (
    res.message?.text === "/menu" ||
    res.message?.text === "/start" ||
    !res.message?.text
  ) {
    await setMenu(ctx);
    return;
  }
  if (res.message?.text.length <= 10) {
    ctx.reply("Минимальная длина сообщения от 10 символов.");
    await setMenu(ctx);
  }
  const students = await db.query("SELECT * FROM users WHERE role = $1", [
    "student_not_checked",
  ]);
  for (const user of students.rows) {
    if (res.message?.text) await bot.api.sendMessage(user.id, res.message.text);
  }
  await ctx.reply("Сообщение отправлено.");
  await setMenu(ctx);
};
export const msgForOneStudent = async (
  conversation: MyConversation,
  ctx: MyContext
) => {
  await ctx.reply("Пришлите ник игрока в формате @example или ФИО.");
  const res = await conversation.waitFor("msg:text", {
    otherwise: async (ctx) =>
      await ctx.reply("Пришлите ник игрока в формате @example или ФИО."),
  });
  if (res.message?.text === "/menu" || res.message?.text === "/start") {
    await setMenu(ctx);
    await ctx.conversation.exit();
  }
  const students = await db.query(
    "SELECT * FROM users WHERE nick = $1 OR name = $2",
    [res.message?.text.slice(1), res.message?.text]
  );
  if (!students.rowCount) {
    await ctx.reply("Не удалось найти игрока с данным ником или ФИО.");
    await setMenu(ctx);
    return;
  }
  await ctx.reply(`Пришлите сообщение для игрока (${students.rows[0].name}).`);
  const resText = await conversation.waitFor("msg:text", {
    otherwise: async (ctx) =>
      await ctx.reply(
        `Пришлите сообщение для игрока (${students.rows[0].name}).`
      ),
  });
  if (
    res.message?.text === "/menu" ||
    res.message?.text === "/start" ||
    !res.message?.text
  ) {
    await setMenu(ctx);
    return;
  }
  if (res.message?.text.length <= 10) {
    ctx.reply("Минимальная длина сообщения от 10 символов.");
    await setMenu(ctx);
  }
  await bot.api.sendMessage(
    students.rows[0].id,
    `${resText.message?.text}

<i>С уважением, администраторы флешмоба «Я узнаю Сириус».</i>`,
    {
      parse_mode: "HTML",
    }
  );
  await ctx.reply("Сообщение отправлено.");
  await setMenu(ctx);
};
