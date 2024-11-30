import { Context, InlineKeyboard, InputMediaBuilder } from "grammy";
import { db } from "./db";
import { MyContext } from "./constants";
import { SELECT_USER } from "./sqlQueries";
import format from "pg-format";
import { setMenu } from "./utils";

export const reviewTask = async (ctx: MyContext) => {
  const uncheckedRegs = await db.query(
    "SELECT * FROM users WHERE role = $1 ORDER BY id ASC LIMIT 1;",
    ["student_is_checking"]
  );
  const uncheckedTasks = await db.query(
    "SELECT * FROM tasks WHERE checked_by IS NULL ORDER BY id ASC LIMIT 1;"
  );
  if (!uncheckedTasks.rowCount && !uncheckedRegs.rowCount) {
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
    await ctx.reply("Отчетов на данный момент нет!", {
      reply_markup: new InlineKeyboard().text("В меню", "openMenu"),
    });
    return;
  }
  if (uncheckedRegs.rowCount) {
    const user = uncheckedRegs.rows[0];
    try {
      await ctx.editMessageReplyMarkup();
    } catch {}
    await ctx.replyWithMediaGroup([InputMediaBuilder.photo(user.photo)]);
    const keyboard = await ctx.reply(
      `👤 Новый пользователь:

ТГ-ник: ${user.nick ? `@${user.nick}` : `Без ника`}

ФИО: ${user.name}

Курс: ${user.course}

Группа: ${user.college_group}`,
      {
        reply_markup: new InlineKeyboard()
          .text("✅ Одобрить", `reviewRegAccept_${user.id}`)
          .text("❌ Отклонить", `reviewRegDecline_${user.id}`)
          .row()
          .text("В меню", "openMenu"),
      }
    );
    return;
  }
  const task_status = await db.query(
    "SELECT * FROM tasks_status WHERE id = $1",
    [uncheckedTasks.rows[0].tasks_status_id]
  );
  const user = await db.query(SELECT_USER, [task_status.rows[0].user_id]);
  const user_data = user.rows[0];
  const task_status_data = task_status.rows[0];

  const task = await db.query("SELECT * FROM level_tasks WHERE id = $1", [
    task_status.rows[0].task_id,
  ]);
  const task_data = task.rows[0];
  const friendship = await db.query("SELECT * FROM friendships WHERE id = $1", [
    user_data.friendship_id,
  ]);

  const usersFromFriendship = await db.query(
    `SELECT * FROM users WHERE id in (${(
      friendship.rows[0]?.users_ids ?? [0]
    ).map((_: any, index: number) => `$${index + 1}`)})`,
    [...(friendship.rows[0]?.users_ids ?? [0])]
  );
  const photos = [
    task_data && task_data.photo
      ? [InputMediaBuilder.photo(task_data.photo)]
      : [],
    task_status_data && task_status_data.user_answer_photo
      ? [InputMediaBuilder.photo(task_status_data.user_answer_photo)]
      : [],
    ...(task_data.level >= 3 && !!friendship.rowCount
      ? usersFromFriendship.rows
      : [user_data]
    ).map((el) => InputMediaBuilder.photo(el.photo)),
  ].flat();
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
  await ctx.replyWithMediaGroup(photos);
  const IKReview = new InlineKeyboard()
    .text(
      "✅ Одобрить",
      `reviewAccept_${uncheckedTasks.rows[0].tasks_status_id}`
    )
    .row();

  if (task_status_data && task_status_data.user_answer_photo) {
    IKReview.text(
      "✅ Одобрить частично (+1 б.)",
      `reviewAccept1Dop_${uncheckedTasks.rows[0].tasks_status_id}`
    )
      .row()
      .text(
        "✅ Одобрить полностью (+2 б.)",
        `reviewAccept2Dop_${uncheckedTasks.rows[0].tasks_status_id}`
      )
      .row();
  }
  IKReview.text(
    "❌ Отклонить",
    `reviewDecline_${uncheckedTasks.rows[0].tasks_status_id}`
  )
    .row()
    .text("В меню", "openMenu");
  await ctx.reply(
    `📝 Отчет от @${user_data.nick} (${user_data.name}):

${
  task_data.photo
    ? `• Фото из задания
  `
    : ""
}
${
  task_status_data.user_answer_photo
    ? `• Фото из отчета участника
  `
    : ""
}
${
  task_data.level >= 3 && !!friendship.rowCount
    ? `Участник с командой (${friendship.rows[0].name}):
${usersFromFriendship.rows
  .map((el) => `• ${el.name} (${el.nick ? `@${el.nick}` : `Без ника`})`)
  .join("\n")}`
    : `• Фото участника`
}
––––––––––––––––––––––
👉🏻 Задание: ${task_data.task}${
      task_data.description
        ? `
  
📑 Описание: ${task_data.description}`
        : ""
    }

❗️  Ответ: ${task_data.answer}
${
  task_status_data.user_answer_text
    ? `––––––––––––––––––––––
  
💢 Текстовый ответ участника (или подпись к фото): ${task_status_data.user_answer_text}`
    : ""
}
`,
    {
      reply_markup: IKReview,
    }
  );
};

export async function checkFriendship(id: number) {
  try {
    const user = (await db.query(SELECT_USER, [id])).rows[0];
    if (user && user.friendship_id) return true;
  } catch (e) {
    return false;
  }
  return false;
}

export async function isAdmin(id: number) {
  try {
    const user = (await db.query(SELECT_USER, [id])).rows[0];
    if (!user || user.role.includes("admin")) {
      return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

export async function resetData(ctx: Context) {
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
  const levels3photo = await getLevelTasks(3, "photo", 3);
  const levels3friend = await getLevelTasks(3, "friend", 1);
  const levels4basic = await getLevelTasks(4, "basic", 3);
  const levels5photo = await getLevelTasks(5, "photo", 5);
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
    ...levels5photo,
  ];
  const tasks = await db.query(
    "SELECT * FROM tasks_status WHERE user_id = $1",
    [ctx.from?.id]
  );
  const user = await db.query("SELECT * FROM users WHERE id = $1", [
    ctx.from?.id,
  ]);
  for (const item of tasks.rows) {
    await db.query("DELETE FROM tasks WHERE tasks_status_id = $1", [item.id]);
  }
  await db.query("DELETE FROM tasks_status WHERE user_id = $1", [ctx.from?.id]);
  await db.query("UPDATE users SET points = 0 WHERE id = $1", [ctx.from?.id]);
  await db.query(
    "INSERT INTO points_history (user_id, task_id, date, count, comment) VALUES ($1, $2, $3, $4, $5)",
    [ctx.from?.id, 0, new Date().toISOString(), 0, `null tasks`]
  );
  // await db.query("UPDATE friendships SET points = 0 WHERE id = $1", [
  //   ctx.from?.id,
  // ]);
  await db.query(
    format(
      "INSERT INTO tasks_status (task_id, user_id, status, level, friendship_id) VALUES %L",
      values
    )
  );
  try {
    await ctx.editMessageReplyMarkup();
  } catch {}
  await ctx.reply(`Ваши задания обновлены! 🤝`);
  await setMenu(ctx);
}
