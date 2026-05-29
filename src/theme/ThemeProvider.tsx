import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { themes } from "./themes";
import { spacing } from "./spacing";
import { rounded } from "./rounded";
import { typography } from "./typography";

import type { ThemeMode, ThemeDefinition } from "./themes";
type ThemeType = ThemeDefinition & {
  spacing: typeof spacing;
  rounded: typeof rounded;
  typography: typeof typography;
};

type Props = {
  children: React.ReactNode;
  mode?: ThemeMode;
  followSystem?: boolean;
  onModeChange?: (mode: ThemeMode) => void;
};

type ThemeContextType = {
  theme: ThemeType;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
};

export const THEME_MODE_STORAGE_KEY = "APP_THEME_MODE";

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "light" || value === "dark";

const ThemeContext = createContext<ThemeContextType>({
  theme: { ...themes.light, spacing, rounded, typography },
  mode: "light",
  setMode: () => {},
});

const e2eModeListeners = new Set<(mode: ThemeMode) => void>();

export function setE2EThemeMode(mode: ThemeMode): void {
  AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, mode).catch(() => {
    // Ignore persistence errors; the mounted provider still updates.
  });
  e2eModeListeners.forEach((listener) => listener(mode));
}

export const ThemeProvider: React.FC<Props> = ({
  children,
  mode,
  followSystem = true,
  onModeChange,
}) => {
  const [internalMode, setInternalMode] = useState<ThemeMode>(() => {
    if (mode) return mode;
    const sys = Appearance.getColorScheme();
    return sys === "dark" ? "dark" : "light";
  });
  const [shouldFollowSystem, setShouldFollowSystem] = useState<boolean>(
    !mode && followSystem,
  );

  useEffect(() => {
    if (!mode) return;
    setInternalMode(mode);
    setShouldFollowSystem(false);
  }, [mode]);

  useEffect(() => {
    if (mode) return;

    let cancelled = false;
    (async () => {
      try {
        const storedMode = await AsyncStorage.getItem(THEME_MODE_STORAGE_KEY);
        if (cancelled) return;
        if (isThemeMode(storedMode)) {
          setInternalMode(storedMode);
          setShouldFollowSystem(false);
          return;
        }
      } catch {
        // Ignore storage read failures and fallback to current runtime mode.
      }
      if (!cancelled) {
        setShouldFollowSystem(followSystem);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [followSystem, mode]);

  useEffect(() => {
    if (!shouldFollowSystem || mode) return;
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      const m = colorScheme === "dark" ? "dark" : "light";
      setInternalMode(m);
      onModeChange?.(m);
    });
    return () => sub.remove();
  }, [mode, onModeChange, shouldFollowSystem]);

  const theme = useMemo<ThemeType>(() => {
    const base = internalMode === "dark" ? themes.dark : themes.light;
    return { ...base, spacing, rounded, typography };
  }, [internalMode]);

  const setMode = useCallback(
    (m: ThemeMode) => {
      setInternalMode(m);
      setShouldFollowSystem(false);
      onModeChange?.(m);
      AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, m).catch(() => {
        // Ignore persistence errors; mode still updates for current session.
      });
    },
    [onModeChange],
  );

  useEffect(() => {
    const listener = (nextMode: ThemeMode) => {
      setInternalMode(nextMode);
      setShouldFollowSystem(false);
      onModeChange?.(nextMode);
    };
    e2eModeListeners.add(listener);
    return () => {
      e2eModeListeners.delete(listener);
    };
  }, [onModeChange]);

  return (
    <ThemeContext.Provider value={{ theme, mode: internalMode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => useContext(ThemeContext);
