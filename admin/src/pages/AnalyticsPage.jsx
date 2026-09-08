import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function AnalyticsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh(params = {}) {
    setLoading(true);
    setError("");
    try {
      setSummary(await api.getAnalytics(params));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function handleFilter(e) {
    e.preventDefault();
    refresh({ from, to });
  }

  return (
    <>
      <div className="page__heading">
        <h2>Analytics</h2>
        <span className="page__sub">Revenue and top items over a date range</span>
      </div>

      <form
        onSubmit={handleFilter}
        className="panel form-grid"
        style={{ alignItems: "end" }}
      >
        <div className="field">
          <label>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button type="submit" className="btn btn--primary">
          Update
        </button>
      </form>

      {error && <p className="msg msg--error">{error}</p>}

      {loading && <p className="page__sub">Loading...</p>}

      {!loading && summary && (
        <>
          <p className="page__sub">
            Showing {summary.from} to {summary.to}
          </p>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-card__label">Total Revenue</div>
              <div className="stat-card__value">₹{summary.total_revenue.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">Bill Revenue</div>
              <div className="stat-card__value">₹{summary.bill_revenue.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">Manual Sales Revenue</div>
              <div className="stat-card__value">
                ₹{summary.manual_sales_revenue.toFixed(2)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">Bills Generated</div>
              <div className="stat-card__value">{summary.bill_count}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">Avg Bill Value</div>
              <div className="stat-card__value">
                ₹{summary.average_bill_value.toFixed(2)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">Manual Sale Entries</div>
              <div className="stat-card__value">{summary.manual_sales_count}</div>
            </div>
          </div>

          <div className="panel">
            <h3>Top Items</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.top_items.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={3}>No itemized bills in this range</td>
                    </tr>
                  )}
                  {summary.top_items.map((t) => (
                    <tr key={t.item_name}>
                      <td>{t.item_name}</td>
                      <td>{t.quantity}</td>
                      <td>₹{t.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
