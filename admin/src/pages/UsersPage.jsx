import { useEffect, useState } from "react";
import { api } from "../api.js";
import { getUser } from "../auth.js";

const ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

const ROLE_COLOR = {
  member: "#555",
  admin: "#0d8ad6",
};

function RoleBadge({ role }) {
  return (
    <span
      style={{
        background: ROLE_COLOR[role] || "#555",
        color: "#fff",
        padding: "4px 10px",
        borderRadius: 999,
        fontWeight: 700,
        fontSize: "0.75rem",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {role}
    </span>
  );
}

export default function UsersPage() {
  const me = getUser();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("member");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState("member");
  const [savingEdit, setSavingEdit] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setUsers(await api.listUsers());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.createUser({ username, password, role });
      setUsername("");
      setPassword("");
      setRole("member");
      e.target.reset();
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(user) {
    setEditingId(user.id);
    setEditRole(user.role);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id) {
    setError("");
    setSavingEdit(true);
    try {
      await api.updateUserRole(id, editRole);
      setEditingId(null);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(user) {
    if (!confirm(`Remove "${user.username}"? They'll be logged out immediately.`)) return;
    setError("");
    try {
      await api.deleteUser(user.id);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="page__heading">
        <h2>Team</h2>
        <span className="page__sub">
          Members can use every admin feature. Admins can also add, promote and remove accounts.
        </span>
      </div>

      <form className="panel" onSubmit={handleCreate}>
        <h3>Add Person</h3>

        {error && <p className="msg msg--error">{error}</p>}

        <div className="form-grid" style={{ alignItems: "end" }}>
          <div className="field">
            <label>Username</label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. priya"
            />
          </div>
          <div className="field">
            <label>Temporary password</label>
            <input
              required
              type="text"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="field">
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p style={{ fontSize: "0.8em", opacity: 0.7, marginTop: 8 }}>
          Share this username and temporary password with them directly — they can change it
          after logging in.
        </p>
        <button className="btn btn--primary" style={{ marginTop: 12 }} disabled={submitting}>
          {submitting ? "Adding..." : "Add Person"}
        </button>
      </form>

      <div className="panel">
        <h3>All Accounts</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr className="empty-row">
                  <td colSpan={4}>Loading...</td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={4}>No accounts yet</td>
                </tr>
              )}
              {users.map((user) =>
                editingId === user.id ? (
                  <tr key={user.id} className="edit-row">
                    <td colSpan={4}>
                      <div className="form-grid" style={{ alignItems: "end" }}>
                        <div className="field">
                          <label>Role</label>
                          <select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                            {ROLE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        <button
                          type="button"
                          className="btn btn--sm btn--primary"
                          disabled={savingEdit}
                          onClick={() => saveEdit(user.id)}
                        >
                          {savingEdit ? "Saving..." : "Save"}
                        </button>
                        <button type="button" className="btn btn--sm" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={user.id} style={{ cursor: "default" }}>
                    <td>
                      {user.username}
                      {user.id === me?.id && (
                        <span style={{ fontSize: "0.8em", opacity: 0.7 }}> (you)</span>
                      )}
                    </td>
                    <td>
                      <RoleBadge role={user.role} />
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td style={{ display: "flex", gap: 8 }}>
                      {user.id !== me?.id && (
                        <>
                          <button
                            type="button"
                            className="btn btn--sm"
                            onClick={() => startEdit(user)}
                          >
                            Change Role
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm"
                            onClick={() => handleDelete(user)}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
