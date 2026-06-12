export const MEDIA_ASSET_STATES = [
  "local_pending",
  "uploading",
  "uploaded",
  "attached",
  "failed",
  "dead_letter",
  "retryable",
  "discarded",
  "deleted",
] as const;

export const MEDIA_ASSET_SURFACES = [
  "meal_photo",
  "saved_meal_photo",
  "avatar",
  "feedback_attachment",
] as const;

export const MEDIA_ASSET_LIFECYCLE_OWNER = "media_asset_lifecycle" as const;

export const MEDIA_ASSET_LIFECYCLE_OWNED_FIELDS = [
  "localFilePath",
  "opId",
  "clientMutationId",
  "remoteStoragePath",
  "uploadAttempt",
  "uploadState",
  "retryState",
  "discardState",
  "deleteState",
  "deadLetterReason",
  "resolvedDownloadUrl",
] as const;

export type MediaAssetState = (typeof MEDIA_ASSET_STATES)[number];
export type MediaAssetSurface = (typeof MEDIA_ASSET_SURFACES)[number];
export type MediaAssetLifecycleOwner = typeof MEDIA_ASSET_LIFECYCLE_OWNER;

export const MEDIA_ASSET_DOMAIN_OWNER_BY_SURFACE = {
  meal_photo: "meal",
  saved_meal_photo: "saved_meal",
  avatar: "profile",
  feedback_attachment: "feedback",
} as const satisfies Record<MediaAssetSurface, string>;

export const MEDIA_ASSET_DOMAIN_OWNED_FIELDS_BY_SURFACE = {
  meal_photo: ["imageRef", "displayMetadata", "mealDomainMetadata"],
  saved_meal_photo: [
    "imageRef",
    "displayMetadata",
    "savedMealDomainMetadata",
  ],
  avatar: ["avatarRef", "displayMetadata", "profileDomainMetadata"],
  feedback_attachment: [
    "attachmentRef",
    "displayMetadata",
    "feedbackDomainMetadata",
  ],
} as const satisfies Record<MediaAssetSurface, readonly string[]>;

export const MEDIA_ASSET_DOMAIN_FORBIDDEN_LIFECYCLE_FIELDS =
  MEDIA_ASSET_LIFECYCLE_OWNED_FIELDS;
