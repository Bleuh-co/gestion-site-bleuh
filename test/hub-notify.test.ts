/**
 * Notifications GANDALF depuis Marketing Bleuh — src/lib/hub-notify.ts (lot
 * L9). Le hub exige `user_email` et la clé `X-Notif-Key` ; la fonction ne
 * lève jamais.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hubAppLink, sendHubNotification } from "../src/lib/hub-notify";

describe("hubAppLink", () => {
  const ANCIEN = { ...process.env };
  afterEach(() => {
    process.env = { ...ANCIEN };
  });

  it("rouvre Marketing Bleuh par ?app=, l'id du document apps s'il est connu", () => {
    delete process.env.GESTIONSITEBLEUH_APP_ID;
    expect(hubAppLink()).toBe("/?app=gestion-site-bleuh");
    process.env.GESTIONSITEBLEUH_APP_ID = "9oxbWs7SxVimUqLBkOhH";
    expect(hubAppLink()).toBe("/?app=9oxbWs7SxVimUqLBkOhH");
  });
});

describe("sendHubNotification", () => {
  const ANCIEN = { ...process.env };
  beforeEach(() => {
    process.env.NOTIF_API_KEY = "cle-de-test";
    delete process.env.GANDALF_NOTIF_KEY;
    delete process.env.HUB_URL;
    delete process.env.NEXT_PUBLIC_HUB_URL;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...ANCIEN };
    vi.restoreAllMocks();
  });

  it("sans clé : rien ne part, et la raison est dite", async () => {
    delete process.env.NOTIF_API_KEY;
    const fetchFn = vi.fn();
    const r = await sendHubNotification(["a@chanv.com"], { title: "t" }, { fetch: fetchFn });
    expect(r).toEqual({ sent: 0, skipped: 1, reason: "not_configured" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("une requête par personne, user_email (pas `to`) et X-Notif-Key", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    const r = await sendHubNotification(["a@chanv.com", "b@chanv.com"], { title: "Page prête", url: "/?app=x" }, { fetch: fetchFn });
    expect(r).toEqual({ sent: 2, skipped: 0 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const [url, init] = fetchFn.mock.calls[1];
    expect(url).toBe("https://gandalf.chanv.com/api/notifications");
    expect(init.headers["X-Notif-Key"]).toBe("cle-de-test");
    expect(JSON.parse(init.body)).toEqual({ user_email: "b@chanv.com", title: "Page prête", url: "/?app=x" });
  });

  it("un refus ou une panne ne lève pas : compté, avec la raison", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockRejectedValueOnce(new Error("fetch failed"));
    const r = await sendHubNotification(["a@chanv.com", "b@chanv.com"], { title: "t" }, { fetch: fetchFn });
    expect(r.sent).toBe(0);
    expect(r.skipped).toBe(2);
    expect(r.reason).toBe("fetch failed");
  });

  it("aucune personne : aucun appel", async () => {
    const fetchFn = vi.fn();
    expect(await sendHubNotification([], { title: "t" }, { fetch: fetchFn })).toEqual({ sent: 0, skipped: 0, reason: "no_recipients" });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
