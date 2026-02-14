import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clear existing data
  await prisma.activityEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.rewardRedemption.deleteMany();
  await prisma.reward.deleteMany();
  await prisma.memberAchievement.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.xpEvent.deleteMany();
  await prisma.memberXpProfile.deleteMany();
  await prisma.familyGoal.deleteMany();
  await prisma.xpSettings.deleteMany();
  await prisma.noteAttachment.deleteMany();
  await prisma.note.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.mealPlan.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.shoppingItem.deleteMany();
  await prisma.shoppingList.deleteMany();
  await prisma.choreSwapRequest.deleteMany();
  await prisma.choreInstance.deleteMany();
  await prisma.choreAssignee.deleteMany();
  await prisma.chore.deleteMany();
  await prisma.taskCompletion.deleteMany();
  await prisma.taskAssignee.deleteMany();
  await prisma.task.deleteMany();
  await prisma.eventAssignee.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.externalCalendar.deleteMany();
  await prisma.externalCalendarConnection.deleteMany();
  await prisma.hubDisplaySettings.deleteMany();
  await prisma.familyMember.deleteMany();
  await prisma.family.deleteMany();

  // Create demo family
  const accountPasswordHash = await bcrypt.hash("password123", 10);
  const family = await prisma.family.create({
    data: {
      name: "The Millers",
      email: "demo@familyhub.local",
      passwordHash: accountPasswordHash,
      defaultLocale: "en",
      theme: "AUTO",
    },
  });

  const pinHash = await bcrypt.hash("1234", 10);

  // Create family members
  const mom = await prisma.familyMember.create({
    data: {
      familyId: family.id,
      name: "Sarah",
      color: "#ec4899",
      pinHash,
      role: "ADMIN",
      locale: "en",
    },
  });

  const dad = await prisma.familyMember.create({
    data: {
      familyId: family.id,
      name: "Michael",
      color: "#3b82f6",
      pinHash,
      role: "ADMIN",
      locale: "en",
    },
  });

  const anna = await prisma.familyMember.create({
    data: {
      familyId: family.id,
      name: "Anna",
      color: "#8b5cf6",
      pinHash,
      role: "MEMBER",
      locale: "en",
    },
  });

  const ben = await prisma.familyMember.create({
    data: {
      familyId: family.id,
      name: "Ben",
      color: "#22c55e",
      pinHash,
      role: "MEMBER",
      locale: "en",
    },
  });

  const clara = await prisma.familyMember.create({
    data: {
      familyId: family.id,
      name: "Clara",
      color: "#f59e0b",
      pinHash,
      role: "MEMBER",
      locale: "en",
    },
  });

  const max = await prisma.familyMember.create({
    data: {
      familyId: family.id,
      name: "Max",
      color: "#06b6d4",
      pinHash,
      role: "MEMBER",
      locale: "en",
    },
  });

  // Create XP profiles
  const allMembers = [mom, dad, anna, ben, clara, max];
  for (const member of allMembers) {
    await prisma.memberXpProfile.create({
      data: { memberId: member.id },
    });
  }

  // ─── Shopping Lists ──────────────────────────────────────────────
  const groceriesList = await prisma.shoppingList.create({
    data: {
      familyId: family.id,
      name: "Groceries",
    },
  });

  await prisma.shoppingItem.createMany({
    data: [
      { listId: groceriesList.id, name: "Milk", quantity: "1", unit: "L", category: "Dairy", addedById: mom.id },
      { listId: groceriesList.id, name: "Bananas", quantity: "6", unit: "pcs", category: "Produce", addedById: mom.id },
      { listId: groceriesList.id, name: "Chicken Breast", quantity: "500", unit: "g", category: "Meat & Fish", addedById: dad.id },
      { listId: groceriesList.id, name: "Bread", quantity: "1", unit: "pack", category: "Bakery", addedById: mom.id, checked: true, checkedById: dad.id },
      { listId: groceriesList.id, name: "Eggs", quantity: "1", unit: "dozen", category: "Dairy", addedById: dad.id },
      { listId: groceriesList.id, name: "Pasta", quantity: "2", unit: "pack", category: "Canned & Jarred", addedById: mom.id },
      { listId: groceriesList.id, name: "Olive Oil", quantity: "1", unit: "bottle", category: "Canned & Jarred", addedById: dad.id, checked: true, checkedById: mom.id },
      { listId: groceriesList.id, name: "Apples", quantity: "1", unit: "kg", category: "Produce", addedById: anna.id },
    ],
  });

  const hardwareList = await prisma.shoppingList.create({
    data: {
      familyId: family.id,
      name: "Hardware Store",
    },
  });

  await prisma.shoppingItem.createMany({
    data: [
      { listId: hardwareList.id, name: "Light Bulbs", quantity: "4", unit: "pcs", category: "Household", addedById: dad.id },
      { listId: hardwareList.id, name: "Batteries", quantity: "1", unit: "pack", category: "Household", addedById: dad.id },
      { listId: hardwareList.id, name: "Duct Tape", quantity: "1", unit: "pcs", category: "Household", addedById: dad.id },
    ],
  });

  // Create XP settings
  await prisma.xpSettings.create({
    data: {
      familyId: family.id,
    },
  });

  // Create hub display settings with access token
  await prisma.hubDisplaySettings.create({
    data: {
      familyId: family.id,
      accessToken: "hub-demo-token-2024",
      visiblePanels: JSON.stringify([
        "clock",
        "schedule",
        "chores",
        "tasks",
        "meals",
        "shopping",
        "notes",
        "leaderboard",
        "achievements",
        "activity",
        "upcoming",
      ]),
      weatherEnabled: true,
      weatherLocationLat: 48.8566,
      weatherLocationLon: 2.3522,
    },
  });
  console.log("  Hub: display settings with token seeded");

  // ─── Calendar Events ──────────────────────────────────────────────
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Helper: create an event + assignees in one transaction
  async function createEvent(data: {
    title: string;
    startAt: Date;
    endAt: Date;
    category: "SCHOOL" | "WORK" | "MEDICAL" | "SPORTS" | "SOCIAL" | "FAMILY" | "OTHER";
    recurrenceRule?: string;
    allDay?: boolean;
    location?: string;
    description?: string;
    createdById: string;
    assigneeIds: string[];
  }) {
    const event = await prisma.calendarEvent.create({
      data: {
        familyId: family.id,
        title: data.title,
        startAt: data.startAt,
        endAt: data.endAt,
        category: data.category,
        recurrenceRule: data.recurrenceRule,
        allDay: data.allDay ?? false,
        location: data.location,
        description: data.description,
        createdById: data.createdById,
        source: "LOCAL",
      },
    });
    for (const memberId of data.assigneeIds) {
      await prisma.eventAssignee.create({
        data: { eventId: event.id, memberId },
      });
    }
    return event;
  }

  // Sarah's Team Meeting — recurring weekdays 9:00-10:00
  await createEvent({
    title: "Team Meeting",
    startAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0),
    endAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0),
    category: "WORK",
    recurrenceRule: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    location: "Office - Room 3B",
    createdById: mom.id,
    assigneeIds: [mom.id],
  });

  // Anna's School — recurring weekdays 8:00-14:00
  await createEvent({
    title: "School",
    startAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0),
    endAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0),
    category: "SCHOOL",
    recurrenceRule: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    location: "Lincoln Elementary",
    createdById: mom.id,
    assigneeIds: [anna.id],
  });

  // Ben's Soccer Practice — recurring Tue/Thu 16:00-17:30
  await createEvent({
    title: "Soccer Practice",
    startAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0),
    endAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 30),
    category: "SPORTS",
    recurrenceRule: "RRULE:FREQ=WEEKLY;BYDAY=TU,TH",
    location: "City Sports Complex",
    createdById: dad.id,
    assigneeIds: [ben.id],
  });

  // Family Pizza Night — recurring Friday 18:00-20:00
  await createEvent({
    title: "Pizza Night",
    startAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0),
    endAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0),
    category: "FAMILY",
    recurrenceRule: "RRULE:FREQ=WEEKLY;BYDAY=FR",
    description: "Family pizza & movie night!",
    createdById: mom.id,
    assigneeIds: [mom.id, dad.id, anna.id, ben.id, clara.id, max.id],
  });

  // Clara's Piano Lesson — recurring Wednesday 15:00-16:00
  await createEvent({
    title: "Piano Lesson",
    startAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0),
    endAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0),
    category: "SCHOOL",
    recurrenceRule: "RRULE:FREQ=WEEKLY;BYDAY=WE",
    location: "Music Academy",
    createdById: mom.id,
    assigneeIds: [clara.id],
  });

  // Michael's Doctor Appointment — one-time, next week
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  await createEvent({
    title: "Doctor Appointment",
    startAt: new Date(nextWeek.getFullYear(), nextWeek.getMonth(), nextWeek.getDate(), 10, 0),
    endAt: new Date(nextWeek.getFullYear(), nextWeek.getMonth(), nextWeek.getDate(), 11, 0),
    category: "MEDICAL",
    location: "Dr. Smith's Office",
    description: "Annual checkup",
    createdById: dad.id,
    assigneeIds: [dad.id],
  });

  // Family trip to the zoo — one-time, this Saturday (all-day)
  const thisSaturday = new Date(today);
  thisSaturday.setDate(thisSaturday.getDate() + ((6 - thisSaturday.getDay() + 7) % 7 || 7));
  await createEvent({
    title: "Zoo Trip",
    startAt: new Date(thisSaturday.getFullYear(), thisSaturday.getMonth(), thisSaturday.getDate()),
    endAt: new Date(thisSaturday.getFullYear(), thisSaturday.getMonth(), thisSaturday.getDate(), 23, 59, 59),
    category: "FAMILY",
    allDay: true,
    description: "Family day at the zoo",
    createdById: mom.id,
    assigneeIds: [mom.id, dad.id, anna.id, ben.id, clara.id, max.id],
  });

  // Anna & Ben — Study session (one-time, tomorrow 14:00-16:00)
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  await createEvent({
    title: "Study Session",
    startAt: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 14, 0),
    endAt: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 16, 0),
    category: "SCHOOL",
    location: "Library",
    createdById: anna.id,
    assigneeIds: [anna.id, ben.id],
  });

  // Sarah & Michael — Date Night (one-time, this Saturday 20:00-23:00)
  await createEvent({
    title: "Date Night",
    startAt: new Date(thisSaturday.getFullYear(), thisSaturday.getMonth(), thisSaturday.getDate(), 20, 0),
    endAt: new Date(thisSaturday.getFullYear(), thisSaturday.getMonth(), thisSaturday.getDate(), 23, 0),
    category: "SOCIAL",
    location: "Italian Restaurant Downtown",
    createdById: dad.id,
    assigneeIds: [mom.id, dad.id],
  });

  // ─── Tasks ──────────────────────────────────────────────────────
  // Helper: create a task + assignees
  async function createTask(data: {
    title: string;
    description?: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    recurrenceRule?: string;
    createdById: string;
    assigneeIds: string[];
  }) {
    const task = await prisma.task.create({
      data: {
        familyId: family.id,
        title: data.title,
        description: data.description,
        priority: data.priority,
        recurrenceRule: data.recurrenceRule,
        createdById: data.createdById,
      },
    });
    for (const memberId of data.assigneeIds) {
      await prisma.taskAssignee.create({
        data: { taskId: task.id, memberId },
      });
    }
    return task;
  }

  // 1. Homework — HIGH, weekdays, Anna + Ben
  const homeworkTask = await createTask({
    title: "Homework",
    description: "Complete all assigned homework before dinner",
    priority: "HIGH",
    recurrenceRule: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    createdById: mom.id,
    assigneeIds: [anna.id, ben.id],
  });

  // 2. Practice Piano — MEDIUM, daily, Clara
  const pianoTask = await createTask({
    title: "Practice Piano",
    description: "30 minutes of piano practice",
    priority: "MEDIUM",
    recurrenceRule: "RRULE:FREQ=DAILY",
    createdById: mom.id,
    assigneeIds: [clara.id],
  });

  // 3. Pack School Bag — LOW, weekdays, Anna + Ben + Clara
  await createTask({
    title: "Pack School Bag",
    description: "Pack bag and check schedule for tomorrow",
    priority: "LOW",
    recurrenceRule: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    createdById: mom.id,
    assigneeIds: [anna.id, ben.id, clara.id],
  });

  // 4. Call Grandma — MEDIUM, weekly Sunday, all kids
  await createTask({
    title: "Call Grandma",
    priority: "MEDIUM",
    recurrenceRule: "RRULE:FREQ=WEEKLY;BYDAY=SU",
    createdById: dad.id,
    assigneeIds: [anna.id, ben.id, clara.id, max.id],
  });

  // 5. Water the Plants — LOW, every 3 days, Max
  await createTask({
    title: "Water the Plants",
    description: "Water all indoor plants",
    priority: "LOW",
    recurrenceRule: "RRULE:FREQ=DAILY;INTERVAL=3",
    createdById: mom.id,
    assigneeIds: [max.id],
  });

  // 6. Read 30 Minutes — MEDIUM, daily, all kids
  const readTask = await createTask({
    title: "Read 30 Minutes",
    description: "Read a book or educational material for 30 minutes",
    priority: "MEDIUM",
    recurrenceRule: "RRULE:FREQ=DAILY",
    createdById: mom.id,
    assigneeIds: [anna.id, ben.id, clara.id, max.id],
  });

  // 7. Prepare Lunch Boxes — HIGH, weekdays, Sarah + Michael
  await createTask({
    title: "Prepare Lunch Boxes",
    description: "Prepare lunch boxes for tomorrow",
    priority: "HIGH",
    recurrenceRule: "RRULE:FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH",
    createdById: mom.id,
    assigneeIds: [mom.id, dad.id],
  });

  // Add some completions for today
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Anna completed homework
  await prisma.taskCompletion.create({
    data: { taskId: homeworkTask.id, memberId: anna.id, date: todayDate },
  });
  await prisma.xpEvent.create({
    data: {
      memberId: anna.id,
      xpAmount: 20,
      pointsAmount: 0,
      source: "TASK_COMPLETION",
      sourceId: homeworkTask.id,
      multiplier: 1.0,
      description: "Completed task: Homework",
    },
  });

  // Clara completed piano practice
  await prisma.taskCompletion.create({
    data: { taskId: pianoTask.id, memberId: clara.id, date: todayDate },
  });
  await prisma.xpEvent.create({
    data: {
      memberId: clara.id,
      xpAmount: 10,
      pointsAmount: 0,
      source: "TASK_COMPLETION",
      sourceId: pianoTask.id,
      multiplier: 1.0,
      description: "Completed task: Practice Piano",
    },
  });

  // Anna completed reading
  await prisma.taskCompletion.create({
    data: { taskId: readTask.id, memberId: anna.id, date: todayDate },
  });
  await prisma.xpEvent.create({
    data: {
      memberId: anna.id,
      xpAmount: 10,
      pointsAmount: 0,
      source: "TASK_COMPLETION",
      sourceId: readTask.id,
      multiplier: 1.0,
      description: "Completed task: Read 30 Minutes",
    },
  });

  // ─── Chores ──────────────────────────────────────────────────────
  // Helper: create a chore + assignees
  async function createChore(data: {
    title: string;
    description?: string;
    category: string;
    recurrenceRule: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    estimatedMinutes?: number;
    needsVerification?: boolean;
    rotationPattern: "ROUND_ROBIN" | "RANDOM" | "WEIGHTED";
    createdById: string;
    assigneeIds: string[];
  }) {
    const chore = await prisma.chore.create({
      data: {
        familyId: family.id,
        title: data.title,
        description: data.description,
        category: data.category,
        recurrenceRule: data.recurrenceRule,
        recurrenceStart: new Date(),
        difficulty: data.difficulty,
        estimatedMinutes: data.estimatedMinutes,
        needsVerification: data.needsVerification ?? false,
        rotationPattern: data.rotationPattern,
        createdById: data.createdById,
      },
    });
    for (let i = 0; i < data.assigneeIds.length; i++) {
      await prisma.choreAssignee.create({
        data: {
          choreId: chore.id,
          memberId: data.assigneeIds[i],
          sortOrder: i,
        },
      });
    }
    return chore;
  }

  // 1. Wash Dishes — DAILY, EASY, Round Robin, Kitchen
  const washDishesChore = await createChore({
    title: "Wash Dishes",
    description: "Wash and dry all dishes after dinner",
    category: "Kitchen",
    recurrenceRule: "RRULE:FREQ=DAILY",
    difficulty: "EASY",
    estimatedMinutes: 15,
    rotationPattern: "ROUND_ROBIN",
    createdById: mom.id,
    assigneeIds: [anna.id, ben.id, clara.id],
  });

  // 2. Vacuum Living Room — WEEKLY, MEDIUM, Round Robin, Living Room
  const vacuumChore = await createChore({
    title: "Vacuum Living Room",
    description: "Vacuum the entire living room including under furniture",
    category: "Living Room",
    recurrenceRule: "RRULE:FREQ=WEEKLY;BYDAY=MO",
    difficulty: "MEDIUM",
    estimatedMinutes: 20,
    rotationPattern: "ROUND_ROBIN",
    createdById: mom.id,
    assigneeIds: [anna.id, ben.id],
  });

  // 3. Take Out Trash — BIWEEKLY, EASY, Random, Outdoor
  await createChore({
    title: "Take Out Trash",
    category: "Outdoor",
    recurrenceRule: "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO",
    difficulty: "EASY",
    estimatedMinutes: 5,
    rotationPattern: "RANDOM",
    createdById: dad.id,
    assigneeIds: [ben.id, max.id],
  });

  // 4. Clean Bathroom — WEEKLY, HARD, Weighted, Bathroom, needs verification
  const bathroomChore = await createChore({
    title: "Clean Bathroom",
    description: "Scrub toilet, sink, shower, and mop the floor",
    category: "Bathroom",
    recurrenceRule: "RRULE:FREQ=WEEKLY;BYDAY=MO",
    difficulty: "HARD",
    estimatedMinutes: 30,
    needsVerification: true,
    rotationPattern: "WEIGHTED",
    createdById: mom.id,
    assigneeIds: [anna.id, ben.id, clara.id],
  });

  // 5. Feed the Dog — DAILY, EASY, Round Robin, Pets
  await createChore({
    title: "Feed the Dog",
    description: "Morning and evening feeding",
    category: "Pets",
    recurrenceRule: "RRULE:FREQ=DAILY",
    difficulty: "EASY",
    estimatedMinutes: 5,
    rotationPattern: "ROUND_ROBIN",
    createdById: dad.id,
    assigneeIds: [clara.id, max.id],
  });

  // 6. Mow the Lawn — BIWEEKLY, HARD, Round Robin, Outdoor
  await createChore({
    title: "Mow the Lawn",
    description: "Mow front and back yard",
    category: "Outdoor",
    recurrenceRule: "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO",
    difficulty: "HARD",
    estimatedMinutes: 45,
    rotationPattern: "ROUND_ROBIN",
    createdById: dad.id,
    assigneeIds: [dad.id, anna.id, ben.id],
  });

  // ─── Chore Instances ────────────────────────────────────────────
  // Helper: compute current period (simplified, matching periods.ts logic)
  function getMonday(d: Date): Date {
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  }

  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const monday = getMonday(todayOnly);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

  // Instance 1: Wash dishes today — Anna — DONE
  const washInstance = await prisma.choreInstance.create({
    data: {
      choreId: washDishesChore.id,
      assignedMemberId: anna.id,
      periodStart: todayOnly,
      periodEnd: todayOnly,
      status: "DONE",
      completedAt: new Date(),
    },
  });

  // XP for wash dishes completion
  await prisma.xpEvent.create({
    data: {
      memberId: anna.id,
      xpAmount: 5,
      pointsAmount: 0,
      source: "CHORE_COMPLETION",
      sourceId: washInstance.id,
      multiplier: 1.0,
      description: "Completed chore: Wash Dishes",
    },
  });
  await prisma.activityEvent.create({
    data: {
      familyId: family.id,
      memberId: anna.id,
      type: "CHORE_COMPLETED",
      description: "Completed chore: Wash Dishes",
      sourceModule: "chores",
      sourceId: washInstance.id,
    },
  });

  // Instance 2: Vacuum this week — Ben — DONE
  const vacuumInstance = await prisma.choreInstance.create({
    data: {
      choreId: vacuumChore.id,
      assignedMemberId: ben.id,
      periodStart: monday,
      periodEnd: sunday,
      status: "DONE",
      completedAt: new Date(),
    },
  });
  await prisma.xpEvent.create({
    data: {
      memberId: ben.id,
      xpAmount: 15,
      pointsAmount: 0,
      source: "CHORE_COMPLETION",
      sourceId: vacuumInstance.id,
      multiplier: 1.0,
      description: "Completed chore: Vacuum Living Room",
    },
  });
  await prisma.activityEvent.create({
    data: {
      familyId: family.id,
      memberId: ben.id,
      type: "CHORE_COMPLETED",
      description: "Completed chore: Vacuum Living Room",
      sourceModule: "chores",
      sourceId: vacuumInstance.id,
    },
  });

  // Instance 3: Clean Bathroom this week — Anna — PENDING_REVIEW (needs verification)
  await prisma.choreInstance.create({
    data: {
      choreId: bathroomChore.id,
      assignedMemberId: anna.id,
      periodStart: monday,
      periodEnd: sunday,
      status: "PENDING_REVIEW",
      completedAt: new Date(),
    },
  });

  // Instance 4: Wash dishes yesterday — Ben — PENDING (a past day left pending for testing)
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  await prisma.choreInstance.create({
    data: {
      choreId: washDishesChore.id,
      assignedMemberId: ben.id,
      periodStart: yesterday,
      periodEnd: yesterday,
      status: "PENDING",
    },
  });

  // ─── Chore Swap Request ─────────────────────────────────────────
  // Anna requests to swap her bathroom chore with Ben
  const bathroomInstance = await prisma.choreInstance.findFirst({
    where: {
      choreId: bathroomChore.id,
      assignedMemberId: anna.id,
      status: "PENDING_REVIEW",
    },
  });

  if (bathroomInstance) {
    await prisma.choreSwapRequest.create({
      data: {
        choreInstanceId: bathroomInstance.id,
        requesterId: anna.id,
        targetMemberId: ben.id,
        status: "PENDING",
      },
    });
  }

  // ─── Recipes & Meal Plans ───────────────────────────────────────

  async function createRecipe(data: {
    title: string;
    instructions?: string;
    servings?: number;
    prepTime?: number;
    cookTime?: number;
    tags?: string[];
    isFavorite?: boolean;
    createdById: string;
    ingredients: { name: string; quantity?: string; unit?: string }[];
  }) {
    const recipe = await prisma.recipe.create({
      data: {
        familyId: family.id,
        title: data.title,
        instructions: data.instructions,
        servings: data.servings,
        prepTime: data.prepTime,
        cookTime: data.cookTime,
        tags: data.tags ?? [],
        isFavorite: data.isFavorite ?? false,
        createdById: data.createdById,
      },
    });
    if (data.ingredients.length > 0) {
      await prisma.recipeIngredient.createMany({
        data: data.ingredients.map((ing) => ({
          recipeId: recipe.id,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
        })),
      });
    }
    return recipe;
  }

  const pancakes = await createRecipe({
    title: "Pancakes",
    instructions: "Mix dry ingredients. Add wet ingredients. Cook on griddle until golden.",
    servings: 4,
    prepTime: 20,
    cookTime: 15,
    tags: ["Quick", "Kid-Friendly", "Breakfast"],
    isFavorite: true,
    createdById: mom.id,
    ingredients: [
      { name: "Flour", quantity: "2", unit: "cup" },
      { name: "Eggs", quantity: "2", unit: "pcs" },
      { name: "Milk", quantity: "250", unit: "ml" },
      { name: "Butter", quantity: "2", unit: "tbsp" },
      { name: "Sugar", quantity: "2", unit: "tbsp" },
    ],
  });

  const bolognese = await createRecipe({
    title: "Spaghetti Bolognese",
    instructions: "Brown meat with onion and garlic. Add tomato sauce. Simmer 20 min. Serve over pasta.",
    servings: 6,
    prepTime: 15,
    cookTime: 30,
    tags: ["Comfort Food"],
    isFavorite: true,
    createdById: dad.id,
    ingredients: [
      { name: "Spaghetti", quantity: "500", unit: "g" },
      { name: "Ground Beef", quantity: "500", unit: "g" },
      { name: "Tomato Sauce", quantity: "400", unit: "ml" },
      { name: "Onion", quantity: "1", unit: "pcs" },
      { name: "Garlic", quantity: "3", unit: "clove" },
      { name: "Olive Oil", quantity: "2", unit: "tbsp" },
    ],
  });

  const caesarSalad = await createRecipe({
    title: "Caesar Salad",
    instructions: "Wash and chop lettuce. Toss with dressing, croutons, and parmesan.",
    servings: 4,
    prepTime: 15,
    cookTime: 0,
    tags: ["Quick", "Healthy"],
    createdById: mom.id,
    ingredients: [
      { name: "Romaine Lettuce", quantity: "1", unit: "pcs" },
      { name: "Parmesan", quantity: "50", unit: "g" },
      { name: "Croutons", quantity: "1", unit: "cup" },
      { name: "Caesar Dressing", quantity: "4", unit: "tbsp" },
    ],
  });

  const stirFry = await createRecipe({
    title: "Chicken Stir-Fry",
    instructions: "Slice chicken and vegetables. Stir-fry in hot wok. Add soy sauce. Serve with rice.",
    servings: 4,
    prepTime: 10,
    cookTime: 15,
    tags: ["Quick", "Healthy"],
    createdById: dad.id,
    ingredients: [
      { name: "Chicken Breast", quantity: "400", unit: "g" },
      { name: "Bell Pepper", quantity: "2", unit: "pcs" },
      { name: "Soy Sauce", quantity: "3", unit: "tbsp" },
      { name: "Rice", quantity: "300", unit: "g" },
      { name: "Broccoli", quantity: "200", unit: "g" },
      { name: "Garlic", quantity: "2", unit: "clove" },
    ],
  });

  const grilledCheese = await createRecipe({
    title: "Grilled Cheese Sandwich",
    instructions: "Butter bread. Add cheese. Grill in pan until golden and melty.",
    servings: 2,
    prepTime: 5,
    cookTime: 10,
    tags: ["Quick", "Kid-Friendly", "Vegetarian"],
    createdById: anna.id,
    ingredients: [
      { name: "Bread", quantity: "4", unit: "pcs" },
      { name: "Butter", quantity: "2", unit: "tbsp" },
      { name: "Cheddar Cheese", quantity: "100", unit: "g" },
    ],
  });

  // Meal Plans for current week (Mon–Fri)
  const mealMonday = new Date(monday);
  await prisma.mealPlan.createMany({
    data: [
      { familyId: family.id, date: mealMonday, slot: "BREAKFAST", recipeId: pancakes.id },
      { familyId: family.id, date: mealMonday, slot: "LUNCH", freeformName: "Leftover Pizza" },
      { familyId: family.id, date: mealMonday, slot: "DINNER", recipeId: bolognese.id },
    ],
  });

  const mealTuesday = new Date(monday);
  mealTuesday.setDate(mealTuesday.getDate() + 1);
  await prisma.mealPlan.createMany({
    data: [
      { familyId: family.id, date: mealTuesday, slot: "LUNCH", recipeId: caesarSalad.id },
      { familyId: family.id, date: mealTuesday, slot: "DINNER", recipeId: stirFry.id },
    ],
  });

  const mealWednesday = new Date(monday);
  mealWednesday.setDate(mealWednesday.getDate() + 2);
  await prisma.mealPlan.create({
    data: { familyId: family.id, date: mealWednesday, slot: "DINNER", freeformName: "Takeout Night" },
  });

  const mealThursday = new Date(monday);
  mealThursday.setDate(mealThursday.getDate() + 3);
  await prisma.mealPlan.create({
    data: { familyId: family.id, date: mealThursday, slot: "LUNCH", recipeId: grilledCheese.id },
  });

  const mealFriday = new Date(monday);
  mealFriday.setDate(mealFriday.getDate() + 4);
  await prisma.mealPlan.create({
    data: { familyId: family.id, date: mealFriday, slot: "DINNER", freeformName: "Pizza Night" },
  });

  // ─── Notes ─────────────────────────────────────────────────────

  await prisma.note.create({
    data: {
      familyId: family.id,
      title: "WiFi Password",
      pinned: true,
      color: "#fef08a",
      category: "Important",
      createdById: mom.id,
      body: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Network: MillerHome_5G" }] },
          { type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "Password: FamilyMiller2024!" }] },
        ],
      },
    },
  });

  await prisma.note.create({
    data: {
      familyId: family.id,
      title: "Emergency Contacts",
      pinned: true,
      color: "#fecaca",
      category: "Important",
      createdById: mom.id,
      body: {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Dr. Smith (Family Doctor): 555-0123" }] }] },
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Grandma Miller: 555-0456" }] }] },
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "School Office: 555-0789" }] }] },
            ],
          },
        ],
      },
    },
  });

  await prisma.note.create({
    data: {
      familyId: family.id,
      title: "Anna's Book Report",
      pinned: false,
      color: "#bfdbfe",
      category: "School",
      createdById: anna.id,
      body: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Book: Charlotte's Web by E.B. White" }] },
          { type: "paragraph", content: [{ type: "text", text: "Due date: Next Friday. Need to write 2 pages about the main theme and characters." }] },
        ],
      },
    },
  });

  await prisma.note.create({
    data: {
      familyId: family.id,
      title: "Birthday Gift Ideas - Grandma",
      pinned: false,
      color: "#ddd6fe",
      category: "Fun",
      createdById: dad.id,
      body: {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Gardening gloves and seeds" }] }] },
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Photo album of the kids" }] }] },
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Cozy blanket" }] }] },
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Tea sampler set" }] }] },
            ],
          },
        ],
      },
    },
  });

  await prisma.note.create({
    data: {
      familyId: family.id,
      title: "House Rules",
      pinned: false,
      color: "#bbf7d0",
      category: "Household",
      createdById: mom.id,
      body: {
        type: "doc",
        content: [
          {
            type: "orderedList",
            attrs: { start: 1 },
            content: [
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Shoes off at the door" }] }] },
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Clean up after yourself in the kitchen" }] }] },
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "No screens after 9 PM on school nights" }] }] },
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Be kind and respectful to each other" }] }] },
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Ask before borrowing someone else's things" }] }] },
            ],
          },
        ],
      },
    },
  });

  await prisma.note.create({
    data: {
      familyId: family.id,
      title: "Dentist Appointment Reminder",
      pinned: false,
      color: "#fed7aa",
      category: "Reminders",
      createdById: dad.id,
      body: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Anna and Ben have dentist appointments on the 15th at 3:00 PM. Remember to bring insurance cards." }] },
        ],
      },
    },
  });

  // ─── Notifications ─────────────────────────────────────────────

  // Sarah: 4 notifications (2 unread, 2 read)
  await prisma.notification.create({
    data: {
      memberId: mom.id,
      type: "CHORE_DEADLINE",
      title: "Chore Due Today",
      message: "Clean Bathroom is due today. Don't forget!",
      sourceModule: "chores",
      read: false,
    },
  });
  await prisma.notification.create({
    data: {
      memberId: mom.id,
      type: "SWAP_REQUEST",
      title: "Swap Request",
      message: "Ben wants to swap Wash Dishes with you for today.",
      sourceModule: "chores",
      read: false,
    },
  });
  await prisma.notification.create({
    data: {
      memberId: mom.id,
      type: "CALENDAR_REMINDER",
      title: "Upcoming Event",
      message: "Team Meeting starts in 30 minutes.",
      sourceModule: "calendar",
      read: true,
      readAt: new Date(),
    },
  });
  await prisma.notification.create({
    data: {
      memberId: mom.id,
      type: "ADMIN_ANNOUNCEMENT",
      title: "New House Rules",
      message: "New house rules have been posted on the bulletin board.",
      sourceModule: "notes",
      read: true,
      readAt: new Date(),
    },
  });

  // Anna: 2 notifications (1 unread, 1 read)
  await prisma.notification.create({
    data: {
      memberId: anna.id,
      type: "CHORE_DEADLINE",
      title: "Chore Due Today",
      message: "Wash Dishes is due today.",
      sourceModule: "chores",
      read: false,
    },
  });
  await prisma.notification.create({
    data: {
      memberId: anna.id,
      type: "CALENDAR_REMINDER",
      title: "Upcoming Event",
      message: "Study Session tomorrow at 2:00 PM at the Library.",
      sourceModule: "calendar",
      read: true,
      readAt: new Date(),
    },
  });

  // Ben: 2 notifications (1 unread, 1 read)
  await prisma.notification.create({
    data: {
      memberId: ben.id,
      type: "SWAP_REQUEST",
      title: "Swap Request",
      message: "Anna requested to swap Clean Bathroom with you.",
      sourceModule: "chores",
      read: false,
    },
  });
  await prisma.notification.create({
    data: {
      memberId: ben.id,
      type: "CALENDAR_REMINDER",
      title: "Upcoming Event",
      message: "Soccer Practice today at 4:00 PM.",
      sourceModule: "calendar",
      read: true,
      readAt: new Date(),
    },
  });

  // ─── Extra Activity Events ────────────────────────────────────

  await prisma.activityEvent.create({
    data: {
      familyId: family.id,
      memberId: mom.id,
      type: "EVENT_CREATED",
      description: "Created event: Zoo Trip",
      sourceModule: "calendar",
    },
  });

  await prisma.activityEvent.create({
    data: {
      familyId: family.id,
      memberId: mom.id,
      type: "SHOPPING_ITEM_ADDED",
      description: "Added Milk to Groceries",
      sourceModule: "shopping",
    },
  });

  await prisma.activityEvent.create({
    data: {
      familyId: family.id,
      memberId: mom.id,
      type: "NOTE_PINNED",
      description: "Pinned note: WiFi Password",
      sourceModule: "notes",
    },
  });

  // ─── Achievements ─────────────────────────────────────────────

  const achievementData = [
    { name: "First Steps", description: "Complete your first task", condition: { type: "task_count", threshold: 1 }, rarity: "COMMON" as const, xpReward: 10, pointsReward: 1 },
    { name: "Helping Hand", description: "Complete 10 tasks", condition: { type: "task_count", threshold: 10 }, rarity: "COMMON" as const, xpReward: 25, pointsReward: 3 },
    { name: "Task Master", description: "Complete 50 tasks", condition: { type: "task_count", threshold: 50 }, rarity: "RARE" as const, xpReward: 100, pointsReward: 10 },
    { name: "Tidy Up", description: "Complete your first chore", condition: { type: "chore_count", threshold: 1 }, rarity: "COMMON" as const, xpReward: 10, pointsReward: 1 },
    { name: "Clean Machine", description: "Complete 25 chores", condition: { type: "chore_count", threshold: 25 }, rarity: "RARE" as const, xpReward: 75, pointsReward: 8 },
    { name: "On a Roll", description: "Maintain a 7-day streak", condition: { type: "streak_days", threshold: 7 }, rarity: "RARE" as const, xpReward: 50, pointsReward: 5 },
    { name: "Unstoppable", description: "Maintain a 30-day streak", condition: { type: "streak_days", threshold: 30 }, rarity: "EPIC" as const, xpReward: 200, pointsReward: 20 },
    { name: "XP Legend", description: "Reach 10,000 total XP", condition: { type: "total_xp", threshold: 10000 }, rarity: "LEGENDARY" as const, xpReward: 500, pointsReward: 50 },
  ];

  const achievements: Array<{ id: string; name: string }> = [];
  for (const a of achievementData) {
    const achievement = await prisma.achievement.create({
      data: {
        familyId: family.id,
        name: a.name,
        description: a.description,
        condition: a.condition,
        rarity: a.rarity,
        xpReward: a.xpReward,
        pointsReward: a.pointsReward,
        isCustom: false,
      },
    });
    achievements.push({ id: achievement.id, name: achievement.name });
  }

  // Anna unlocked "First Steps" and "Tidy Up"
  const firstSteps = achievements.find((a) => a.name === "First Steps")!;
  const tidyUp = achievements.find((a) => a.name === "Tidy Up")!;

  await prisma.memberAchievement.create({
    data: { memberId: anna.id, achievementId: firstSteps.id },
  });
  await prisma.memberAchievement.create({
    data: { memberId: anna.id, achievementId: tidyUp.id },
  });

  // ─── Rewards ────────────────────────────────────────────────

  const reward1 = await prisma.reward.create({
    data: {
      familyId: family.id,
      title: "Pick tonight's movie",
      description: "You get to choose what the family watches tonight!",
      pointCost: 50,
      requiresApproval: false,
      createdById: mom.id,
    },
  });

  const reward2 = await prisma.reward.create({
    data: {
      familyId: family.id,
      title: "Extra 30 min screen time",
      description: "Get 30 extra minutes of screen time today.",
      pointCost: 100,
      requiresApproval: true,
      createdById: mom.id,
    },
  });

  const reward3 = await prisma.reward.create({
    data: {
      familyId: family.id,
      title: "Skip one chore",
      description: "Skip your next assigned chore (must be approved).",
      pointCost: 200,
      requiresApproval: true,
      createdById: dad.id,
    },
  });

  const reward4 = await prisma.reward.create({
    data: {
      familyId: family.id,
      title: "€10 pocket money",
      description: "Receive €10 in pocket money.",
      pointCost: 500,
      requiresApproval: true,
      createdById: dad.id,
    },
  });

  // ─── Redemptions ─────────────────────────────────────────────

  // Anna redeemed "Pick tonight's movie" — auto-approved
  await prisma.rewardRedemption.create({
    data: {
      rewardId: reward1.id,
      memberId: anna.id,
      pointsSpent: 50,
      status: "APPROVED",
      reviewedAt: new Date(Date.now() - 3 * 86400000),
    },
  });

  // Ben redeemed "Extra 30 min screen time" — pending approval
  await prisma.rewardRedemption.create({
    data: {
      rewardId: reward2.id,
      memberId: ben.id,
      pointsSpent: 100,
      status: "PENDING_APPROVAL",
    },
  });

  // Anna redeemed "Extra 30 min screen time" — approved by Dad
  await prisma.rewardRedemption.create({
    data: {
      rewardId: reward2.id,
      memberId: anna.id,
      pointsSpent: 100,
      status: "APPROVED",
      reviewedById: dad.id,
      reviewedAt: new Date(Date.now() - 86400000),
    },
  });

  // ─── Family Goal ─────────────────────────────────────────────

  await prisma.familyGoal.create({
    data: {
      familyId: family.id,
      title: "Family Movie Night",
      description: "Earn 500 XP together as a family",
      targetXp: 500,
      currentXp: 45,
      rewardDescription: "Pizza and movie night!",
      status: "ACTIVE",
    },
  });

  // ─── Update XP Profiles with computed totals ─────────────────

  // Anna: 20 (homework) + 10 (reading) + 5 (wash dishes) + 10 (First Steps) + 10 (Tidy Up) = 55 XP
  await prisma.memberXpProfile.update({
    where: { memberId: anna.id },
    data: { totalXp: 55, level: 1, points: 6, currentStreak: 1, longestStreak: 1 },
  });

  // Clara: 10 (piano practice) = 10 XP
  await prisma.memberXpProfile.update({
    where: { memberId: clara.id },
    data: { totalXp: 10, level: 1, points: 1 },
  });

  // Ben: 15 (vacuum) = 15 XP
  await prisma.memberXpProfile.update({
    where: { memberId: ben.id },
    data: { totalXp: 15, level: 1, points: 2 },
  });

  console.log("Seed complete!");
  console.log(`Family: ${family.name} (ID: ${family.id})`);
  console.log(`Members: ${allMembers.map((m) => m.name).join(", ")}`);
  console.log("All PINs: 1234");
  console.log("Tasks: 7 created, 3 completions seeded");
  console.log("Chores: 6 created, 4 instances, 1 swap request seeded");
  console.log("Shopping: 2 lists, 11 items (2 checked)");
  console.log("Meals: 5 recipes, 8 meal plan entries");
  console.log("Notes: 6 created (2 pinned)");
  console.log("Notifications: 8 created (4 unread)");
  console.log("Activity: extra events from calendar, shopping, notes");
  console.log("Rewards: 4 rewards, 8 achievements, 3 redemptions, 1 goal seeded");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
