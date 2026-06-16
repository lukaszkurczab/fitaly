import AsyncStorage from "@react-native-async-storage/async-storage";

export type PullCheckDomain =
  | "meals"
  | "myMeals"
  | "chat"
  | "smartMemory"
  | "foodLibrary";

function keyLastPull(uid: string) {
  return `sync:last_pull_ts:${uid}`;
}

function keyLastMyMealsPull(uid: string) {
  return `sync:last_pull_my_meals:${uid}`;
}

function keyLastChatPull(uid: string) {
  return `sync:last_pull_chat:${uid}`;
}

function keyLastSmartMemoryPull(uid: string) {
  return `sync:last_pull_smart_memory:${uid}`;
}

function keyLastPullCheck(uid: string, domain: PullCheckDomain) {
  return `sync:last_pull_check:${domain}:${uid}`;
}

export async function setLastPullTs(uid: string, iso: string): Promise<void> {
  await AsyncStorage.setItem(keyLastPull(uid), iso);
}

export async function getLastPullTs(uid: string): Promise<string | null> {
  return AsyncStorage.getItem(keyLastPull(uid));
}

export async function setLastMyMealsPullTs(
  uid: string,
  iso: string,
): Promise<void> {
  await AsyncStorage.setItem(keyLastMyMealsPull(uid), iso);
}

export async function getLastMyMealsPullTs(uid: string): Promise<string | null> {
  return AsyncStorage.getItem(keyLastMyMealsPull(uid));
}

export async function setLastChatPullTs(uid: string, ts: number): Promise<void> {
  await AsyncStorage.setItem(keyLastChatPull(uid), String(Math.max(0, ts)));
}

export async function getLastChatPullTs(uid: string): Promise<number> {
  const raw = await AsyncStorage.getItem(keyLastChatPull(uid));
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export async function setLastSmartMemoryPullTs(
  uid: string,
  iso: string,
): Promise<void> {
  await AsyncStorage.setItem(keyLastSmartMemoryPull(uid), iso);
}

export async function getLastSmartMemoryPullTs(
  uid: string,
): Promise<string | null> {
  return AsyncStorage.getItem(keyLastSmartMemoryPull(uid));
}

export async function setLastPullCheckTs(
  uid: string,
  domain: PullCheckDomain,
  iso: string,
): Promise<void> {
  await AsyncStorage.setItem(keyLastPullCheck(uid, domain), iso);
}

export async function getLastPullCheckTs(
  uid: string,
  domain: PullCheckDomain,
): Promise<string | null> {
  return AsyncStorage.getItem(keyLastPullCheck(uid, domain));
}
