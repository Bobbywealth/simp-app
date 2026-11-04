import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { deleteAdminPhoto } from "../../api/admin";

type Item = { id: string; [key: string]: unknown };
type Page = { items?: Item[]; actions?: Item[]; nextCursor: string | null };
const PAGE_ENDPOINTS: Record<string, string> = {
  experiences: "/admin/experiences",
  photos: "/admin/photos",
  waitlist: "/admin/waitlist",
  audit: "/admin/audit-log",
  email: "/admin/email-events",
};
const text = (value: unknown) => (value == null ? "—" : String(value));
const date = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString() : "—";
export default function AdminOperations({ section }: { section: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const sequence = useRef(0);
  const load = useCallback(
    async (append = false, next?: string | null, search = "") => {
      const request = ++sequence.current;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: "25" });
        if (next) params.set("cursor", next);
        if (search && section !== "audit") params.set("query", search);
        const result = await apiFetch<Page>(
          `${PAGE_ENDPOINTS[section]}?${params}`,
        );
        if (request !== sequence.current) return;
        const rows = result.items ?? result.actions ?? [];
        setItems((current) =>
          append
            ? [
                ...new Map(
                  [...current, ...rows].map((row) => [row.id, row]),
                ).values(),
              ]
            : rows,
        );
        setCursor(result.nextCursor);
      } catch (e) {
        if (request === sequence.current) setError((e as Error).message);
      } finally {
        if (request === sequence.current) setLoading(false);
      }
    },
    [section],
  );
  useEffect(() => {
    setQuery("");
    setItems([]);
    setNotice("");
    void load();
    return () => {
      sequence.current++;
    };
  }, [load]);
  const [guests, setGuests] = useState<Record<string, Item[]>>({});
  async function cancelExperience(row: Item) {
    const reason = window.prompt(
      "Cancel this experience and notify all guests. Enter a reason:",
    );
    if (!reason || reason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ guestsNotified: number }>(
        `/admin/experiences/${encodeURIComponent(row.id)}/cancel`,
        { method: "PATCH", body: JSON.stringify({ reason: reason.trim() }) },
      );
      setNotice(`Experience cancelled. ${r.guestsNotified} guest(s) notified.`);
      await load(false, null, query);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function showGuests(row: Item) {
    try {
      const r = await apiFetch<{ items: Item[] }>(
        `/admin/experiences/${encodeURIComponent(row.id)}/requests`,
      );
      setGuests((g) => ({ ...g, [row.id]: r.items }));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function reviewPhoto(row: Item, approve: boolean) {
    let reason = "";
    if (!approve) {
      reason = window.prompt("Reject and remove this photo. Enter a reason:") ?? "";
      if (reason.trim().length < 3) return;
    }
    setBusy(true);
    setError(null);
    try {
      if (approve)
        await apiFetch(`/admin/photos/${encodeURIComponent(row.id)}/approve`, { method: "PATCH" });
      else await deleteAdminPhoto(row.id, reason.trim());
      setNotice(approve ? "Photo approved." : "Photo removed and audited.");
      setItems((cur) => cur.filter((x) => x.id !== row.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function visibility(row: Item) {
    const reason = window.prompt(
      `${row.isActive ? "Hide" : "Show"} this experience. Enter a moderation reason:`,
    );
    if (!reason || reason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(
        `/admin/experiences/${encodeURIComponent(row.id)}/visibility`,
        {
          method: "PATCH",
          body: JSON.stringify({
            isActive: !row.isActive,
            reason: reason.trim(),
          }),
        },
      );
      setNotice("Experience visibility saved and audited.");
      await load(false, null, query);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="admin-eyebrow">Operations</p>
          <h2 className="display-heading mt-2 text-3xl capitalize">
            {section === "email"
              ? "Email delivery events"
              : section === "photos"
                ? "Photo review"
              : section === "audit"
                ? "Audit history"
                : section}
          </h2>
        </div>
        <button
          className="admin-secondary"
          onClick={() => void load(false, null, query)}
          disabled={loading}
        >
          Refresh
        </button>
      </div>
      {section === "experiences" && (
        <p className="mt-4 text-sm text-white/55">
          Review hosted plans and control discovery visibility. Hiding does not
          cancel existing guest arrangements.
        </p>
      )}
      {section === "email" && (
        <p className="mt-4 text-sm text-white/55">
          Provider-reported delivery events, not proof that email is configured.
          Check System health for current integration status.
        </p>
      )}
      {section !== "audit" && (
        <form
          className="my-5 flex gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void load(false, null, query);
          }}
        >
          <input
            aria-label={`Search ${section}`}
            className="input-luxe min-w-0 flex-1"
            placeholder={
              section === "experiences"
                ? "Search title or city"
                : section === "waitlist"
                  ? "Search name or email"
                  : "Search recipient email"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="admin-secondary">Search</button>
        </form>
      )}
      {error && (
        <div role="alert" className="admin-error">
          {error}
          <button
            onClick={() => void load(false, null, query)}
            className="ml-4 underline"
          >
            Retry
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="my-4 text-sm text-gold-200">
          {notice}
        </p>
      )}
      <div className="mt-5 space-y-3" aria-busy={loading}>
        {items.map((row) => (
          <article key={row.id} className="admin-record">
            {section === "experiences" ? (
              <>
                <div>
                  <h3 className="text-lg text-white">{text(row.title)}</h3>
                  <p className="mt-2 text-sm text-white/55">
                    {text(row.city)} · {date(row.startsAt)}
                  </p>
                  <p className="mt-2 text-xs text-white/45">
                    {text(row.status)} · {row.isActive ? "Visible" : "Hidden"}
                  </p>
                  <p className="mt-2 text-xs text-white/35">ID: {row.id}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    disabled={busy}
                    onClick={() => void visibility(row)}
                    className="admin-secondary"
                  >
                    {row.isActive ? "Hide experience" : "Show experience"}
                  </button>
                  <button onClick={() => void showGuests(row)} className="admin-secondary">
                    Guests &amp; requests
                  </button>
                  {row.status !== "CANCELLED" && (
                    <button disabled={busy} onClick={() => void cancelExperience(row)} className="admin-secondary">
                      Cancel &amp; notify guests
                    </button>
                  )}
                </div>
                {guests[row.id] && (
                  <ul className="mt-3 w-full text-xs text-white/60">
                    {guests[row.id]!.length === 0 && <li>No requests yet.</li>}
                    {guests[row.id]!.map((g) => (
                      <li key={g.id}>
                        {text((g.requester as { profile?: { displayName?: string } } | undefined)?.profile?.displayName)} · {text(g.status)}
                        {g.note ? ` · "${text(g.note)}"` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : section === "photos" ? (
              <>
                <img src={text(row.url)} alt="Pending profile photo" className="h-40 w-32 rounded-xl object-cover" />
                <div className="flex-1">
                  <h3>
                    {text((row.user as { profile?: { displayName?: string } } | undefined)?.profile?.displayName)}
                  </h3>
                  <p className="mt-2 text-xs text-white/45">{text(row.status)} · {date(row.createdAt)}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button disabled={busy} onClick={() => void reviewPhoto(row, true)} className="admin-secondary">Approve</button>
                  <button disabled={busy} onClick={() => void reviewPhoto(row, false)} className="admin-secondary">Reject &amp; remove</button>
                </div>
              </>
            ) : section === "waitlist" ? (
              <>
                <div>
                  <h3>{text(row.name)}</h3>
                  <p className="mt-2 text-sm text-gold-200">
                    {text(row.email)}
                  </p>
                  <p className="mt-2 text-xs text-white/45">
                    Source: {text(row.source)}
                  </p>
                </div>
                <time className="text-xs text-white/45">
                  {date(row.createdAt)}
                </time>
              </>
            ) : section === "audit" ? (
              <div>
                <p className="text-xs tracking-widest text-gold-200">
                  {text(row.actionType)}
                </p>
                <p className="mt-3 text-sm">{text(row.reason)}</p>
                <p className="mt-3 text-xs text-white/45">
                  {text(
                    (row.moderator as { displayName?: string } | null)
                      ?.displayName,
                  )}{" "}
                  →{" "}
                  {text(
                    (row.targetUser as { displayName?: string } | null)
                      ?.displayName,
                  )}{" "}
                  · {date(row.createdAt)}
                </p>
                {Boolean(row.metadata) && (
                  <pre className="mt-3 whitespace-pre-wrap break-all text-xs text-white/40">
                    {JSON.stringify(row.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ) : (
              <>
                <div>
                  <h3>{text(row.email)}</h3>
                  <p className="mt-2 text-sm text-gold-200">
                    {text(row.type)} · {text(row.provider)}
                  </p>
                  <p className="mt-2 text-xs text-white/50">
                    {text(row.subject)}
                  </p>
                </div>
                <time className="text-xs text-white/45">
                  {date(row.createdAt)}
                </time>
              </>
            )}
          </article>
        ))}
        {!loading && !error && items.length === 0 && (
          <p className="py-16 text-center text-sm text-white/45">
            No records found.
          </p>
        )}
        {loading && (
          <p role="status" className="py-8 text-sm text-white/55">
            Loading records…
          </p>
        )}
      </div>
      {cursor && (
        <button
          disabled={loading}
          className="admin-secondary mt-5"
          onClick={() => void load(true, cursor, query)}
        >
          Load more
        </button>
      )}
    </section>
  );
}
export function AdminAnalytics() {
  const [days, setDays] = useState("7");
  const [data, setData] = useState<{
    counts: Record<string, number>;
    conversions: Record<string, number | null>;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    apiFetch<{
      counts: Record<string, number>;
      conversions: Record<string, number | null>;
    }>(`/admin/analytics/funnel?days=${days}`)
      .then((r) => {
        if (active) setData(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [days]);
  return (
    <section className="admin-panel">
      <div className="flex justify-between gap-4">
        <h2 className="display-heading text-3xl">Growth & conversion</h2>
        <select
          aria-label="Analytics period"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="input-luxe"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>
      <p className="mt-4 text-sm text-white/50">
        Recorded funnel events. Missing activity is not a fabricated conversion.
      </p>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {loading ? (
        <p className="mt-8">Loading analytics…</p>
      ) : (
        data && (
          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(data.counts)
              .filter(([key]) => !key.includes("purchase"))
              .map(([key, value]) => (
                <div key={key} className="admin-record block">
                  <p className="text-xs capitalize text-white/50">
                    {key.replaceAll("_", " ")}
                  </p>
                  <p className="mt-4 text-3xl text-gold-100">{value}</p>
                </div>
              ))}
          </div>
        )
      )}
      {data && !loading && (
        <div className="mt-8">
          <h3 className="text-lg">Conversion rates</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries(data.conversions)
              .filter(([key]) => !key.toLowerCase().includes("purchase"))
              .map(([key, value]) => (
                <div className="admin-record" key={key}>
                  <span className="text-xs text-white/60">
                    {key.replace(/([A-Z])/g, " $1")}
                  </span>
                  <strong className="text-gold-200">
                    {value == null ? "Not enough data" : value + "%"}
                  </strong>
                </div>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
interface UserDetail {
  id: string;
  email: string;
  role: string;
  status: string;
  profile: {
    displayName: string | null;
    bio: string | null;
    city: string | null;
  } | null;
  photos: Array<{ id: string; url: string }>;
  refreshTokens: Array<{
    familyId: string;
    deviceName: string | null;
    platform: string | null;
    lastUsedAt: string;
    expiresAt: string;
  }>;
}
export function AdminUserDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<UserDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(
    () =>
      apiFetch<UserDetail>(`/admin/users/${encodeURIComponent(id)}`)
        .then(setData)
        .catch((e) => setError(e.message)),
    [id],
  );
  useEffect(() => {
    setData(null);
    setError("");
    void load();
  }, [load]);
  async function action(photoId?: string) {
    const reason = window.prompt(
      photoId
        ? "Remove this photo permanently. Enter the reason:"
        : "Revoke all refresh sessions for this user. Existing access tokens expire normally. Enter the reason:",
    );
    if (!reason || reason.trim().length < 3) return;
    if (
      !window.confirm(
        photoId
          ? "Permanently remove this profile photo?"
          : "Revoke this user’s refresh sessions?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      if (photoId) await deleteAdminPhoto(photoId, reason);
      else
        await apiFetch(
          `/admin/users/${encodeURIComponent(id)}/revoke-sessions`,
          { method: "POST", body: JSON.stringify({ reason }) },
        );
      setNotice(
        photoId
          ? "Photo removed."
          : "Refresh sessions revoked. Existing access tokens expire within their configured lifetime.",
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-panel">
      <button
        className="admin-secondary"
        onClick={() => navigate("/admin/users")}
      >
        Back to users
      </button>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="my-4 text-gold-200">
          {notice}
        </p>
      )}
      {!data && !error && <p className="mt-5">Loading user…</p>}
      {data && (
        <>
          <h2 className="display-heading mt-6 text-3xl">
            {data.profile?.displayName || data.email}
          </h2>
          <p className="mt-3 text-white/60">
            {data.email} · {data.role} · {data.status}
          </p>
          <p className="mt-3 text-sm text-white/50">{data.profile?.city}</p>
          <p className="mt-3 text-sm text-white/65">{data.profile?.bio}</p>
          <h3 className="mt-8 text-lg">Profile photos</h3>
          <div className="mt-4 flex flex-wrap gap-4">
            {data.photos.map((photo) => (
              <div key={photo.id} className="w-40">
                <img
                  src={photo.url}
                  alt="User profile"
                  className="h-48 w-40 rounded-xl object-cover"
                />
                <button
                  disabled={busy}
                  onClick={() => void action(photo.id)}
                  className="admin-secondary mt-2 w-full"
                >
                  Remove photo
                </button>
              </div>
            ))}
            {!data.photos.length && <p className="text-white/45">No photos.</p>}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg">Active refresh sessions</h3>
            <button
              disabled={busy || !data.refreshTokens.length}
              onClick={() => void action()}
              className="admin-secondary"
            >
              Revoke sessions
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {data.refreshTokens.map((session) => (
              <div key={session.familyId} className="admin-record">
                <span>
                  {session.deviceName || session.platform || "Unknown device"}
                </span>
                <span className="text-xs text-white/50">
                  Last used {date(session.lastUsedAt)}
                </span>
              </div>
            ))}
            {!data.refreshTokens.length && (
              <p className="text-white/45">No active refresh sessions.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
