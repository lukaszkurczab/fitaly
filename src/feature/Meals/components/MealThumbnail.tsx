import { useEffect, useState } from "react";
import * as FileSystem from "@/services/core/fileSystem";
import type { Meal } from "@/types/meal";
import { FallbackImage } from "@/feature/History/components/FallbackImage";
import { ensureLocalMealPhoto } from "@/services/meals/mealService.images";

type MealThumbnailProps = {
  meal: Meal;
  size: number;
  borderRadius: number;
  placeholderLabel?: string;
  showPlaceholderIcon?: boolean;
};

export function MealThumbnail({
  meal,
  size,
  borderRadius,
}: MealThumbnailProps) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const mealId = meal.cloudId || meal.mealId || "";

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!mealId || !meal.userUid) return;

      const directLocal =
        meal.photoLocalPath || meal.localPhotoUrl || meal.photoUrl || "";

      if (
        directLocal &&
        (directLocal.startsWith("file://") ||
          directLocal.startsWith("content://"))
      ) {
        try {
          const info = await FileSystem.getInfoAsync(directLocal);
          if (info.exists) {
            if (!cancelled) setLocalUri(directLocal);
            return;
          }
        } catch {
          // Ignore and fall back to repository resolution.
        }
      }

      const resolvedLocal = await ensureLocalMealPhoto({
        uid: meal.userUid,
        cloudId: meal.cloudId ?? null,
        imageId: meal.imageId ?? null,
        photoUrl: meal.photoUrl ?? null,
      });

      if (!cancelled) {
        setLocalUri(resolvedLocal);
      }
    }

    void restore();

    return () => {
      cancelled = true;
    };
  }, [
    meal.cloudId,
    meal.imageId,
    meal.localPhotoUrl,
    meal.mealId,
    meal.photoLocalPath,
    meal.photoUrl,
    meal.userUid,
    mealId,
  ]);

  const imageUri =
    localUri ||
    meal.photoLocalPath ||
    meal.localPhotoUrl ||
    meal.photoUrl ||
    null;

  useEffect(() => {
    setImageError(false);
  }, [imageUri]);

  if (imageUri && !imageError) {
    return (
      <FallbackImage
        uri={imageUri}
        width={size}
        height={size}
        borderRadius={borderRadius}
        onError={() => setImageError(true)}
      />
    );
  }

  return null;
}
