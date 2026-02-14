import { router } from "../init";
import { accountRouter } from "./account";
import { authRouter } from "./auth";
import { familyRouter } from "./family";
import { membersRouter } from "./members";
import { calendarRouter } from "./calendar";
import { calendarSyncRouter } from "./calendar-sync";
import { tasksRouter } from "./tasks";
import { choresRouter } from "./chores";
import { shoppingRouter } from "./shopping";
import { mealsRouter } from "./meals";
import { notesRouter } from "./notes";
import { rewardsRouter } from "./rewards";
import { notificationsRouter } from "./notifications";
import { activityRouter } from "./activity";
import { searchRouter } from "./search";
import { hubRouter } from "./hub";

export const appRouter = router({
  account: accountRouter,
  auth: authRouter,
  family: familyRouter,
  members: membersRouter,
  calendar: calendarRouter,
  calendarSync: calendarSyncRouter,
  tasks: tasksRouter,
  chores: choresRouter,
  shopping: shoppingRouter,
  meals: mealsRouter,
  notes: notesRouter,
  rewards: rewardsRouter,
  notifications: notificationsRouter,
  activity: activityRouter,
  search: searchRouter,
  hub: hubRouter,
});

export type AppRouter = typeof appRouter;
