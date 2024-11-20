import { InlineKeyboard } from "grammy";

export const IKViewLevel = new InlineKeyboard()
  .text("< Назад", "viewLevel_cancel")
  .text("test level", "viewLevel_0")
  .text("level 1", "viewLevel_1")
  .row()
  .text("level 2", "viewLevel_2")
  .text("level 3", "viewLevel_3")
  .text("level 4", "viewLevel_4");

export const IKRemoveLevel = new InlineKeyboard()
  .text("< Назад", "removeLevel_cancel")
  .text("test level", "removeLevel_0")
  .text("level 1", "removeLevel_1")
  .row()
  .text("level 2", "removeLevel_2")
  .text("level 3", "removeLevel_3")
  .text("level 4", "removeLevel_4");

export const IKAddLevel = new InlineKeyboard()
  .text("< Назад", "addTaskLevel_cancel")
  .text("test level", "addTaskLevel_0")
  .text("level 1", "addTaskLevel_1")
  .row()
  .text("level 2", "addTaskLevel_2")
  .text("level 3", "addTaskLevel_3")
  .text("level 4", "addTaskLevel_4");

export const IKAdminMenu = new InlineKeyboard()
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

export const IKUserMenu = new InlineKeyboard()
  .text("🔢 Уровни", "levels")
  .row()
  .text("👀 Рейтинг", "rating")
  .row()
  .text("📋 Правила", "rules")
  .row()
  .text("📞 Контакты", "contacts");

export const IKUserFriendshipMenu = new InlineKeyboard()
  .text("🫂 Моя команда", "myFriendship")
  .row()
  .text("🔢 Уровни", "levels")
  .row()
  .text("👀 Рейтинг", "rating")
  .row()
  .text("📋 Правила", "rules")
  .row()
  .text("📞 Контакты", "contacts");

export const IKRules = new InlineKeyboard()
  .text("🗓 Календарь проведения", "rulesItem_calendar")
  .row()
  .text("📋 Алгоритм участия", "rulesItem_algorithm")
  .row()
  .text("📊 Этапы флешмоба", "rulesItem_steps")
  .row()
  .text("🏆 Итоги", "rulesItem_results")
  .row()
  .text("В меню", "openMenu");

export const IKCancelAddingTask = new InlineKeyboard().text(
  "< Отмена",
  "cancelAddingTask"
);

export const IKUnlockMenu = new InlineKeyboard()
  .text("✅ Открыть", "unlockLevel")
  .text("< Отмена", "openMenu");

export const IKOpenMenu = new InlineKeyboard().text("В меню", "openMenu");
