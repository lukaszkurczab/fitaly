import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import MapMealAddScreens, {
  type MealAddFlowApi,
  type MealAddScreenName,
  type MealAddStepParams,
} from "../feature/MapMealAddScreens";

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
      return { name: "EditMealDetails", params: {} };
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

  useEffect(() => {
    setStack([initialStep]);
  }, [initialStep]);

  const goTo = useCallback<MealAddFlowApi["goTo"]>((name, params) => {
    setStack((prev) => [...prev, createStep(name, params)]);
  }, []);

  const replace = useCallback<MealAddFlowApi["replace"]>((name, params) => {
    setStack((prev) => {
      const next = [...prev];
      next[next.length - 1] = createStep(name, params);
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    setStack((prev) => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  const canGoBack = useCallback(() => stack.length > 1, [stack.length]);

  const flow: MealAddFlowApi = useMemo(
    () => ({
      goTo,
      goBack,
      replace,
      canGoBack,
    }),
    [goTo, goBack, replace, canGoBack],
  );

  const current = stack[stack.length - 1];

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
