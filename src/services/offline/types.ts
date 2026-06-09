export type QueueKind =
  | "upsert"
  | "delete"
  | "upsert_mymeal"
  | "delete_mymeal"
  | "update_user_profile"
  | "upload_user_avatar";

export type MealRow = {
  cloud_id: string | null;
  meal_id: string;
  user_uid: string;
  timestamp: string;
  day_key?: string | null;
  logged_at_local_min?: number | null;
  tz_offset_min?: number | null;
  type: string;
  name: string | null;
  ingredients: string | null;
  photo_local_path: string | null;
  photo_url: string | null;
  image_local: string | null;
  image_id: string | null;
  totals_kcal: number | null;
  totals_protein: number | null;
  totals_carbs: number | null;
  totals_fat: number | null;
  deleted: number;
  created_at: string | null;
  updated_at: string;
  last_synced_at?: number | null;
  sync_state?: string | null;
  source: string | null;
  input_method?: string | null;
  ai_meta?: string | null;
  notes: string | null;
  tags: string | null;
};

export type ImageStatus = "pending" | "uploaded" | "failed";

export type ImageRow = {
  image_id: string;
  user_uid: string;
  local_path: string;
  cloud_url: string | null;
  status: ImageStatus;
  updated_at: string;
};

export type QueueRow = {
  id: number;
  client_mutation_id: string;
  cloud_id: string;
  user_uid: string;
  kind: QueueKind;
  payload: string;
  updated_at: string;
  attempts: number;
};

export type DeadLetterRow = {
  id: number;
  op_id: number;
  client_mutation_id: string;
  cloud_id: string;
  user_uid: string;
  kind: QueueKind;
  payload: string;
  updated_at: string;
  attempts: number;
  failed_at: string;
  last_error_code: string | null;
  last_error_message: string | null;
};

export type ChatThreadRow = {
  id: string;
  user_uid: string;
  title: string | null;
  created_at: number;
  updated_at: number;
  last_message: string | null;
  last_message_at: number | null;
};

export type ChatMessageRow = {
  id: string;
  thread_id: string;
  user_uid: string;
  role: string;
  content: string;
  created_at: number;
  last_synced_at: number;
  sync_state: string;
  deleted: number;
};
