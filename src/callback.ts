import { Context, InlineKeyboard } from "grammy";
import {
  bot,
  MyContext,
  tasksKeyboardEmoji,
  tasksKeyboardName,
  taskTypeEmoji,
  taskTypeText,
} from "./constants";
import { db } from "./db";
import { checkFriendship, isAdmin, reviewTask } from "./helpers";
import {
  IKUnlockMenu,
  IKOpenMenu,
  IKAdminMenu,
  IKUserMenu,
  IKRemoveLevel,
  IKViewLevel,
  IKAddLevel,
  IKRules,
  IKUserFriendshipMenu,
} from "./keyboards";
import { setMenu } from "./utils";
import plural from "plural-ru";
import {
  SELECT_SETTINGS,
  SELECT_USER,
  SELECT_USER_STUDENT,
} from "./sqlQueries";
import format from "pg-format";

export const callbackData = async (ctx: Context) => {
  await ctx.answerCallbackQuery();
  if (!ctx.callbackQuery) return;
  const data = ctx.callbackQuery.data!;

  const [action, id] = data.split("_");

  switch (action) {
    case "openMenu":
      await setMenu(ctx);
      break;

    case "myFriendship":
      const user = await db.query(SELECT_USER, [ctx.from?.id]);
      const friendship = await db.query(
        "SELECT * FROM friendships WHERE id = $1",
        [user.rows[0].friendship_id]
      );
      const friends = [];
      for (const f of friendship.rows[0].users_ids) {
        const friend = await db.query(SELECT_USER, [f]);
        friends.push(friend.rows[0]);
      }
      await ctx.editMessageText(
        `<b><u>Моя команда</u></b>

${friends
  .map(
    (item, index) =>
      `${index + 1}. ${item.name} - ${item.nick ? `@${item.nick}` : "Без ника"}`
  )
  .join("\n")}`,
        {
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard().text("< Назад", "openMenu"),
        }
      );
      break;
    case "unlockLevelMenu":
      const settings_ = await db.query(SELECT_SETTINGS);
      const curLev = settings_.rows[0].level;
      await ctx.editMessageText(
        `Вы уверены, что хотите открыть уровень ${
          curLev + 1 === 5 ? '"Финал"' : curLev + 1
        }?`,
        { reply_markup: IKUnlockMenu }
      );
      break;

    case "unlockLevel":
      await ctx.editMessageText(`Загрузка...`);
      const settings__ = await db.query(SELECT_SETTINGS);
      const newLev = settings__.rows[0].level + 1;
      await db.query("UPDATE settings SET level = $1 WHERE id = 1", [newLev]);
      const usersRows = await db.query(SELECT_USER_STUDENT);
      for (const item of usersRows.rows) {
        await bot.api.sendMessage(
          item.id,
          `🎉 Открыт <b><u>уровень ${
            newLev === 5 ? '"Финал"' : newLev
          }</u></b>!`,
          {
            parse_mode: "HTML",
          }
        );
      }
      await ctx.editMessageText(
        `🎉 Открыт <b><u>уровень ${newLev === 5 ? '"Финал"' : newLev}</u></b>!`,
        {
          parse_mode: "HTML",
          reply_markup: IKOpenMenu,
        }
      );
      break;

    case "cancelAddingTask":
      // @ts-ignore
      await ctx.conversation.exit("createNewTask");
      break;
    case "reviewTasks":
      return reviewTask(ctx as MyContext);
    case "leaveAdmin":
      await db.query("UPDATE users SET role = $1 WHERE id = $2", [
        "student",
        ctx.from?.id,
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
      await ctx.editMessageText(
        "Выберите задание, которое хотите просмотреть.",
        {
          reply_markup: viewInlineKeyboard,
        }
      );
      break;
    case "viewTask":
      if (id === "cancel") {
        await setMenu(ctx);
        return;
      }

      const viewItemInlineKeyboard = new InlineKeyboard()
        .text("< Назад", "viewTask_cancel")
        .row()
        .text("🗑️ Удалить", `removeTask_${id}`);
      const task_ = await db.query("SELECT * FROM level_tasks WHERE id = $1", [
        id,
      ]);
      if (task_.rows[0].photo)
        await ctx.replyWithPhoto(task_.rows[0].photo, {
          caption: `${
            taskTypeText[task_.rows[0].task_type as keyof typeof taskTypeText]
          }

✏️ Задание: ${task_.rows[0].task}
${
  task_.rows[0].task_description
    ? `
📑 Описание: ${task_.rows[0].task_description}`
    : ""
}
❗️ Ответ: ${task_.rows[0].answer}`,
          reply_markup: viewItemInlineKeyboard,
        });
      else
        await ctx.editMessageText(
          `${taskTypeText[task_.rows[0].task_type as keyof typeof taskTypeText]}

✏️ Задание: ${task_.rows[0].task}
${
  task_.rows[0].task_description
    ? `
📑 Описание: ${task_.rows[0].task_description}`
    : ""
}

❗️ Ответ: ${task_.rows[0].answer}`,
          { reply_markup: viewItemInlineKeyboard }
        );
      break;
    case "addTaskMenu":
      await ctx.editMessageText(
        "Выберите уровень, на который хотите добавить задание.",
        {
          reply_markup: IKAddLevel,
        }
      );
      break;

    case "addTaskLevel":
      if (id === "cancel") {
        await setMenu(ctx);
        return;
      }
      // @ts-ignore
      ctx.session.addingTaskLevel = id;
      const inlineKeyboardAdd = new InlineKeyboard()
        .text("< Назад", "addTask_back")
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
📆 Даты флешмоба: 21 нояб. – 8 дек.`,
        {
          parse_mode: "HTML",
          reply_markup: IKOpenMenu,
        }
      );
      break;
    case "rules":
      await ctx.editMessageText(
        `🤖 Флешмоб <b>«Я узнаю Сириус»</b>

📅 Период проведения: <i>21 ноября – 9 декабря 2024 года</i>

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

✔️ <b>c 21 ноября</b>: регистрация
✔️ <b>c 21 ноября</b>: старт первого этапа и первые задания
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
✔️ Регистрация открыта с 21 ноября до 8 декабря включительно. Присоединиться можно на любом этапе, но нужно выполнить все предыдущие задания.

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

1️⃣ <b>Первый этап (с 21 ноября):</b>
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

📅 Период проведения: <i>21 ноября – 9 декабря 2024 года</i>

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
      const points = (await db.query(SELECT_USER, [ctx.from?.id])).rows[0]
        .points;
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
        [ctx.from?.id]
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
          .text(
            `${
              settings.rows[0].level < 5
                ? "🚫 "
                : allLevels.rows.filter(
                    (el) => el.level === 4 && el.status !== "completed"
                  ).length
                ? "🔒 "
                : !allLevels.rows.filter(
                    (el) => el.level === 4 && el.status !== "completed"
                  ).length
                ? "✅ "
                : ""
            }Финал`,
            settings.rows[0].level < 5 ||
              allLevels.rows.filter(
                (el) => el.level === 4 && el.status !== "completed"
              ).length
              ? "nothing"
              : "levelMenu_5"
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
          [ctx.from?.id, id]
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
  task.task_description
    ? `
📑 Описание: ${task.task_description}`
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
      break;
    case "reviewAccept":
      await db.query(
        "UPDATE tasks SET checked_by = $1 WHERE tasks_status_id = $2",
        [ctx.from?.id, id]
      );
      const status_task = await db.query(
        "SELECT * FROM tasks_status WHERE id = $1",
        [id]
      );
      await db.query("UPDATE tasks_status SET status = $1 WHERE id = $2", [
        "completed",
        id,
      ]);
      try {
        const friendshipTeam = await db.query(
          `SELECT * FROM friendships WHERE $1 in (users_ids)`,
          [id]
        );
        const friendshipTeam_ = await db.query(
          `SELECT * FROM friendships WHERE $1 in users_ids`,
          [id]
        );
        console.log(friendshipTeam, friendshipTeam_);
        for (const fr of friendshipTeam.rows[0].users_ids) {
          await db.query(
            "UPDATE users SET points = points + $1 WHERE id = $2",
            [
              status_task.rows[0].task_type === "photo"
                ? 5
                : status_task.rows[0].task_type === "friend"
                ? 3
                : 1,
              fr,
            ]
          );
          await bot.api.sendMessage(fr, `🤝 Ваш сокомандник выполнил задание!`);
        }
      } catch {}
      await db.query("UPDATE users SET points = points + $1 WHERE id = $2", [
        status_task.rows[0].task_type === "photo"
          ? 5
          : status_task.rows[0].task_type === "friend"
          ? 3
          : 1,
        status_task.rows[0].user_id,
      ]);
      await bot.api.sendMessage(
        status_task.rows[0].user_id,
        "Ваше задание принято, обновите меню! 🎉"
      );
      return reviewTask(ctx as MyContext);
    case "reviewDecline":
      await db.query(
        "UPDATE tasks SET checked_by = $1 WHERE tasks_status_id = $2",
        [ctx.from?.id, id]
      );
      const _status_task = await db.query(
        "SELECT * FROM tasks_status WHERE id = $1",
        [id]
      );
      await db.query("UPDATE tasks_status SET status = $1 WHERE id = $2", [
        "not completed",
        id,
      ]);
      await bot.api.sendMessage(
        _status_task.rows[0].user_id,
        "Ваше задание не принято, не расстраивайтесь, ждем вашу новую попытку!"
      );
      return reviewTask(ctx as MyContext);

    case "reviewRegAccept":
      await db.query("UPDATE users SET role = $1 WHERE id = $2", [
        "student",
        id,
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
        ).rows.map((el) => [el.id, id, "not completed", level, null]);
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
      const tasks_ = await db.query(
        "SELECT * FROM tasks_status WHERE user_id = $1",
        [ctx.from?.id]
      );
      for (const item of tasks_.rows) {
        await db.query("DELETE FROM tasks WHERE tasks_status_id = $1", [
          item.id,
        ]);
      }
      await db.query("DELETE FROM tasks_status WHERE user_id = $1", [
        ctx.from?.id,
      ]);
      await db.query(
        format(
          "INSERT INTO tasks_status (task_id, user_id, status, level, friendship_id) VALUES %L",
          values
        )
      );
      await bot.api.sendMessage(id, "Ваш аккаунт принят! ✅");
      setTimeout(
        async () =>
          await bot.api.sendMessage(
            id,
            `👋 *Привет!*
  
Мы рады видеть тебя в числе участников флешмоба “_Я узнаю Сириус_”. 🌟
  
Уверены, что задания покажутся ★ _простыми_. И тебе не составит труда выполнить их *одним из первых*! 🏆`,
            { parse_mode: "Markdown" }
          ),
        1000
      );
      setTimeout(
        async () =>
          await bot.api.sendMessage(
            id,
            `💡 *Расскажем о правилах*

🔹 _С 21 ноября по 8 декабря_ ты будешь регулярно получать задания. Каждый новый этап открывается постепенно. 

🔄 *Выполнять задания* внутри этапа можно в течение всей недели. Если ты не можешь решить предлагаемую задачу, её можно *пропустить*, но это скажется на количестве заработанных баллов.

📅 *Последний, решающий этап* откроется 8 декабря, и он станет очным. _Не планируй ничего на этот день._

📄 9 декабря будут опубликованы результаты и названы имена *лидеров*! 👑

⚠️ *Об ограничениях*: использовать программы и приложения для фотомонтажа недопустимо, за это участник будет дисквалифицирован.

🙏 Желаем удачи!`,
            { parse_mode: "Markdown" }
          ),
        5000
      );

      setTimeout(
        async () =>
          await bot.api.sendMessage(
            id,
            `🕵️‍♂️ *Какие задачи будут?*

💡 Приводим пример:
❓ Фигуру какой сказочной птицы являет собой комплекс стелы олимпийского огня и стадиона “Фишт”?

👇 Есть варианты?

🔄 Это *лебедь*! 🪶

_Согласись, не так уж и сложно!_`,
            { parse_mode: "Markdown" }
          ),
        12000
      );

      setTimeout(async () => {
        const user = (await db.query(SELECT_USER, [id])).rows[0];
        const isFriendship = await checkFriendship(user.id || 0);
        await bot.api.sendMessage(
          id,
          "📃 <b><u>Меню</u></b>",
          user.role.includes("admin")
            ? { parse_mode: "HTML", reply_markup: IKAdminMenu }
            : {
                parse_mode: "HTML",
                reply_markup: isFriendship ? IKUserFriendshipMenu : IKUserMenu,
              }
        );
      }, 17000);
      console.log(123);
      return reviewTask(ctx as MyContext);

    case "reviewRegDecline":
      await db.query("UPDATE users SET role = $1 WHERE id = $2", [
        "student_not_checked",
        id,
      ]);
      await bot.api.sendMessage(
        id,
        "Ваши данные не были приняты, необходимо пройти регистрацию заново!",
        {
          reply_markup: new InlineKeyboard().text("Начать 🚀", "greeting"),
        }
      );
      return reviewTask(ctx as MyContext);
    case "greeting":
      // @ts-ignore
      await ctx.conversation.enter("greeting");
      break;
    default:
      break;
  }
};
