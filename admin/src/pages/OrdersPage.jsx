import { useEffect, useState } from "react";
import { api } from "../api.js";
import { printBytes } from "../print.js";
import { enablePush, disablePush, getPushStatus } from "../push.js";
import BillPreview from "../BillPreview.jsx";

const FILTERS = ["pending", "accepted", "ready", "completed", "cancelled", "all"];

const STATUS_COLOR = {
  pending: "#eb6734",
  accepted: "#0d8ad6",
  ready: "#1f8a3b",
  completed: "#0a0a0a",
  cancelled: "#c0392b",
};

const NEXT_STATUS = {
  pending: { label: "Accept", value: "accepted" },
  accepted: { label: "Mark Ready", value: "ready" },
  ready: { label: "Mark Completed", value: "completed" },
};

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
      {status}
    </span>
  );
}

export default function OrdersPage() {
  const [notifStatus, setNotifStatus] = useState("checking");
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifError, setNotifError] = useState("");

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("pending");

  const [expandedId, setExpandedId] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [busyId, setBusyId] = useState(null);
  const [printingId, setPrintingId] = useState(null);
  const [printStatus, setPrintStatus] = useState("");
  const [previewBill, setPreviewBill] = useState(null);

  async function refreshOrders() {
    setLoading(true);
    try {
      setOrders(await api.listOrders());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshOrders();
    getPushStatus().then(setNotifStatus);

    const id = setInterval(refreshOrders, 15000);
    return () => clearInterval(id);
  }, []);

  async function toggleNotifications() {
    setNotifError("");
    setNotifBusy(true);
    try {
      if (notifStatus === "enabled") {
        await disablePush();
        setNotifStatus("disabled");
      } else {
        await enablePush();
        setNotifStatus("enabled");
      }
    } catch (err) {
      setNotifError(err.message);
    } finally {
      setNotifBusy(false);
    }
  }

  async function toggleExpand(id) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedOrder(null);
      return;
    }
    setExpandedId(id);
    try {
      setExpandedOrder(await api.getOrder(id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function advanceStatus(order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setError("");
    setBusyId(order.id);
    try {
      await api.updateOrderStatus(order.id, next.value);
      await refreshOrders();
      if (expandedId === order.id) setExpandedOrder(await api.getOrder(order.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function cancelOrder(order) {
    if (!confirm(`Cancel order #${order.id}?`)) return;
    setError("");
    setBusyId(order.id);
    try {
      await api.updateOrderStatus(order.id, "cancelled");
      await refreshOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function convertToBill(order) {
    setError("");
    setBusyId(order.id);
    try {
      const bill = await api.convertOrderToBill(order.id, paymentMethod);
      await refreshOrders();
      setExpandedOrder(await api.getOrder(order.id));
      setPreviewBill(bill);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function openPreview(billId) {
    setError("");
    try {
      setPreviewBill(await api.getBill(billId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePrint(billId) {
    setPrintingId(billId);
    setPrintStatus("Connecting to printer...");
    try {
      const bytes = await api.getBillEscpos(billId);
      setPrintStatus("Printing...");
      await printBytes(bytes);
      setPrintStatus("Printed!");
      setTimeout(() => setPrintStatus(""), 2500);
    } catch (err) {
      setPrintStatus("");
      setError(err.message);
    } finally {
      setPrintingId(null);
    }
  }

  const visibleOrders =
    filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <>
      <div className="page__heading">
        <h2>Orders</h2>
        <span className="page__sub">Live queue of orders placed from the site</span>
      </div>

      <div className="panel">
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn--primary"
            disabled={notifBusy || notifStatus === "unsupported" || notifStatus === "checking"}
            onClick={toggleNotifications}
          >
            {notifStatus === "enabled" ? "Disable Notifications" : "Enable Order Notifications"}
          </button>
          <span className="page__sub">
            {notifStatus === "checking" && "Checking notification support..."}
            {notifStatus === "unsupported" &&
              "Not supported in this browser — use Chrome/Edge over HTTPS."}
            {notifStatus === "enabled" && "You'll get a push notification for new orders."}
            {notifStatus === "disabled" && "Notifications are off on this device."}
          </span>
        </div>
        {notifError && <p className="msg msg--error" style={{ marginTop: 12 }}>{notifError}</p>}
      </div>

      {error && <p className="msg msg--error">{error}</p>}

      <div className="admin-nav" style={{ background: "transparent", border: "none" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`btn btn--sm${filter === f ? " btn--primary" : ""}`}
              onClick={() => setFilter(f)}
              style={{ textTransform: "capitalize" }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Placed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr className="empty-row">
                  <td colSpan={6}>Loading...</td>
                </tr>
              )}
              {!loading && visibleOrders.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={6}>No {filter !== "all" ? filter : ""} orders</td>
                </tr>
              )}
              {visibleOrders.map((o) => {
                const next = NEXT_STATUS[o.status];
                const active = o.status !== "completed" && o.status !== "cancelled";
                return (
                  <tr key={o.id} onClick={() => toggleExpand(o.id)}>
                    <td>{o.id}</td>
                    <td>{o.customer_name}</td>
                    <td>₹{o.total_amount.toFixed(2)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>{new Date(o.created_at).toLocaleString()}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {active && (
                        <div style={{ display: "flex", gap: 8 }}>
                          {next && (
                            <button
                              type="button"
                              className="btn btn--sm"
                              disabled={busyId === o.id}
                              onClick={() => advanceStatus(o)}
                            >
                              {next.label}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn--sm"
                            disabled={busyId === o.id}
                            onClick={() => cancelOrder(o)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {expandedOrder && (
          <div className="bill-detail">
            <h3>
              Order #{expandedOrder.id} — {expandedOrder.customer_name}
            </h3>
            {expandedOrder.customer_phone && (
              <p className="page__sub">Phone: {expandedOrder.customer_phone}</p>
            )}
            {expandedOrder.notes && <p className="page__sub">Notes: {expandedOrder.notes}</p>}

            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Unit price</th>
                    <th>Qty</th>
                    <th>Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {expandedOrder.items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.item_name}</td>
                      <td>₹{it.unit_price.toFixed(2)}</td>
                      <td>{it.quantity}</td>
                      <td>₹{it.line_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 16,
                flexWrap: "wrap",
              }}
            >
              {expandedOrder.bill_id ? (
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => openPreview(expandedOrder.bill_id)}
                >
                  {`Print Bill #${expandedOrder.bill_id}`}
                </button>
              ) : (
                <>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{
                      border: "var(--border-w) solid var(--black)",
                      borderRadius: "var(--radius)",
                      padding: "10px 12px",
                    }}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={busyId === expandedOrder.id}
                    onClick={() => convertToBill(expandedOrder)}
                  >
                    Convert to Bill &amp; Print
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <BillPreview
        bill={previewBill}
        onClose={() => setPreviewBill(null)}
        onPrint={() => handlePrint(previewBill.id)}
        printing={printingId === previewBill?.id}
        printStatus={printingId === previewBill?.id ? printStatus : ""}
      />
    </>
  );
}
