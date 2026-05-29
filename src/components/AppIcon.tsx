import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import type { SvgProps } from "react-native-svg";
import AddPhotoIcon from "@assets/icons/add-photo.svg";
import AddIcon from "@assets/icons/add.svg";
import ArrowIcon from "@assets/icons/arrow.svg";
import AssistantIcon from "@assets/icons/assistant.svg";
import CardIcon from "@assets/icons/card.svg";
import CalendarIcon from "@assets/icons/calendar.svg";
import CameraIcon from "@assets/icons/camera.svg";
import ChatIcon from "@assets/icons/chat.svg";
import CheckIcon from "@assets/icons/check.svg";
import CheckboxIcon from "@assets/icons/checkbox.svg";
import CheckboxEmptyIcon from "@assets/icons/checkbox-empty.svg";
import ChevronIcon from "@assets/icons/chevron.svg";
import CloseIcon from "@assets/icons/close.svg";
import CopyIcon from "@assets/icons/copy.svg";
import CropIcon from "@assets/icons/crop.svg";
import DeleteIcon from "@assets/icons/delete.svg";
import EditIcon from "@assets/icons/edit.svg";
import EmailIcon from "@assets/icons/email.svg";
import EmptyMealsIcon from "@assets/icons/empty-meals.svg";
import EyeOffIcon from "@assets/icons/eye-off.svg";
import EyeIcon from "@assets/icons/eye.svg";
import FilterIcon from "@assets/icons/filter.svg";
import FlipCameraIcon from "@assets/icons/flip-camera.svg";
import GalleryIcon from "@assets/icons/gallery.svg";
import HelpIcon from "@assets/icons/help.svg";
import HistoryIcon from "@assets/icons/history.svg";
import HomeIcon from "@assets/icons/home.svg";
import ImageIcon from "@assets/icons/image.svg";
import InfoIcon from "@assets/icons/info.svg";
import InsightIcon from "@assets/icons/insight.svg";
import LockIcon from "@assets/icons/lock.svg";
import MacroCaloriesFlameIcon from "@assets/icons/macro-calories-flame.svg";
import MacroCarbsGrainIcon from "@assets/icons/macro-carbs-grain.svg";
import MacroFatDropIcon from "@assets/icons/macro-fat-drop.svg";
import MacroProteinDrumstickIcon from "@assets/icons/macro-protein-drumstick.svg";
import MenuIcon from "@assets/icons/menu.svg";
import MoreIcon from "@assets/icons/more.svg";
import NotificationIcon from "@assets/icons/notification.svg";
import PaletteIcon from "@assets/icons/palette.svg";
import PersonIcon from "@assets/icons/person.svg";
import RefreshIcon from "@assets/icons/refresh.svg";
import SavedItemsIcon from "@assets/icons/saved-items.svg";
import ScanBarcodeIcon from "@assets/icons/scan-barcode.svg";
import ScheduleIcon from "@assets/icons/schedule.svg";
import SearchIcon from "@assets/icons/search.svg";
import SettingsIcon from "@assets/icons/settings.svg";
import ShareIcon from "@assets/icons/share.svg";
import SortIcon from "@assets/icons/sort.svg";
import SparklesIcon from "@assets/icons/sparkles.svg";
import StarIcon from "@assets/icons/star.svg";
import StatsIcon from "@assets/icons/stats.svg";
import TextIcon from "@assets/icons/text.svg";
import TrendUpIcon from "@assets/icons/trend-up.svg";
import WeeklyRaportIcon from "@assets/icons/weekly-raport.svg";
import WifiOffIcon from "@assets/icons/wifi-off.svg";

type SvgIconComponent = React.ComponentType<SvgProps>;

const ICONS = {
  "add-photo": AddPhotoIcon,
  add: AddIcon,
  arrow: ArrowIcon,
  assistant: AssistantIcon,
  card: CardIcon,
  calendar: CalendarIcon,
  camera: CameraIcon,
  chat: ChatIcon,
  check: CheckIcon,
  checkbox: CheckboxIcon,
  "checkbox-empty": CheckboxEmptyIcon,
  chevron: ChevronIcon,
  close: CloseIcon,
  copy: CopyIcon,
  crop: CropIcon,
  delete: DeleteIcon,
  edit: EditIcon,
  email: EmailIcon,
  "empty-meals": EmptyMealsIcon,
  eye: EyeIcon,
  "eye-off": EyeOffIcon,
  filter: FilterIcon,
  "flip-camera": FlipCameraIcon,
  gallery: GalleryIcon,
  help: HelpIcon,
  history: HistoryIcon,
  home: HomeIcon,
  image: ImageIcon,
  info: InfoIcon,
  insight: InsightIcon,
  lock: LockIcon,
  "macro-calories-flame": MacroCaloriesFlameIcon,
  "macro-carbs-grain": MacroCarbsGrainIcon,
  "macro-fat-drop": MacroFatDropIcon,
  "macro-protein-drumstick": MacroProteinDrumstickIcon,
  menu: MenuIcon,
  more: MoreIcon,
  notification: NotificationIcon,
  palette: PaletteIcon,
  person: PersonIcon,
  refresh: RefreshIcon,
  "saved-items": SavedItemsIcon,
  "scan-barcode": ScanBarcodeIcon,
  schedule: ScheduleIcon,
  search: SearchIcon,
  settings: SettingsIcon,
  share: ShareIcon,
  sort: SortIcon,
  sparkles: SparklesIcon,
  star: StarIcon,
  stats: StatsIcon,
  text: TextIcon,
  "trend-up": TrendUpIcon,
  "weekly-raport": WeeklyRaportIcon,
  "wifi-off": WifiOffIcon,
} as const satisfies Record<string, SvgIconComponent>;

type BaseIconName = keyof typeof ICONS;

export type AppIconName = BaseIconName;

type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  rotation?: `${number}deg`;
};

const DEFAULT_COLOR = "#2D2D3A";

export function AppIcon({
  name,
  size = 24,
  color = DEFAULT_COLOR,
  style,
  testID,
  accessibilityLabel,
  rotation,
}: AppIconProps) {
  const Icon = ICONS[name];

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.wrapper,
        {
          width: size,
          height: size,
        },
        rotation ? { transform: [{ rotate: rotation }] } : null,
        style,
      ]}
    >
      <Icon width={size} height={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default AppIcon;
