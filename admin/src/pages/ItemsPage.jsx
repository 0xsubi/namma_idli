import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
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
      await api.createItem({ name, price: parseFloat(price) || 0 });
      setName("");
      setPrice("");
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
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id) {
    setError("");
    setSavingEdit(true);
    try {
      await api.updateItem(id, { name: editName, price: parseFloat(editPrice) || 0 });
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
        <span className="page__sub">Manage the items available when generating a bill</span>
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
          <button className="btn btn--primary" disabled={submitting}>
            {submitting ? "Adding..." : "Add Item"}
          </button>
        </div>
      </form>

      <div className="panel">
        <h3>All Items</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr className="empty-row">
                  <td colSpan={3}>Loading...</td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={3}>No items yet — add your menu above</td>
                </tr>
              )}
              {items.map((item) =>
                editingId === item.id ? (
                  <tr key={item.id} style={{ cursor: "default" }}>
                    <td>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        style={{ width: 100 }}
                      />
                    </td>
                    <td style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
                        disabled={savingEdit}
                        onClick={() => saveEdit(item.id)}
                      >
                        Save
                      </button>
                      <button type="button" className="btn btn--sm" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} style={{ cursor: "default" }}>
                    <td>{item.name}</td>
                    <td>₹{item.price.toFixed(2)}</td>
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
