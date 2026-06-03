import React, {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  DeviceEventEmitter,
  Pressable,
  Keyboard,
} from "react-native";
import { useTheme } from "@/theme/useTheme";
import { useTranslation } from "react-i18next";
import type { Ingredient } from "@/types";
import { NumberInput } from "./NumberInput";
import { TextInput } from "./TextInput";
import { Button } from "./Button";
import { Modal as AppModal } from "./Modal";

type Props = {
  initial: Ingredient;
  onCommit: (i: Ingredient) => void;
  onCancel: () => void;
  onDelete: () => void;
  onChangePartial?: (patch: Partial<Ingredient>) => void;
  errors?: Partial<Record<keyof Ingredient, string>>;
  variant?: "default" | "sheet";
  submitLabel?: string;
  showDelete?: boolean;
  testIDPrefix?: string;
  showSheetActions?: boolean;
};

const parseNum = (v: string) => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

type NumericIngredientKey = "amount" | "protein" | "carbs" | "fat" | "kcal";

const AMOUNT_MAX_DECIMALS = 1;

export type IngredientEditorHandle = {
  submit: () => void;
};

const IngredientEditorComponent = (
  {
    initial,
    onCommit,
    onCancel,
    onDelete,
    onChangePartial,
    errors = {},
    variant = "default",
    submitLabel,
    showDelete = true,
    testIDPrefix = "ingredient-editor",
    showSheetActions = true,
  }: Props,
  ref: React.ForwardedRef<IngredientEditorHandle>,
) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["meals", "common"]);
  const unitLabel = initial?.unit === "ml" ? "ml" : "g";
  const isSheetVariant = variant === "sheet";
  const requiresMacroEstimate = isSheetVariant && !showDelete;

  const [name, setName] = useState(initial.name ?? "");
  const [amount, setAmount] = useState(String(initial.amount ?? 0));
  const [protein, setProtein] = useState(String(initial.protein ?? 0));
  const [carbs, setCarbs] = useState(String(initial.carbs ?? 0));
  const [fat, setFat] = useState(String(initial.fat ?? 0));
  const [kcal, setKcal] = useState(String(initial.kcal ?? 0));
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [nameTouched, setNameTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);

  const baseline = useRef({
    amount: Number(initial.amount ?? 0),
    protein: Number(initial.protein ?? 0),
    carbs: Number(initial.carbs ?? 0),
    fat: Number(initial.fat ?? 0),
    kcal: Number(initial.kcal ?? 0),
  });

  const [recalcPromptVisible, setRecalcPromptVisible] = useState(false);

  const hasBlockingErrors = Object.keys(errors).length > 0;
  const resolvedSubmitLabel =
    submitLabel ?? t("save_changes", { ns: "common" });
  const hasMacroEstimate =
    Math.abs(parseNum(protein) || 0) > 0.0001 ||
    Math.abs(parseNum(carbs) || 0) > 0.0001 ||
    Math.abs(parseNum(fat) || 0) > 0.0001;
  const macroRequirementError =
    requiresMacroEstimate && submitAttempted && !hasMacroEstimate
      ? t("review_meal_edit_ingredient_macro_required", {
          ns: "meals",
          defaultValue: "Add an approximate protein, carbs or fat value.",
        })
      : null;

  const syncBaselineFromState = (keepAmount = true) => {
    const amt = keepAmount ? baseline.current.amount : parseNum(amount) || 0;
    const p = parseNum(protein);
    const c = parseNum(carbs);
    const f = parseNum(fat);
    const k = parseNum(kcal);

    baseline.current = {
      amount: Number.isFinite(amt) ? amt : 0,
      protein: Number.isFinite(p) ? p : baseline.current.protein,
      carbs: Number.isFinite(c) ? c : baseline.current.carbs,
      fat: Number.isFinite(f) ? f : baseline.current.fat,
      kcal: Number.isFinite(k) ? k : baseline.current.kcal,
    };
  };

  useEffect(() => {
    syncBaselineFromState(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buildIngredientForCommit = (options?: {
    recalculateMacros?: boolean;
  }): Ingredient => {
    const nextAmount = parseNum(amount) || 0;
    const currentProtein = parseNum(protein) || 0;
    const currentCarbs = parseNum(carbs) || 0;
    const currentFat = parseNum(fat) || 0;
    const currentKcal = parseNum(kcal) || 0;
    const ratio =
      options?.recalculateMacros &&
      baseline.current.amount > 0 &&
      nextAmount > 0
        ? nextAmount / baseline.current.amount
        : 1;

    const nextProtein = Number((currentProtein * ratio).toFixed(1));
    const nextCarbs = Number((currentCarbs * ratio).toFixed(1));
    const nextFat = Number((currentFat * ratio).toFixed(1));
    const kcalFromMacros = Math.round(
      nextProtein * 4 + nextCarbs * 4 + nextFat * 9,
    );
    const nextKcal = options?.recalculateMacros
      ? Math.round(currentKcal * ratio) || kcalFromMacros
      : isSheetVariant && currentKcal <= 0 && kcalFromMacros > 0
        ? kcalFromMacros
        : currentKcal;

    return {
      id: initial.id,
      name: name.trim(),
      amount: nextAmount,
      unit: initial.unit,
      protein: nextProtein,
      carbs: nextCarbs,
      fat: nextFat,
      kcal: nextKcal,
    };
  };

  const shouldAskForRecalc = (amountOverride?: number) => {
    const prevAmount = baseline.current.amount;
    const nextAmount = amountOverride ?? (parseNum(amount) || 0);
    const hasMacros =
      Math.abs(parseNum(protein) || 0) > 0.0001 ||
      Math.abs(parseNum(carbs) || 0) > 0.0001 ||
      Math.abs(parseNum(fat) || 0) > 0.0001 ||
      Math.abs(parseNum(kcal) || 0) > 0.0001;

    return (
      prevAmount > 0 &&
      nextAmount > 0 &&
      hasMacros &&
      Math.abs(nextAmount - prevAmount) > 0.0001
    );
  };

  const commitIngredient = (options?: { recalculateMacros?: boolean }) => {
    const next = buildIngredientForCommit(options);
    if (options?.recalculateMacros) {
      setProtein(String(next.protein));
      setCarbs(String(next.carbs));
      setFat(String(next.fat));
      setKcal(String(next.kcal));
      onChangePartial?.({
        protein: next.protein,
        carbs: next.carbs,
        fat: next.fat,
        kcal: next.kcal,
      });
    }
    setRecalcPromptVisible(false);
    onCommit(next);
  };

  const commit = () => {
    if (hasBlockingErrors) return;
    if (requiresMacroEstimate && !hasMacroEstimate) {
      setSubmitAttempted(true);
      return;
    }

    commitIngredient();
  };

  useImperativeHandle(ref, () => ({
    submit: commit,
  }));

  const applyAmountRecalcChoice = (recalculateMacros: boolean) => {
    const next = buildIngredientForCommit({ recalculateMacros });
    if (recalculateMacros) {
      setProtein(String(next.protein));
      setCarbs(String(next.carbs));
      setFat(String(next.fat));
      setKcal(String(next.kcal));
      onChangePartial?.({
        protein: next.protein,
        carbs: next.carbs,
        fat: next.fat,
        kcal: next.kcal,
      });
    }
    baseline.current = {
      amount: next.amount,
      protein: next.protein,
      carbs: next.carbs,
      fat: next.fat,
      kcal: next.kcal,
    };
    setRecalcPromptVisible(false);
  };

  const clearZeroOnFocus = (val: string, setter: (s: string) => void) => {
    if (val === "0" || val === "0.0" || val === "0,0") setter("");
  };

  const applyNumericPartial = (key: NumericIngredientKey, value: number) => {
    switch (key) {
      case "amount":
        onChangePartial?.({ amount: value });
        break;
      case "protein":
        onChangePartial?.({ protein: value });
        break;
      case "carbs":
        onChangePartial?.({ carbs: value });
        break;
      case "fat":
        onChangePartial?.({ fat: value });
        break;
      case "kcal":
        onChangePartial?.({ kcal: value });
        break;
    }
  };

  const getNumericMaxDecimals = (key: NumericIngredientKey) =>
    key === "amount" ? AMOUNT_MAX_DECIMALS : undefined;

  const handleNumericChange = (
    value: string,
    setter: (value: string) => void,
    key: NumericIngredientKey,
  ) => {
    if (recalcPromptVisible) setRecalcPromptVisible(false);
    setter(value);
    const numeric = parseNum(value);
    if (!Number.isNaN(numeric)) {
      applyNumericPartial(key, numeric);
    }
  };

  const handleNumericBlur = (
    key: NumericIngredientKey,
    normalizedValue: string,
  ) => {
    const n = parseNum(normalizedValue);
    if (!Number.isNaN(n)) applyNumericPartial(key, n);

    if (key === "amount") {
      const nextAmt = Number.isFinite(n) ? n : 0;
      if (Math.abs(nextAmt - baseline.current.amount) <= 0.0001) {
        baseline.current.amount = nextAmt;
      } else if (shouldAskForRecalc(nextAmt)) {
        setRecalcPromptVisible(true);
      } else {
        baseline.current.amount = nextAmt;
      }
      return;
    }

    const num = Number.isFinite(n) ? n : 0;
    if (key === "protein") baseline.current.protein = num;
    if (key === "carbs") baseline.current.carbs = num;
    if (key === "fat") baseline.current.fat = num;
    if (key === "kcal") baseline.current.kcal = num;
  };

  const normalizeOnBlurName = (val: string) => {
    const next = val.trim();
    setName(next);
    onChangePartial?.({ name: next });
  };

  const renderSheetActions = () => (
    <View style={styles.sheetActions}>
      <Button
        testID={`${testIDPrefix}-cancel-button`}
        variant="secondary"
        style={styles.sheetActionButton}
        fullWidth={false}
        onPress={onCancel}
        label={t("cancel", { ns: "common" })}
      />

      <Button
        testID={`${testIDPrefix}-submit-button`}
        style={styles.sheetActionButton}
        fullWidth={false}
        onPress={commit}
        disabled={hasBlockingErrors}
        label={resolvedSubmitLabel}
      />
    </View>
  );

  const renderSheetNutrition = () => (
    <View
      style={styles.nutritionPanel}
      testID={`${testIDPrefix}-nutrition-section`}
    >
      <View style={styles.nutritionHeader}>
        <Text style={styles.nutritionTitle}>
          {t("review_meal_edit_ingredient_nutrition_prompt", {
            ns: "meals",
            defaultValue: "Macro estimate",
          })}
        </Text>
        <Text style={styles.nutritionSummary}>
          {t("review_meal_edit_ingredient_nutrition_hint", {
            ns: "meals",
            defaultValue: "Approximate protein, carbs or fat is enough.",
          })}
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <View style={styles.row}>
          <View style={styles.fieldColumn}>
            <NumberInput
              testID={`${testIDPrefix}-kcal-input`}
              style={styles.sheetFieldContainer}
              fieldStyle={[
                styles.sheetField,
                errors.kcal ? styles.inputError : null,
              ]}
              label={t("calories", { ns: "meals" })}
              rightLabel="kcal"
              value={kcal}
              onChangeText={(v) => handleNumericChange(v, setKcal, "kcal")}
              blurFallback="0"
              onFocus={() => clearZeroOnFocus(kcal, setKcal)}
              onBlur={(normalizedValue) =>
                handleNumericBlur("kcal", normalizedValue)
              }
            />
            {errors.kcal ? (
              <Text style={styles.errText}>{errors.kcal}</Text>
            ) : null}
          </View>

          <View style={styles.fieldColumn}>
            <NumberInput
              testID={`${testIDPrefix}-protein-input`}
              style={styles.sheetFieldContainer}
              fieldStyle={[
                styles.sheetField,
                errors.protein ? styles.inputError : null,
              ]}
              label={t("protein", { ns: "meals" })}
              rightLabel="g"
              value={protein}
              onChangeText={(v) => handleNumericChange(v, setProtein, "protein")}
              blurFallback="0"
              onFocus={() => clearZeroOnFocus(protein, setProtein)}
              onBlur={(normalizedValue) =>
                handleNumericBlur("protein", normalizedValue)
              }
            />
            {errors.protein ? (
              <Text style={styles.errText}>{errors.protein}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.fieldColumn}>
            <NumberInput
              testID={`${testIDPrefix}-carbs-input`}
              style={styles.sheetFieldContainer}
              fieldStyle={[
                styles.sheetField,
                errors.carbs ? styles.inputError : null,
              ]}
              label={t("carbs", { ns: "meals" })}
              rightLabel="g"
              value={carbs}
              onChangeText={(v) => handleNumericChange(v, setCarbs, "carbs")}
              blurFallback="0"
              onFocus={() => clearZeroOnFocus(carbs, setCarbs)}
              onBlur={(normalizedValue) =>
                handleNumericBlur("carbs", normalizedValue)
              }
            />
            {errors.carbs ? (
              <Text style={styles.errText}>{errors.carbs}</Text>
            ) : null}
          </View>

          <View style={styles.fieldColumn}>
            <NumberInput
              testID={`${testIDPrefix}-fat-input`}
              style={styles.sheetFieldContainer}
              fieldStyle={[
                styles.sheetField,
                errors.fat ? styles.inputError : null,
              ]}
              label={t("fat", { ns: "meals" })}
              rightLabel="g"
              value={fat}
              onChangeText={(v) => handleNumericChange(v, setFat, "fat")}
              blurFallback="0"
              onFocus={() => clearZeroOnFocus(fat, setFat)}
              onBlur={(normalizedValue) =>
                handleNumericBlur("fat", normalizedValue)
              }
            />
            {errors.fat ? (
              <Text style={styles.errText}>{errors.fat}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {macroRequirementError ? (
        <Text
          testID={`${testIDPrefix}-macro-error`}
          style={styles.errText}
        >
          {macroRequirementError}
        </Text>
      ) : null}
    </View>
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      "barcode.scanned.ingredient",
      (payload: { ingredient: Ingredient }) => {
        const ing = payload?.ingredient;
        if (!ing) return;

        setName(ing.name || "");
        setAmount(String(ing.amount ?? 100));
        setProtein(String(ing.protein ?? 0));
        setCarbs(String(ing.carbs ?? 0));
        setFat(String(ing.fat ?? 0));
        setKcal(String(ing.kcal ?? 0));
        setRecalcPromptVisible(false);

        onChangePartial?.({
          name: ing.name || "",
          amount: ing.amount ?? 100,
          protein: ing.protein ?? 0,
          carbs: ing.carbs ?? 0,
          fat: ing.fat ?? 0,
          kcal: ing.kcal ?? 0,
        });

        baseline.current = {
          amount: Number(ing.amount ?? 100),
          protein: Number(ing.protein ?? 0),
          carbs: Number(ing.carbs ?? 0),
          fat: Number(ing.fat ?? 0),
          kcal: Number(ing.kcal ?? 0),
        };
      },
    );

    return () => sub.remove();
  }, [onChangePartial]);

  return (
    <View
      style={[styles.box, isSheetVariant ? styles.sheetBox : null]}
      testID={`${testIDPrefix}-root`}
    >
      <View style={isSheetVariant ? styles.fieldGroup : undefined}>
        <TextInput
          testID={`${testIDPrefix}-name-input`}
          style={isSheetVariant ? styles.sheetFieldContainer : styles.nameField}
          fieldStyle={isSheetVariant ? styles.sheetField : undefined}
          label={
            isSheetVariant ? t("ingredient_name", { ns: "meals" }) : undefined
          }
          value={name}
          onChangeText={(v) => {
            setName(v);
            onChangePartial?.({ name: v });
          }}
          placeholder={t("ingredient_name", { ns: "meals" })}
          onBlur={() => {
            setNameTouched(true);
            normalizeOnBlurName(name);
          }}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
        />

        {errors.name && nameTouched ? (
          <Text style={styles.errText}>{errors.name}</Text>
        ) : null}

        {isSheetVariant ? (
          <View style={styles.fieldColumn}>
            <NumberInput
              testID={`${testIDPrefix}-amount-input`}
              style={styles.sheetFieldContainer}
              fieldStyle={[
                styles.sheetField,
                errors.amount && amountTouched ? styles.inputError : null,
              ]}
              label={t("amount", { ns: "meals" }).replace("[g]", "").trim()}
              rightLabel={unitLabel}
              value={amount}
              onChangeText={(v) => handleNumericChange(v, setAmount, "amount")}
              maxDecimals={getNumericMaxDecimals("amount")}
              blurFallback="0"
              onFocus={() => clearZeroOnFocus(amount, setAmount)}
              onBlur={(normalizedValue) => {
                setAmountTouched(true);
                handleNumericBlur("amount", normalizedValue);
              }}
            />
            {errors.amount && amountTouched ? (
              <Text style={styles.errText}>{errors.amount}</Text>
            ) : null}
          </View>
        ) : (
          <>
            <Text style={styles.editLabel}>
              {String(t("amount", { ns: "meals" })).replace(
                "[g]",
                `[${unitLabel}]`,
              )}
            </Text>
            <NumberInput
              testID={`${testIDPrefix}-amount-input`}
              fieldStyle={[
                errors.amount && amountTouched ? styles.inputError : null,
              ]}
              value={amount}
              onChangeText={(v) => handleNumericChange(v, setAmount, "amount")}
              maxDecimals={getNumericMaxDecimals("amount")}
              blurFallback="0"
              onFocus={() => clearZeroOnFocus(amount, setAmount)}
              onBlur={(normalizedValue) => {
                setAmountTouched(true);
                handleNumericBlur("amount", normalizedValue);
              }}
            />
            {errors.amount && amountTouched ? (
              <Text style={styles.errText}>{errors.amount}</Text>
            ) : null}
          </>
        )}
      </View>

      {isSheetVariant ? (
        renderSheetNutrition()
      ) : (
        <>
          <Text style={styles.editLabel}>{t("protein", { ns: "meals" })} [g]</Text>
          <NumberInput
            testID={`${testIDPrefix}-protein-input`}
            fieldStyle={[
              styles.macroProteinField,
              errors.protein ? styles.inputError : null,
            ]}
            value={protein}
            onChangeText={(v) => handleNumericChange(v, setProtein, "protein")}
            blurFallback="0"
            onFocus={() => clearZeroOnFocus(protein, setProtein)}
            onBlur={(normalizedValue) =>
              handleNumericBlur("protein", normalizedValue)
            }
          />

          {errors.protein ? (
            <Text style={styles.errText}>{errors.protein}</Text>
          ) : null}

          <Text style={styles.editLabel}>{t("carbs", { ns: "meals" })} [g]</Text>
          <NumberInput
            testID={`${testIDPrefix}-carbs-input`}
            fieldStyle={[
              styles.macroCarbsField,
              errors.carbs ? styles.inputError : null,
            ]}
            value={carbs}
            onChangeText={(v) => handleNumericChange(v, setCarbs, "carbs")}
            blurFallback="0"
            onFocus={() => clearZeroOnFocus(carbs, setCarbs)}
            onBlur={(normalizedValue) =>
              handleNumericBlur("carbs", normalizedValue)
            }
          />

          {errors.carbs ? <Text style={styles.errText}>{errors.carbs}</Text> : null}

          <Text style={styles.editLabel}>{t("fat", { ns: "meals" })} [g]</Text>
          <NumberInput
            testID={`${testIDPrefix}-fat-input`}
            fieldStyle={[
              styles.macroFatField,
              errors.fat ? styles.inputError : null,
            ]}
            value={fat}
            onChangeText={(v) => handleNumericChange(v, setFat, "fat")}
            blurFallback="0"
            onFocus={() => clearZeroOnFocus(fat, setFat)}
            onBlur={(normalizedValue) =>
              handleNumericBlur("fat", normalizedValue)
            }
          />

          {errors.fat ? <Text style={styles.errText}>{errors.fat}</Text> : null}

          <Text style={styles.editLabel}>
            {t("calories", { ns: "meals" })} [kcal]
          </Text>
          <NumberInput
            testID={`${testIDPrefix}-kcal-input`}
            value={kcal}
            onChangeText={(v) => handleNumericChange(v, setKcal, "kcal")}
            blurFallback="0"
            onFocus={() => clearZeroOnFocus(kcal, setKcal)}
            onBlur={(normalizedValue) => handleNumericBlur("kcal", normalizedValue)}
          />

          {errors.kcal ? <Text style={styles.errText}>{errors.kcal}</Text> : null}
        </>
      )}

      {isSheetVariant ? (
        showSheetActions ? renderSheetActions() : null
      ) : (
        <>
          <Button
            testID={`${testIDPrefix}-submit-button`}
            style={styles.primaryBtn}
            onPress={commit}
            disabled={hasBlockingErrors}
            label={resolvedSubmitLabel}
          />

          <Button
            testID={`${testIDPrefix}-cancel-button`}
            variant="destructive"
            style={styles.cancelBtn}
            onPress={onCancel}
            label={t("cancel", { ns: "common" })}
          />
        </>
      )}

      {showDelete ? (
        <Pressable
          testID={`${testIDPrefix}-delete-button`}
          onPress={onDelete}
          style={styles.deleteLink}
        >
          <Text style={styles.deleteLinkText}>
            {t("review_meal_edit_remove_ingredient", {
              ns: "meals",
              defaultValue: t("remove", {
                ns: "common",
                defaultValue: "Remove",
              }),
            })}
          </Text>
        </Pressable>
      ) : null}

      <AppModal
        testID={`${testIDPrefix}-recalc-modal`}
        visible={recalcPromptVisible}
        title={t("recalc_title", {
          ns: "meals",
          defaultValue: "Recalculate values?",
        })}
        message={t("recalc_message", {
          ns: "meals",
          defaultValue:
            "Adjust protein, carbs, fat and kcal proportionally to the new amount?",
        })}
        primaryAction={{
          testID: `${testIDPrefix}-recalc-confirm-button`,
          label: t("recalc_confirm", {
            ns: "meals",
            defaultValue: "Recalculate now",
          }),
          onPress: () => applyAmountRecalcChoice(true),
        }}
        secondaryAction={{
          testID: `${testIDPrefix}-recalc-keep-button`,
          label: t("recalc_keep_values", {
            ns: "meals",
            defaultValue: "Keep macros",
          }),
          onPress: () => applyAmountRecalcChoice(false),
          tone: "secondary",
        }}
        onClose={() => setRecalcPromptVisible(false)}
      />
    </View>
  );
};

export const IngredientEditor = React.forwardRef(IngredientEditorComponent);

IngredientEditor.displayName = "IngredientEditor";

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    box: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      borderRadius: theme.rounded.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    nameField: {
      marginBottom: theme.spacing.xs,
    },
    sheetBox: {
      borderWidth: 0,
      backgroundColor: "transparent",
      borderRadius: 0,
      padding: 0,
      marginBottom: 0,
      gap: theme.spacing.md,
    },
    fieldGroup: {
      gap: theme.spacing.xs,
    },
    row: {
      flexDirection: "row",
      gap: theme.spacing.xs,
    },
    fieldColumn: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs,
    },
    sheetFieldContainer: {
      flex: 1,
    },
    sheetField: {
      minHeight: 48,
      borderRadius: theme.rounded.md,
      borderColor: theme.input.border,
      backgroundColor: theme.input.background,
    },
    inputError: {
      borderColor: theme.input.borderError,
    },
    errText: {
      color: theme.error.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
      marginBottom: theme.spacing.sm,
    },
    primaryBtn: {
      marginTop: theme.spacing.sm,
    },
    cancelBtn: {
      marginTop: theme.spacing.sm,
    },
    editField: {
      borderWidth: 1,
      borderColor: theme.input.border,
      backgroundColor: theme.input.background,
      borderRadius: theme.rounded.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 0,
      paddingTop: 0,
      paddingBottom: 0,
      marginBottom: theme.spacing.sm,
      minHeight: 52,
    },
    editLabel: {
      marginBottom: theme.spacing.xs,
      color: theme.textSecondary,
      fontSize: theme.typography.size.labelL,
      lineHeight: theme.typography.lineHeight.labelL,
      fontFamily: theme.typography.fontFamily.medium,
    },
    macroProteinField: {
      backgroundColor: theme.macro.proteinSoft,
      borderColor: theme.macro.protein,
    },
    macroProteinInputText: {
      color: theme.macro.protein,
    },
    macroCarbsField: {
      backgroundColor: theme.macro.carbsSoft,
      borderColor: theme.macro.carbs,
    },
    macroCarbsInputText: {
      color: theme.macro.carbs,
    },
    macroFatField: {
      backgroundColor: theme.macro.fatSoft,
      borderColor: theme.macro.fat,
    },
    macroFatInputText: {
      color: theme.macro.fat,
    },
    deleteLink: {
      alignSelf: "center",
      marginTop: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
    },
    deleteLinkText: {
      color: theme.error.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.medium,
    },
    nutritionPanel: {
      gap: theme.spacing.sm,
    },
    nutritionHeader: {
      gap: 2,
    },
    nutritionTitle: {
      color: theme.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    nutritionSummary: {
      color: theme.textSecondary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
    },
    sheetActions: {
      flexDirection: "row",
      gap: theme.spacing.xs,
      marginTop: 0,
    },
    sheetActionButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
    },
  });
