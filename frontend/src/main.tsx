import { useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { api, clearToken, ApiError } from "./api";
import "./style.css";
type Task = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueAt: string | null;
  version: number;
};
function App() {
  const [user, setUser] = useState<{ name: string } | null>(null),
    [register, setRegister] = useState(false),
    [items, setItems] = useState<Task[]>([]),
    [summary, setSummary] = useState<Record<string, number>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Task | null>(null),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [priority, setPriority] = useState(""),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0);
  const fail = (e: unknown) =>
    setError(e instanceof Error ? e.message : "Request failed");
  useEffect(() => {
    api<{ user: { name: string } }>("/users/me")
      .then((x) => setUser(x.user))
      .catch((e: unknown) => {
        if (!(e instanceof ApiError) || e.status !== 401) fail(e);
      });
    const expired = () => {
      setRegister(false);
      setUser(null);
      setItems([]);
      setSummary({});
      setEditing(null);
      setError("Session expired. Please sign in.");
    };
    window.addEventListener("arrowstack:session-expired", expired);
    return () =>
      window.removeEventListener("arrowstack:session-expired", expired);
  }, []);
  const query = new URLSearchParams({
    page: String(page),
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
  }).toString();
  async function load() {
    const [list, counts] = await Promise.all([
      api<{ items: Task[]; total: number }>("/tasks?" + query),
      api<Record<string, number>>("/tasks/summary"),
    ]);
    setItems(list.items);
    setTotal(list.total);
    setSummary(counts);
  }
  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      api<{ items: Task[]; total: number }>("/tasks?" + query),
      api<Record<string, number>>("/tasks/summary"),
    ])
      .then(([list, counts]) => {
        if (active) {
          setItems(list.items);
          setTotal(list.total);
          setSummary(counts);
        }
      })
      .catch((e) => {
        if (active) fail(e);
      });
    return () => {
      active = false;
    };
  }, [user, query]);
  async function authenticate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const credentials = {
      email: data.get("email"),
      password: data.get("password"),
    };
    try {
      if (register)
        await api("/auth/register", {
          method: "POST",
          body: JSON.stringify({ ...credentials, name: data.get("name") }),
        });
      const result = await api<{ user: { name: string } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      setRegister(false);
      setUser(result.user);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget,
      data = new FormData(form);
    try {
      await api("/tasks" + (editing ? "/" + editing.id : ""), {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          title: data.get("title"),
          description: data.get("description"),
          status: data.get("status"),
          priority: data.get("priority"),
          dueAt: data.get("dueAt")
            ? new Date(String(data.get("dueAt")) + "T23:59:59Z").toISOString()
            : null,
          ...(editing ? { version: editing.version } : {}),
        }),
      });
      setEditing(null);
      form.reset();
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">ARROWSTACK / PROJECT 02</p>
          <h1>Make room for progress.</h1>
          <p>Your tasks, priorities and next steps in one place.</p>
        </div>
        {user && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/auth/logout", { method: "POST" });
                clearToken();
                setUser(null);
                setItems([]);
                setSummary({});
                setEditing(null);
              } catch (e) {
                fail(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            Sign out
          </button>
        )}
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!user ? (
        <section className="auth">
          <h2>{register ? "Create your account" : "Welcome back"}</h2>
          <form onSubmit={authenticate}>
            {register && (
              <label>
                Name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={register ? 12 : 1}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
              />
            </label>
            <button disabled={busy}>
              {busy
                ? "Please wait..."
                : register
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>
          <button
            className="secondary"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register ? "I already have an account" : "Create an account"}
          </button>
        </section>
      ) : (
        <>
          <h2>Hello, {user.name}</h2>
          <section className="stats" aria-label="Task summary">
            {Object.entries(summary).map(([key, value]) => (
              <article key={key}>
                <strong>{value}</strong>
                <span>{key === "inProgress" ? "In progress" : key}</span>
              </article>
            ))}
          </section>
          <div className="workspace">
            <section>
              <h2>{editing ? "Edit task" : "New task"}</h2>
              <form key={editing?.id ?? "new"} onSubmit={save}>
                <label>
                  Title
                  <input
                    name="title"
                    required
                    maxLength={160}
                    defaultValue={editing?.title}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    name="description"
                    maxLength={4000}
                    defaultValue={editing?.description}
                  />
                </label>
                <label>
                  Status
                  <select
                    name="status"
                    defaultValue={editing?.status ?? "TODO"}
                  >
                    <option value="TODO">To do</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="DONE">Done</option>
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    name="priority"
                    defaultValue={editing?.priority ?? "MEDIUM"}
                  >
                    {["LOW", "MEDIUM", "HIGH"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Deadline (UTC)
                  <input
                    name="dueAt"
                    type="date"
                    defaultValue={editing?.dueAt?.slice(0, 10)}
                  />
                </label>
                <button disabled={busy}>
                  {editing ? "Save changes" : "Add task"}
                </button>
                {editing && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setEditing(null)}
                  >
                    Cancel edit
                  </button>
                )}
              </form>
            </section>
            <section>
              <h2>
                Your tasks <small>({total})</small>
              </h2>
              <div className="filters">
                <label>
                  Search
                  <input
                    type="search"
                    value={search}
                    maxLength={160}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <label>
                  Filter status
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All statuses</option>
                    {["TODO", "IN_PROGRESS", "DONE"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Filter priority
                  <select
                    value={priority}
                    onChange={(e) => {
                      setPriority(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All priorities</option>
                    {["LOW", "MEDIUM", "HIGH"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div aria-live="polite">
                {!items.length && (
                  <p>No tasks match. Create a task or adjust your filters.</p>
                )}
                {items.map((task) => (
                  <article className="task" key={task.id}>
                    <div className="tags">
                      <span>{task.status.replaceAll("_", " ")}</span>
                      <span>{task.priority}</span>
                    </div>
                    <h3>{task.title}</h3>
                    <p className="description">{task.description}</p>
                    {task.dueAt && <p>Due {task.dueAt.slice(0, 10)} UTC</p>}
                    <div className="actions">
                      <button
                        className="secondary"
                        onClick={() => setEditing(task)}
                      >
                        Edit {task.title}
                      </button>
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={async () => {
                          if (!confirm("Delete this task?")) return;
                          setBusy(true);
                          setError("");
                          try {
                            await api("/tasks/" + task.id, {
                              method: "DELETE",
                            });
                            await load();
                          } catch (e) {
                            fail(e);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Delete {task.title}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <nav aria-label="Task pages">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <span>Page {page}</span>
                <button
                  disabled={page * 20 >= total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </nav>
            </section>
          </div>
        </>
      )}
      <footer>
        Arrowstack Task Manager | Private tasks. Clear priorities.
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
