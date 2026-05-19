import {
  Modal as RNModal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { KeyboardAwareScrollView } from "@/components/KeyboardAwareScrollView";
import { IngredientEditor } from "@/components/IngredientEditor";
import { useTheme } from "@/theme/useTheme";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import type { Ingredient } from "@/types/meal";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IngredientEditorModalProps = {
  visible: boolean;
  ingredientDraft: Ingredient | null;
  editingIngredientIndex: number | null;
  onClose: () => void;
  onCommit: (updated: Ingredient) => void;
  onDelete: () => void;
};

export default function IngredientEditorModal({
  visible,
  ingredientDraft,
  editingIngredientIndex,
  onClose,
  onCommit,
  onDelete,
}: IngredientEditorModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const { height: windowHeight } = useWindowDimensions();
  const { t } = useTranslation(["meals", "common"]);
  const styles = createStyles(theme);
  const sheetDefaultMaxHeight = windowHeight * 0.76;
  const sheetAvailableHeight =
    windowHeight - insets.top - theme.spacing.md - keyboardInset;
  const sheetMaxHeight = Math.max(
    320,
    Math.min(sheetDefaultMaxHeight, sheetAvailableHeight),
  );

  return (
    <RNModal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("close_ingredient_editor", {
            ns: "meals",
            defaultValue: "Close ingredient editor",
          })}
        />
        <View
          testID="ingredient-editor-sheet"
          style={[
            styles.sheet,
            styles.ingredientSheet,
            {
              marginBottom: keyboardInset,
              paddingBottom: theme.spacing.xl + insets.bottom,
              maxHeight: sheetMaxHeight,
            },
          ]}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>
            {t(
              editingIngredientIndex === null
                ? "review_meal_edit_add_ingredient"
                : "review_meal_edit_ingredient_title",
              {
                ns: "meals",
                defaultValue:
                  editingIngredientIndex === null
                    ? "Add ingredient"
                    : "Edit ingredient",
              },
            )}
          </Text>
          {ingredientDraft ? (
            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.ingredientEditorContent}
            >
              <IngredientEditor
                testIDPrefix="ingredient-editor"
                key={ingredientDraft.id}
                initial={ingredientDraft}
                variant="sheet"
                submitLabel={t(
                  editingIngredientIndex === null
                    ? "add_ingredient"
                    : "save_changes",
                  {
                    ns: editingIngredientIndex === null ? "meals" : "common",
                    defaultValue:
                      editingIngredientIndex === null
                        ? "Add ingredient"
                        : "Save changes",
                  },
                )}
                showDelete={editingIngredientIndex !== null}
                onCommit={onCommit}
                onCancel={onClose}
                onDelete={onDelete}
              />
            </KeyboardAwareScrollView>
          ) : null}
        </View>
      </View>
    </RNModal>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    sheetOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "flex-end",
    },
    sheetBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.isDark
        ? "rgba(0, 0, 0, 0.48)"
        : "rgba(47, 49, 43, 0.42)",
    },
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: theme.rounded.xxl,
      borderTopRightRadius: theme.rounded.xxl,
      paddingTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.bottomSheetPadding,
      gap: theme.spacing.sm,
      shadowColor: theme.shadow,
      shadowOpacity: theme.isDark ? 0.4 : 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: -6 },
      elevation: 12,
    },
    ingredientSheet: {
      maxHeight: "76%",
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: theme.rounded.full,
      backgroundColor: theme.borderSoft,
      alignSelf: "center",
    },
    sheetTitle: {
      color: theme.text,
      fontSize: 20,
      lineHeight: 26,
      fontFamily: theme.typography.fontFamily.semiBold,
      textAlign: "center",
    },
    ingredientEditorContent: {
      paddingBottom: theme.spacing.sm,
    },
  });
