import { useEffect, useState } from "react";
import { api } from "../api.js";
import { printBytes } from "../print.js";
import BillPreview from "../BillPreview.jsx";

const emptyLine = () => ({ item_id: "", quantity: "1" });

export default function BillsPage() {
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [lines, setLines] = useState([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastBillId, setLastBillId] = useState(null);

  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [bills, setBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(true);
  const [selectedBill, setSelectedBill] = useState(null);

  const [printingId, setPrintingId] = useState(null);
  const [printStatus, setPrintStatus] = useState("");
  const [previewBill, setPreviewBill] = useState(null);

  async function refreshBills() {
    setLoadingBills(true);
    try {
      setBills(await api.listBills(50));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingBills(false);
    }
  }

  async function refreshCatalog() {
    setLoadingCatalog(true);
    try {
      setCatalog(await api.listItems());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingCatalog(false);
    }
  }

  useEffect(() => {
    refreshBills();
    refreshCatalog();
  }, []);

  function itemById(id) {
    return catalog.find((it) => String(it.id) === String(id));
  }

  function updateLine(index, field, value) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    );
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const runningTotal = lines.reduce((sum, line) => {
    const item = itemById(line.item_id);
    const qty = parseInt(line.quantity, 10) || 0;
    return sum + (item ? item.price * qty : 0);
  }, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const missing = lines.find((line) => !itemById(line.item_id));
    if (missing) {
      setError("Pick an item for every line before generating the bill.");
      return;
    }

    const payload = {
      customer_name: customerName,
      payment_method: paymentMethod,
      items: lines.map((line) => {
        const item = itemById(line.item_id);
        return {
          item_name: item.name,
          unit_price: item.price,
          quantity: parseInt(line.quantity, 10) || 0,
        };
      }),
    };

    setSubmitting(true);
    try {
      const bill = await api.createBill(payload);
      setSuccess(`Bill #${bill.id} created — total ₹${bill.total_amount.toFixed(2)}`);
      setLastBillId(bill.id);
      setCustomerName("");
      setPaymentMethod("cash");
      setLines([emptyLine()]);
      refreshBills();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function viewBill(id) {
    if (selectedBill?.id === id) {
      setSelectedBill(null);
      return;
    }
    try {
      setSelectedBill(await api.getBill(id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function openPreview(id) {
    setError("");
    try {
      setPreviewBill(await api.getBill(id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePrint(id) {
    setError("");
    setPrintingId(id);
    setPrintStatus("Connecting to printer...");
    try {
      const bytes = await api.getBillEscpos(id);
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

  return (
    <>
      <div className="page__heading">
        <h2>Generate Bill</h2>
        <span className="page__sub">Itemize an order and record the sale</span>
      </div>

      <form className="panel" onSubmit={handleSubmit}>
        <h3>New Bill</h3>

        {error && <p className="msg msg--error">{error}</p>}
        {success && (
          <p className="msg msg--success">
            {success}
            {lastBillId && (
              <button
                type="button"
                className="btn btn--sm"
                style={{ marginLeft: 14 }}
                onClick={() => openPreview(lastBillId)}
              >
                Print Receipt
              </button>
            )}
          </p>
        )}

        <div className="form-grid" style={{ marginBottom: 20 }}>
          <div className="field">
            <label>Customer name</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="field">
            <label>Payment method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>
          </div>
        </div>

        {!loadingCatalog && catalog.length === 0 ? (
          <p className="msg msg--error">
            No menu items yet — add some in the Items tab before generating a bill.
          </p>
        ) : (
          <>
            <div className="line-items">
              {lines.map((line, i) => {
                const selected = itemById(line.item_id);
                return (
                  <div className="line-item" key={i}>
                    <div className="field">
                      <label>Item</label>
                      <select
                        required
                        value={line.item_id}
                        onChange={(e) => updateLine(i, "item_id", e.target.value)}
                      >
                        <option value="" disabled>
                          Select item...
                        </option>
                        {catalog.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Unit price</label>
                      <input
                        readOnly
                        value={selected ? `₹${selected.price.toFixed(2)}` : ""}
                        placeholder="—"
                      />
                    </div>
                    <div className="field">
                      <label>Qty</label>
                      <input
                        required
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={(e) => updateLine(i, "quantity", e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => removeLine(i)}
                      disabled={lines.length === 1}
                      title="Remove item"
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 18,
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <button type="button" className="btn btn--sm" onClick={addLine}>
                + Add item
              </button>
              <strong style={{ fontSize: "1.2rem" }}>
                Total: ₹{runningTotal.toFixed(2)}
              </strong>
            </div>

            <div style={{ marginTop: 20 }}>
              <button className="btn btn--primary" disabled={submitting}>
                {submitting ? "Saving..." : "Generate Bill"}
              </button>
            </div>
          </>
        )}
      </form>

      <div className="panel">
        <h3>Recent Bills</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Payment</th>
                <th>Total</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {loadingBills && (
                <tr className="empty-row">
                  <td colSpan={5}>Loading...</td>
                </tr>
              )}
              {!loadingBills && bills.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={5}>No bills yet</td>
                </tr>
              )}
              {bills.map((b) => (
                <tr key={b.id} onClick={() => viewBill(b.id)}>
                  <td>{b.id}</td>
                  <td>{b.customer_name || "—"}</td>
                  <td>{b.payment_method || "—"}</td>
                  <td>₹{b.total_amount.toFixed(2)}</td>
                  <td>{new Date(b.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedBill && (
          <div className="bill-detail">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 12,
              }}
            >
              <h3 style={{ marginBottom: 0 }}>Bill #{selectedBill.id}</h3>
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => setPreviewBill(selectedBill)}
              >
                Print Receipt
              </button>
            </div>
            <div className="table-wrap">
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
                  {selectedBill.items.map((it) => (
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
