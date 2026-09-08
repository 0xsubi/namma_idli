import { useEffect, useState } from "react";
import { api } from "../api.js";

const today = () => new Date().toISOString().slice(0, 10);

export default function SalesPage() {
  const [saleDate, setSaleDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sales, setSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(true);

  async function refreshSales(params = {}) {
    setLoadingSales(true);
    try {
      setSales(await api.listSales(params));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingSales(false);
    }
  }

  useEffect(() => {
    refreshSales();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    setSubmitting(true);
    try {
      const sale = await api.createSale({
        sale_date: saleDate,
        amount: parseFloat(amount) || 0,
        notes,
      });
      setSuccess(`Recorded sale of ₹${sale.amount.toFixed(2)} on ${sale.sale_date}`);
      setAmount("");
      setNotes("");
      refreshSales({ from, to });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleFilter(e) {
    e.preventDefault();
    refreshSales({ from, to });
  }

  return (
    <>
      <div className="page__heading">
        <h2>Sales Records</h2>
        <span className="page__sub">Log sales that weren't itemized into a bill</span>
      </div>

      <form className="panel" onSubmit={handleSubmit}>
        <h3>New Sale Entry</h3>

        {error && <p className="msg msg--error">{error}</p>}
        {success && <p className="msg msg--success">{success}</p>}

        <div className="form-grid">
          <div className="field">
            <label>Date</label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Amount</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <button className="btn btn--primary" disabled={submitting}>
            {submitting ? "Saving..." : "Record Sale"}
          </button>
        </div>
      </form>

      <div className="panel">
        <h3>Sales History</h3>

        <form
          onSubmit={handleFilter}
          className="form-grid"
          style={{ marginBottom: 20, alignItems: "end" }}
        >
          <div className="field">
            <label>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button type="submit" className="btn btn--sm">
            Filter
          </button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {loadingSales && (
                <tr className="empty-row">
                  <td colSpan={3}>Loading...</td>
                </tr>
              )}
              {!loadingSales && sales.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={3}>No sales recorded in this range</td>
                </tr>
              )}
              {sales.map((s) => (
                <tr key={s.id}>
                  <td>{s.sale_date}</td>
                  <td>₹{s.amount.toFixed(2)}</td>
                  <td>{s.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
