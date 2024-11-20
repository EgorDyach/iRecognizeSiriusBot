// IMPORTS
import format from "pg-format";
import { db } from "./db";
import { session, API_CONSTANTS, Context, Middleware } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import fs from "fs";

import * as dotenv from "dotenv";
import { IKAdminMenu } from "./keyboards";
import { bot } from "./constants";
import { isAdmin, resetData } from "./helpers";
import {
  greeting,
  createNewTask,
  getPhotoAnswer,
  getTextAnswer,
  getFriendAnswer,
  setMenu,
} from "./utils";
import { callbackData } from "./callback";
import { SELECT_USER } from "./sqlQueries";
dotenv.config();

bot.use(
  session({
    initial() {
      return {
        addingTaskLevel: 0,
        addingTaskType: "basic",
        taskId: 0,
      };
    },
  }) as Middleware<Context>
);

bot.use(conversations() as Middleware<Context>);
bot.use(createConversation(greeting) as Middleware<Context>);
bot.use(createConversation(createNewTask) as Middleware<Context>);
bot.use(createConversation(getPhotoAnswer) as Middleware<Context>);
bot.use(createConversation(getTextAnswer) as Middleware<Context>);
bot.use(createConversation(getFriendAnswer) as Middleware<Context>);

bot.command("start", async (ctx) => {
  const user = (await db.query(SELECT_USER, [ctx.from?.id])).rows[0];
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
        "student_not_checked",
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

bot.on("callback_query:data", callbackData);

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

bot.command("reset_tasks", async (ctx) => {
  await resetData(ctx);
  await setMenu(ctx);
});

bot.command("menu", async (ctx) => {
  await setMenu(ctx);
});

bot.start({
  allowed_updates: API_CONSTANTS.ALL_UPDATE_TYPES,
  onStart: async () => {
    console.log("Бот запущен");
    try {
      const res = await db.query("SELECT * FROM users");
    } catch (e) {
      await db.query(`CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  nick VARCHAR(100),
  name VARCHAR(2000),
  photo VARCHAR(100),
  college_group VARCHAR(2000),
  course INT,
  role VARCHAR(25),
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
  user_id BIGINT,
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
  users_ids BIGINT[],
  name VARCHAR(100)
)`);
    }
    try {
      await db.query("SELECT * FROM tasks");
    } catch (e) {
      await db.query(`CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  tasks_status_id INT,
  checked_by BIGINT
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
