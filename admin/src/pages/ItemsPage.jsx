import { useEffect, useState } from "react";
import { api, API_ORIGIN } from "../api.js";

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "sold_out", label: "Sold Out" },
  { value: "unavailable", label: "Not Available" },
  { value: "coming_soon", label: "Coming Soon" },
];

const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]));

const STATUS_COLOR = {
  available: "#1f8a3b",
  sold_out: "#c0392b",
  unavailable: "#555",
  coming_soon: "#0d8ad6",
};

function imageSrc(item) {
  return item.image_url ? `${API_ORIGIN}${item.image_url}` : "";
}

function StatusBadge({ status }) {
  return (
    <span
      style={{
        background: STATUS_COLOR[status] || "#555",
        color: "#fff",
        padding: "4px 10px",
        borderRadius: 999,
        fontWeight: 700,
        fontSize: "0.75rem",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("available");
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState("available");
  const [editImageFile, setEditImageFile] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setItems(await api.listItems());
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
      const created = await api.createItem({
        name,
        price: parseFloat(price) || 0,
        description,
        status,
      });
      if (imageFile) {
        await api.uploadItemImage(created.id, imageFile);
      }
      setName("");
      setPrice("");
      setDescription("");
      setStatus("available");
      setImageFile(null);
      e.target.reset();
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(String(item.price));
    setEditDescription(item.description || "");
    setEditStatus(item.status || "available");
    setEditImageFile(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id) {
    setError("");
    setSavingEdit(true);
    try {
      await api.updateItem(id, {
        name: editName,
        price: parseFloat(editPrice) || 0,
        description: editDescription,
        status: editStatus,
      });
      if (editImageFile) {
        await api.uploadItemImage(id, editImageFile);
      }
      setEditingId(null);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.name}" from the menu?`)) return;
    setError("");
    try {
      await api.deleteItem(item.id);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="page__heading">
        <h2>Menu Items</h2>
        <span className="page__sub">
          Manage what shows up on the storefront — price, photo, description and availability
        </span>
      </div>

      <form className="panel" onSubmit={handleCreate}>
        <h3>Add Item</h3>

        {error && <p className="msg msg--error">{error}</p>}

        <div className="form-grid" style={{ alignItems: "end" }}>
          <div className="field">
            <label>Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Idli, Vada, ..."
            />
          </div>
          <div className="field">
            <label>Price</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Photo</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What makes it good — shows on the storefront"
          />
        </div>
        <button className="btn btn--primary" style={{ marginTop: 12 }} disabled={submitting}>
          {submitting ? "Adding..." : "Add Item"}
        </button>
      </form>

      <div className="panel">
        <h3>All Items</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Price</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr className="empty-row">
                  <td colSpan={5}>Loading...</td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={5}>No items yet — add your menu above</td>
                </tr>
              )}
              {items.map((item) =>
                editingId === item.id ? (
                  <tr key={item.id} className="edit-row">
                    <td colSpan={5}>
                      <div className="form-grid" style={{ alignItems: "end" }}>
                        <div className="field">
                          <label>Name</label>
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label>Price</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label>Status</label>
                          <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                            {STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label>Photo</label>
                          <div className="edit-row__photo">
                            {imageSrc(item) && <img src={imageSrc(item)} alt="" />}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/svg+xml"
                              onChange={(e) => setEditImageFile(e.target.files?.[0] || null)}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="field" style={{ marginTop: 14 }}>
                        <label>Description</label>
                        <textarea
                          rows={2}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="What makes it good — shows on the storefront"
                        />
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        <button
                          type="button"
                          className="btn btn--sm btn--primary"
                          disabled={savingEdit}
                          onClick={() => saveEdit(item.id)}
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
                  <tr key={item.id} style={{ cursor: "default" }}>
                    <td>
                      {imageSrc(item) ? (
                        <img
                          src={imageSrc(item)}
                          alt=""
                          style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }}
                        />
                      ) : (
                        <span style={{ opacity: 0.5 }}>—</span>
                      )}
                    </td>
                    <td>
                      {item.name}
                      {item.description && (
                        <div style={{ fontSize: "0.8em", opacity: 0.7 }}>{item.description}</div>
                      )}
                    </td>
                    <td>₹{item.price.toFixed(2)}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => startEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => handleDelete(item)}
                      >
                        Delete
                      </button>
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
