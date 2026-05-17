import {
  __resetSignupProfileBootstrapForTests,
  beginSignupProfileBootstrap,
  isSignupProfileBootstrapPending,
  subscribeSignupProfileBootstrap,
} from "@/services/session/signupProfileBootstrap";

describe("signupProfileBootstrap", () => {
  beforeEach(() => {
    __resetSignupProfileBootstrapForTests();
  });

  it("tracks signup profile initialization before and after uid attachment", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSignupProfileBootstrap(listener);
    const session = beginSignupProfileBootstrap();

    expect(isSignupProfileBootstrapPending()).toBe(true);
    expect(isSignupProfileBootstrapPending("user-1")).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    session.attachUid("user-1");

    expect(isSignupProfileBootstrapPending("user-1")).toBe(true);
    expect(isSignupProfileBootstrapPending("user-2")).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    session.finish();

    expect(isSignupProfileBootstrapPending("user-1")).toBe(false);
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
  });

  it("ignores stale sessions after a newer signup starts", () => {
    const staleSession = beginSignupProfileBootstrap();
    const activeSession = beginSignupProfileBootstrap();

    activeSession.attachUid("active-user");
    staleSession.attachUid("stale-user");

    expect(isSignupProfileBootstrapPending("active-user")).toBe(true);
    expect(isSignupProfileBootstrapPending("stale-user")).toBe(false);

    staleSession.finish();

    expect(isSignupProfileBootstrapPending("active-user")).toBe(true);

    activeSession.finish();

    expect(isSignupProfileBootstrapPending()).toBe(false);
  });
});
