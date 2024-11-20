import { Context, InlineKeyboard, InputMediaBuilder } from "grammy";
import { db } from "./db";
import { MyContext } from "./constants";
import { SELECT_USER } from "./sqlQueries";
import format from "pg-format";
import { setMenu } from "./utils";

export const reviewTask = async (ctx: MyContext) => {
  const uncheckedRegs = await db.query(
    "SELECT * FROM users WHERE role = $1 ORDER BY id ASC LIMIT 1;",
    ["student_not_checked"]
  );
  const uncheckedTasks = await db.query(
    "SELECT * FROM tasks WHERE checked_by IS NULL ORDER BY id ASC LIMIT 1;"
  );
  if (!uncheckedTasks.rowCount && !uncheckedRegs.rowCount) {
    await ctx.editMessageText("Отчетов на данный момент нет!", {
      reply_markup: new InlineKeyboard().text("В меню", "openMenu"),
    });
    return;
  }
  if (uncheckedRegs.rowCount) {
    const user = uncheckedRegs.rows[0];
    await ctx.replyWithPhoto(user.photo, {
      reply_markup: new InlineKeyboard()
        .text("✅ Одобрить", `reviewRegAccept_${user.id}`)
        .text("❌ Отклонить", `reviewRegDecline_${user.id}`)
        .row()
        .text("В меню", "openMenu"),
      caption: `👤 Новый пользователь:

ТГ-ник: ${user.nick ? `@${user.nick}` : `Без ника`}

ФИО: ${user.name}

Курс: ${user.course}

Группа: ${user.college_group}`,
    });
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
  const photos = [
    user_data && user_data.photo
      ? [InputMediaBuilder.photo(user_data.photo)]
      : [],
    task_data && task_data.photo
      ? [InputMediaBuilder.photo(task_data.photo)]
      : [],
    task_status_data && task_status_data.user_answer_photo
      ? [InputMediaBuilder.photo(task_status_data.user_answer_photo)]
      : [],
  ].flat();

  await ctx.replyWithMediaGroup(photos);
  const IKReview = new InlineKeyboard()
    .text(
      "✅ Одобрить",
      `reviewAccept_${uncheckedTasks.rows[0].tasks_status_id}`
    )
    .text(
      "❌ Отклонить",
      `reviewDecline_${uncheckedTasks.rows[0].tasks_status_id}`
    )
    .row()
    .text("В меню", "openMenu");
  await ctx.reply(
    `📝 Отчет от @${user_data.nick} (${user_data.name}):

1. Фото участника
${
  task_data.photo
    ? `2. Фото из задания
  `
    : ""
}
${
  task_status_data.user_answer_photo
    ? `3. Фото из отчета участника
  `
    : ""
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
  const tasks = await db.query(
    "SELECT * FROM tasks_status WHERE user_id = $1",
    [ctx.from?.id]
  );
  for (const item of tasks.rows) {
    await db.query("DELETE FROM tasks WHERE tasks_status_id = $1", [item.id]);
  }
  await db.query("DELETE FROM tasks_status WHERE user_id = $1", [ctx.from?.id]);
  await db.query(
    format(
      "INSERT INTO tasks_status (task_id, user_id, status, level, friendship_id) VALUES %L",
      values
    )
  );
  await ctx.reply(`Ваши задания обновлены! 🤝`);
  await setMenu(ctx);
}
