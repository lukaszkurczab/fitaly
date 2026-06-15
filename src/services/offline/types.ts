export type QueueKind =
  | "upsert"
  | "delete"
  | "upsert_mymeal"
  | "delete_mymeal"
  | "update_user_profile"
  | "upload_user_avatar"
  | "smart_memory_candidate_upsert"
  | "smart_memory_item_edit"
  | "smart_memory_item_mute"
  | "smart_memory_item_restore"
  | "smart_memory_item_delete"
  | "smart_memory_item_source_deleted"
  | "smart_memory_settings_disable"
  | "smart_memory_settings_enable";

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
  image_ref?: string | null;
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

export type SmartMemoryItemRow = {
  memory_item_id: string;
  user_uid: string;
  memory_type: string;
  state: string;
  projection_state: string;
  suggestion_use: string;
  payload: string;
  server_revision: number;
  updated_at: string;
  last_synced_at: number;
  sync_state: string;
  pending_operation: string | null;
  pending_client_mutation_id: string | null;
  pending_updated_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
};

export type SmartMemoryCandidateRow = {
  candidate_id: string;
  user_uid: string;
  memory_type: string;
  state: string;
  projection_state: string;
  suggestion_use: string;
  payload: string;
  server_revision: number;
  updated_at: string;
  last_synced_at: number;
  sync_state: string;
  pending_operation: string | null;
  pending_client_mutation_id: string | null;
  pending_updated_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
};

export type SmartMemorySettingsRow = {
  user_uid: string;
  enabled: number;
  projection_state: string;
  suggestion_use: string;
  payload: string;
  server_revision: number;
  updated_at: string;
  last_synced_at: number;
  sync_state: string;
  pending_operation: string | null;
  pending_client_mutation_id: string | null;
  pending_updated_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
};

export type IngredientProductSearchCacheRow = {
  user_uid: string;
  normalized_query: string;
  ingredient_product_id: string;
  result_rank: number;
  display_name: string;
  payload: string;
  query_echo: string;
  cache_policy: string;
  warnings: string;
  cache_state: string | null;
  cached_at: number;
  expires_at: number;
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
