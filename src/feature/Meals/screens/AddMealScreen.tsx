import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useMealDraftContext } from "@contexts/MealDraftContext";
import MapMealAddScreens, {
  type MealAddFlowApi,
  type MealAddScreenName,
  type MealAddStepParams,
} from "../feature/MapMealAddScreens";
import {
  resolveMealAddFlowPath,
  resolveMealAddFlowProgress,
  type MealAddFlowPath,
} from "@/feature/Meals/utils/mealAddFlowProgress";

type Step<N extends MealAddScreenName = MealAddScreenName> = {
  name: N;
  params: MealAddStepParams[N];
};

type AddMealNavigationProp = StackNavigationProp<RootStackParamList, "AddMeal">;
type AddMealRouteProp = RouteProp<RootStackParamList, "AddMeal">;

const createStep = <N extends MealAddScreenName>(
  name: N,
  params?: MealAddStepParams[N]
): Step<N> => ({
  name,
  params: params ?? ({} as MealAddStepParams[N]),
});

export default function AddMealScreen() {
  const navigation = useNavigation<AddMealNavigationProp>();
  const route = useRoute<AddMealRouteProp>();
  const { meal } = useMealDraftContext();

  const initialStep: Step = useMemo(() => {
    const p = (route.params ?? {}) as NonNullable<RootStackParamList["AddMeal"]>;
    const start = typeof p.start === "string" ? p.start : "CameraDefault";

    if (start === "CameraDefault") {
      return {
        name: "CameraDefault",
        params: {
          id: p.id,
          skipDetection: !!p.skipDetection,
          attempt: typeof p.attempt === "number" ? p.attempt : 1,
          fullscreenPreferred:
            p.fullscreenPreferred === true ? true : undefined,
        },
      };
    }

    if (start === "BarcodeScan") {
      return {
        name: "BarcodeScan",
        params: {
          code: p.code,
          showManualEntry: !!p.showManualEntry,
        },
      };
    }

    if (start === "DescribeMeal") {
      return { name: "DescribeMeal", params: {} };
    }

    if (start === "ReviewMeal") {
      return { name: "ReviewMeal", params: {} };
    }

    if (start === "EditMealDetails") {
      return {
        name: "EditMealDetails",
        params: {
          submitIntent: p.submitIntent ?? "replaceReview",
        },
      };
    }

    if (start === "SelectSavedMeal") {
      return { name: "SelectSavedMeal", params: {} };
    }

    return {
      name: "CameraDefault",
      params: {
        id: p.id,
        skipDetection: !!p.skipDetection,
        attempt: typeof p.attempt === "number" ? p.attempt : 1,
        fullscreenPreferred:
          p.fullscreenPreferred === true ? true : undefined,
      },
    };
  }, [route.params]);

  const [stack, setStack] = useState<Step[]>([initialStep]);
  const [flowPath, setFlowPath] = useState<MealAddFlowPath>(() =>
    resolveMealAddFlowPath(initialStep.name, meal?.inputMethod),
  );

  useEffect(() => {
    setStack([initialStep]);
    setFlowPath(resolveMealAddFlowPath(initialStep.name));
  }, [initialStep]);

  useEffect(() => {
    if (
      initialStep.name !== "ReviewMeal" &&
      initialStep.name !== "EditMealDetails"
    ) {
      return;
    }
    setFlowPath(resolveMealAddFlowPath(initialStep.name, meal?.inputMethod));
  }, [initialStep.name, meal?.inputMethod]);

  const goTo = useCallback<MealAddFlowApi["goTo"]>((name, params) => {
    setFlowPath((currentPath) =>
      name === "ReviewMeal"
        ? currentPath
        : resolveMealAddFlowPath(name, meal?.inputMethod),
    );
    setStack((prev) => [...prev, createStep(name, params)]);
  }, [meal?.inputMethod]);

  const replace = useCallback<MealAddFlowApi["replace"]>((name, params) => {
    setFlowPath((currentPath) =>
      name === "ReviewMeal"
        ? currentPath
        : resolveMealAddFlowPath(name, meal?.inputMethod),
    );
    setStack((prev) => {
      const next = [...prev];
      next[next.length - 1] = createStep(name, params);
      return next;
    });
  }, [meal?.inputMethod]);

  const goBack = useCallback(() => {
    setStack((prev) => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  const canGoBack = useCallback(() => stack.length > 1, [stack.length]);
  const goBackOrExit = useCallback(() => {
    if (stack.length > 1) {
      goBack();
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("Home");
  }, [goBack, navigation, stack.length]);

  const current = stack[stack.length - 1];
  const progress = useMemo(
    () => resolveMealAddFlowProgress(flowPath, current.name),
    [current.name, flowPath],
  );

  const flow: MealAddFlowApi = useMemo(
    () => ({
      goTo,
      goBack,
      replace,
      canGoBack,
      goBackOrExit,
      progress,
    }),
    [goTo, goBack, replace, canGoBack, goBackOrExit, progress],
  );

  useEffect(() => {
    const usesParentHardwareBack =
      current.name === "TextAnalyzing" ||
      current.name === "PreparingReviewPhoto" ||
      current.name === "IngredientsNotRecognized";
    if (!usesParentHardwareBack) return;

    const onBackPress = () => {
      if (stack.length > 1) {
        goBack();
        return true;
      }
      navigation.goBack();
      return true;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [current.name, goBack, navigation, stack.length]);

  useEffect(() => {
    const usesParentBeforeRemove =
      current.name === "TextAnalyzing" ||
      current.name === "PreparingReviewPhoto" ||
      current.name === "IngredientsNotRecognized";
    if (!usesParentBeforeRemove) return;

    const sub = navigation.addListener("beforeRemove", (e) => {
      if (stack.length <= 1) return;

      const actionType = e.data.action.type;
      const isBackAction =
        actionType === "GO_BACK" ||
        actionType === "POP" ||
        actionType === "POP_TO_TOP";

      if (!isBackAction) return;

      e.preventDefault();
      goBack();
    });

    return sub;
  }, [current.name, goBack, navigation, stack.length]);
  const Screen = MapMealAddScreens(current.name);

  return (
    <Screen
      navigation={navigation}
      flow={flow}
      params={current.params as never}
    />
  );
}
