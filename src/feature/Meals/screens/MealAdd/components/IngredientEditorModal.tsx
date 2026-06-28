import {
  Modal as RNModal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRef } from "react";
import LinearGradient from "react-native-linear-gradient";
import { useTranslation } from "react-i18next";
import { KeyboardAwareScrollView } from "@/components/KeyboardAwareScrollView";
import {
  IngredientEditor,
  type IngredientEditorHandle,
} from "@/components/IngredientEditor";
import { useTheme } from "@/theme/useTheme";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import type { Ingredient } from "@/types/meal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomActionBar } from "@/components/BottomActionBar";

type IngredientEditorModalProps = {
  visible: boolean;
  uid: string | null;
  locale?: string | null;
  ingredientDraft: Ingredient | null;
  editingIngredientIndex: number | null;
  onClose: () => void;
  onCommit: (updated: Ingredient) => void;
  onDelete: () => void;
};

export default function IngredientEditorModal({
  visible,
  uid,
  locale,
  ingredientDraft,
  editingIngredientIndex,
  onClose,
  onCommit,
  onDelete,
}: IngredientEditorModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset({ includeSafeArea: true });
  const { height: windowHeight } = useWindowDimensions();
  const { t } = useTranslation(["meals", "common"]);
  const styles = createStyles(theme);
  const editorRef = useRef<IngredientEditorHandle>(null);
  const isKeyboardVisible = keyboardInset > 0;
  const submitLabel = t(
    editingIngredientIndex === null
      ? "add_ingredient"
      : "review_meal_edit_save_ingredient",
    {
      ns: "meals",
      defaultValue:
        editingIngredientIndex === null
          ? "Add ingredient"
          : "Save ingredient",
    },
  );
  const compactSubmitLabel =
    editingIngredientIndex === null
      ? t("add_ingredient_compact", {
          ns: "meals",
          defaultValue: "Add",
        })
      : t("save", { ns: "common", defaultValue: "Save" });
  const sheetDefaultMaxHeight = windowHeight * (keyboardInset > 0 ? 0.64 : 0.7);
  const sheetAvailableHeight =
    windowHeight - insets.top - theme.spacing.md - keyboardInset;
  const sheetMaxHeight = Math.max(
    320,
    Math.min(sheetDefaultMaxHeight, sheetAvailableHeight),
  );
  const keyboardSheetOverlap = theme.spacing.lg;
  const keyboardSheetPadding = theme.spacing.xl + theme.spacing.xxs;

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
            isKeyboardVisible ? styles.ingredientSheetKeyboard : null,
            {
              marginBottom: isKeyboardVisible
                ? Math.max(0, keyboardInset - keyboardSheetOverlap)
                : 0,
              paddingBottom:
                isKeyboardVisible
                  ? keyboardSheetPadding
                  : theme.spacing.xl + insets.bottom,
              maxHeight: sheetMaxHeight,
            },
          ]}
        >
          <LinearGradient
            pointerEvents="none"
            colors={
              theme.isDark
                ? [
                    "rgba(255, 255, 255, 0.05)",
                    "rgba(126, 153, 120, 0.08)",
                    "rgba(0, 0, 0, 0)",
                  ]
                : [
                    "rgba(255, 255, 255, 0.98)",
                    "rgba(250, 247, 240, 0.9)",
                    "rgba(126, 153, 120, 0.1)",
                  ]
            }
            locations={[0, 0.56, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sheetGradient}
          />
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
          {!isKeyboardVisible ? (
            <Text style={styles.sheetSubtitle}>
              {t("review_meal_edit_ingredient_sheet_subtitle", {
                ns: "meals",
                defaultValue:
                  "Name, amount and approximate macros are enough.",
              })}
            </Text>
          ) : null}
          {ingredientDraft ? (
            <>
              <KeyboardAwareScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={[
                  styles.ingredientEditorContent,
                  isKeyboardVisible
                    ? styles.ingredientEditorContentKeyboard
                    : null,
                ]}
              >
                <IngredientEditor
                  ref={editorRef}
                  testIDPrefix="ingredient-editor"
                  key={ingredientDraft.id}
                  initial={ingredientDraft}
                  variant="sheet"
                  submitLabel={submitLabel}
                  showDelete={editingIngredientIndex !== null}
                  showSheetActions={false}
                  autocompleteUid={uid}
                  autocompleteLocale={locale ?? null}
                  onCommit={onCommit}
                  onCancel={onClose}
                  onDelete={onDelete}
                />
              </KeyboardAwareScrollView>
              <BottomActionBar
                placement="inline"
                horizontalPadding={0}
                bottomInset={0}
                compact={isKeyboardVisible}
                primaryAction={{
                  testID: "ingredient-editor-submit-button",
                  label: submitLabel,
                  compactLabel: compactSubmitLabel,
                  onPress: () => {
                    editorRef.current?.submit();
                  },
                }}
                secondaryAction={{
                  testID: "ingredient-editor-cancel-button",
                  label: t("cancel", { ns: "common" }),
                  variant: "secondary",
                  onPress: onClose,
                }}
                style={
                  isKeyboardVisible ? styles.ingredientActionBarKeyboard : null
                }
              />
            </>
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
      overflow: "hidden",
      backgroundColor: theme.surfaceElevated,
      borderTopLeftRadius: theme.rounded.xxl,
      borderTopRightRadius: theme.rounded.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.borderSoft,
      paddingTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
      ...theme.depth.modal,
    },
    sheetGradient: {
      ...StyleSheet.absoluteFillObject,
      borderTopLeftRadius: theme.rounded.xxl,
      borderTopRightRadius: theme.rounded.xxl,
    },
    ingredientSheet: {
      maxHeight: "70%",
    },
    ingredientSheetKeyboard: {
      gap: theme.spacing.xs,
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
      lineHeight: 25,
      fontFamily: theme.typography.fontFamily.semiBold,
      textAlign: "center",
    },
    sheetSubtitle: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      textAlign: "center",
      marginTop: -theme.spacing.xs,
      marginHorizontal: theme.spacing.sm,
    },
    ingredientEditorContent: {
      paddingBottom: theme.spacing.sm,
    },
    ingredientEditorContentKeyboard: {
      paddingBottom: 0,
    },
    ingredientActionBarKeyboard: {
      paddingTop: 0,
    },
  });
