/**
 * Database types for the live Supabase project.
 * Generated from the PostgREST schema (see scripts note in README) and then
 * hand-annotated with the string unions the app relies on.
 *
 * Nullability: only primary keys are guaranteed non-null here. Columns that are
 * NOT NULL with a default are not distinguishable over PostgREST, so reads are
 * typed defensively — narrow at the call site when you know better.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Sex = 'male' | 'female';
export type PrimaryGoal =
  | 'fat_loss'
  | 'lean_bulk'
  | 'recomp'
  | 'six_pack'
  | 'discipline'
  | 'spiritual';
export type TrainingMode = 'gym' | 'home' | 'hybrid';
export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type DietType = 'veg' | 'egg' | 'nonveg';
export type BudgetMode = 'hostel' | 'normal';
export type ModuleSlug = 'abs' | 'face_skin' | 'jawline' | 'running' | 'content_creator';

/** Values seeded in task_templates. */
export type TaskCategory = 'discipline' | 'body' | 'face' | 'mind' | 'spirit' | 'work';
export type TaskModule = 'core' | ModuleSlug;
export type TaskUnit = 'check' | 'min' | 'rounds' | 'steps' | 'km' | 'L';

export type AchievementRow = {
  user_id: string;
  code: string;
  earned_at: string | null;
};

export type AiPlanRow = {
  id: string;
  user_id: string;
  plan_type: string;
  week: number;
  content: Json;
  is_active: boolean | null;
  created_at: string | null;
};

export type AiUsageRow = {
  id: number;
  user_id: string;
  route: string;
  created_at: string | null;
};

export type BodyMeasurementRow = {
  user_id: string;
  log_date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  neck_cm: number | null;
  hip_cm: number | null;
  body_fat_pct: number | null;
};

export type CheckinRow = {
  id: string;
  user_id: string;
  week: number;
  energy: number | null;
  hunger: number | null;
  pain_notes: string | null;
  notes: string | null;
  input_snapshot: Json | null;
  ai_feedback: Json | null;
  calorie_adjustment: number | null;
  created_at: string | null;
};

export type ContentPostRow = {
  id: string;
  user_id: string;
  log_date: string;
  platform: string | null;
  url: string | null;
  title: string | null;
};

export type DailyLogRow = {
  id: string;
  user_id: string;
  user_task_id: string;
  log_date: string;
  completed: boolean | null;
  value: number | null;
  completed_at: string | null;
};

export type ExerciseRow = {
  id: number;
  slug: string;
  name: string;
  muscle_group: string;
  equipment: string;
  level: string;
  is_bodyweight: boolean | null;
  cues: string[] | null;
  mistakes: string[] | null;
  progression_of: number | null;
  video_url: string | null;
};

export type FoodEntryRow = {
  id: string;
  user_id: string;
  log_date: string;
  meal: string | null;
  description: string;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  source: string | null;
  created_at: string | null;
};

export type GitaProgressRow = {
  user_id: string;
  chapter: number;
  verse: number | null;
  completed_at: string | null;
};

export type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  sex: Sex | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  activity_level: number | null;
  goal: PrimaryGoal | null;
  modules: ModuleSlug[] | null;
  training_mode: TrainingMode | null;
  equipment: string[] | null;
  max_dumbbell_kg: number | null;
  fitness_level: FitnessLevel | null;
  days_per_week: number | null;
  session_minutes: number | null;
  diet_type: DietType | null;
  diet_notes: string | null;
  budget: BudgetMode | null;
  calorie_target: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
  water_target_ml: number | null;
  wake_time: string | null;
  sleep_target_h: number | null;
  timezone: string | null;
  challenge_start: string | null;
  is_public: boolean | null;
  onboarded: boolean | null;
  /** Index into STEPS of the furthest onboarding step submitted. */
  onboarding_step: number | null;
  /** True when the user chose "Skip — measure later" on Baseline. */
  skipped_baseline: boolean | null;
  created_at: string | null;
};

export type ProgressPhotoRow = {
  id: string;
  user_id: string;
  log_date: string;
  angle: string;
  storage_path: string;
  created_at: string | null;
};

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  /** Superseded by reminder_settings; kept for old rows. */
  reminders: Json | null;
  created_at: string | null;
  last_success_at: string | null;
  user_agent: string | null;
};

export type ReminderSettingsRow = {
  user_id: string;
  /** Validated by lib/reminders/settings.ts parseReminderSettings. */
  settings: Json;
  updated_at: string | null;
};

export type SignupAttemptRow = {
  id: number;
  /** HMAC-SHA256 of the client IP; never the IP itself. */
  ip_hash: string;
  created_at: string | null;
};

export type ReminderLogRow = {
  user_id: string;
  /** Dedupe key: the reminder kind, or water_HH. */
  kind: string;
  local_date: string;
  sent_at: string | null;
};

export type SkinLogRow = {
  user_id: string;
  log_date: string;
  am_done: boolean | null;
  pm_done: boolean | null;
  breakouts: number | null;
  dairy: boolean | null;
  notes: string | null;
};

export type SleepLogRow = {
  user_id: string;
  log_date: string;
  bed_time: string | null;
  wake_time: string | null;
  hours: number | null;
  quality: number | null;
};

export type TaskTemplateRow = {
  id: number;
  slug: string;
  title: string;
  category: TaskCategory;
  module: TaskModule;
  default_target: number;
  unit: TaskUnit;
  sort_order: number;
};

export type UserTaskRow = {
  id: string;
  user_id: string;
  template_id: number | null;
  title: string;
  category: TaskCategory;
  target: number;
  unit: TaskUnit;
  is_custom: boolean | null;
  active: boolean | null;
  sort_order: number | null;
  created_at: string | null;
};

export type WaterLogRow = {
  user_id: string;
  log_date: string;
  ml: number;
};

export type WorkoutSessionRow = {
  id: string;
  user_id: string;
  session_date: string;
  plan_week: number | null;
  plan_day: string | null;
  started_at: string | null;
  finished_at: string | null;
  session_rpe: number | null;
  soreness: number | null;
  notes: string | null;
};

export type WorkoutSetRow = {
  id: string;
  session_id: string;
  user_id: string;
  exercise_id: number;
  set_no: number;
  reps: number | null;
  weight_kg: number | null;
  duration_sec: number | null;
  rpe: number | null;
  is_pr: boolean | null;
  created_at: string | null;
};

/** Convenience aliases for the tables the app writes most. */
export type ProfileUpdate = Partial<ProfileRow>;

/** public_profiles view: the only columns of a profile anyone else can read. */
export type PublicProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  challenge_start: string | null;
};

/** get_leaderboard(p_days, p_limit): discipline only, public + onboarded users. */
export type LeaderboardRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  points: number;
  current_streak: number;
};

/** get_public_profile(username). */
export type PublicProfileStats = {
  today: string;
  days: { date: string; completed: number; active: number }[];
  achievements: string[];
};
export type BodyMeasurementUpsert = Partial<BodyMeasurementRow> &
  Pick<BodyMeasurementRow, 'user_id' | 'log_date'>;

export type Database = {
  public: {
    Tables: {
      achievements: {
        Row: AchievementRow;
        Insert: Partial<AchievementRow>;
        Update: Partial<AchievementRow>;
        Relationships: [];
      };
      ai_plans: {
        Row: AiPlanRow;
        Insert: Partial<AiPlanRow>;
        Update: Partial<AiPlanRow>;
        Relationships: [];
      };
      ai_usage: {
        Row: AiUsageRow;
        Insert: Partial<AiUsageRow>;
        Update: Partial<AiUsageRow>;
        Relationships: [];
      };
      body_measurements: {
        Row: BodyMeasurementRow;
        Insert: Partial<BodyMeasurementRow>;
        Update: Partial<BodyMeasurementRow>;
        Relationships: [];
      };
      checkins: {
        Row: CheckinRow;
        Insert: Partial<CheckinRow>;
        Update: Partial<CheckinRow>;
        Relationships: [];
      };
      content_posts: {
        Row: ContentPostRow;
        Insert: Partial<ContentPostRow>;
        Update: Partial<ContentPostRow>;
        Relationships: [];
      };
      daily_logs: {
        Row: DailyLogRow;
        Insert: Partial<DailyLogRow>;
        Update: Partial<DailyLogRow>;
        Relationships: [];
      };
      exercises: {
        Row: ExerciseRow;
        Insert: Partial<ExerciseRow>;
        Update: Partial<ExerciseRow>;
        Relationships: [];
      };
      food_entries: {
        Row: FoodEntryRow;
        Insert: Partial<FoodEntryRow>;
        Update: Partial<FoodEntryRow>;
        Relationships: [];
      };
      gita_progress: {
        Row: GitaProgressRow;
        Insert: Partial<GitaProgressRow>;
        Update: Partial<GitaProgressRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow>;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      progress_photos: {
        Row: ProgressPhotoRow;
        Insert: Partial<ProgressPhotoRow>;
        Update: Partial<ProgressPhotoRow>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: Partial<PushSubscriptionRow>;
        Update: Partial<PushSubscriptionRow>;
        Relationships: [];
      };
      reminder_settings: {
        Row: ReminderSettingsRow;
        Insert: Partial<ReminderSettingsRow> & Pick<ReminderSettingsRow, 'user_id'>;
        Update: Partial<ReminderSettingsRow>;
        Relationships: [];
      };
      signup_attempts: {
        Row: SignupAttemptRow;
        Insert: Partial<SignupAttemptRow> & Pick<SignupAttemptRow, 'ip_hash'>;
        Update: Partial<SignupAttemptRow>;
        Relationships: [];
      };
      reminder_log: {
        Row: ReminderLogRow;
        Insert: Partial<ReminderLogRow> & Pick<ReminderLogRow, 'user_id' | 'kind' | 'local_date'>;
        Update: Partial<ReminderLogRow>;
        Relationships: [];
      };
      skin_logs: {
        Row: SkinLogRow;
        Insert: Partial<SkinLogRow>;
        Update: Partial<SkinLogRow>;
        Relationships: [];
      };
      sleep_logs: {
        Row: SleepLogRow;
        Insert: Partial<SleepLogRow>;
        Update: Partial<SleepLogRow>;
        Relationships: [];
      };
      task_templates: {
        Row: TaskTemplateRow;
        Insert: Partial<TaskTemplateRow>;
        Update: Partial<TaskTemplateRow>;
        Relationships: [];
      };
      user_tasks: {
        Row: UserTaskRow;
        Insert: Partial<UserTaskRow>;
        Update: Partial<UserTaskRow>;
        Relationships: [];
      };
      water_logs: {
        Row: WaterLogRow;
        Insert: Partial<WaterLogRow>;
        Update: Partial<WaterLogRow>;
        Relationships: [];
      };
      workout_sessions: {
        Row: WorkoutSessionRow;
        Insert: Partial<WorkoutSessionRow>;
        Update: Partial<WorkoutSessionRow>;
        Relationships: [];
      };
      workout_sets: {
        Row: WorkoutSetRow;
        Insert: Partial<WorkoutSetRow>;
        Update: Partial<WorkoutSetRow>;
        Relationships: [];
      };
    };
    Views: {
      public_profiles: {
        Row: PublicProfileRow;
        Relationships: [];
      };
    };
    Functions: {
      get_leaderboard: {
        Args: { p_days: number; p_limit: number };
        Returns: LeaderboardRow[];
      };
      get_streak: {
        Args: { p_user: string };
        Returns: number;
      };
      get_public_profile: {
        Args: { p_username: string };
        Returns: PublicProfileStats | null;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
