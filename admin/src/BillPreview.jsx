const RECEIPT_WIDTH = 32;

function truncate(s, width) {
  return s.length <= width ? s : s.slice(0, width);
}

function formatDateTime(iso) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear();
  const time = d
    .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    .toUpperCase();
  return `${day} ${month} ${year}  ${time}`;
}

export default function BillPreview({ bill, onClose, onPrint, printing, printStatus }) {
  if (!bill) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="receipt">
          <div className="receipt__logo">
            <img src="/namma-idli-new.svg" alt="Namma Idli" />
          </div>
          <div className="receipt__title">NAMMA IDLI</div>
          <div className="receipt__rule" />

          <div className="receipt__meta">
            <div>Bill #{bill.id}</div>
            <div>{formatDateTime(bill.created_at)}</div>
            {bill.customer_name && <div>Customer: {bill.customer_name}</div>}
            {bill.payment_method && (
              <div>Payment: {bill.payment_method.toUpperCase()}</div>
            )}
          </div>
          <div className="receipt__rule" />

          <div className="receipt__items">
            {bill.items.map((it) => (
              <div key={it.id} className="receipt__item">
                <div>{truncate(it.item_name, RECEIPT_WIDTH)}</div>
                <div className="receipt__line">
                  <span>
                    {"  "}
                    {it.quantity > 0 ? `${it.quantity} x Rs.${it.unit_price.toFixed(2)}` : "Amount"}
                  </span>
                  <span>Rs.{it.line_total.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="receipt__rule" />

          <div className="receipt__line receipt__total">
            <span>TOTAL</span>
            <span>Rs.{bill.total_amount.toFixed(2)}</span>
          </div>
          <div className="receipt__rule" />

          <div className="receipt__footer">Thank you, visit again!</div>
        </div>

        {printStatus && <p className="msg msg--success modal__status">{printStatus}</p>}

        <div className="modal__actions">
          <button type="button" className="btn btn--sm" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={printing}
            onClick={onPrint}
          >
            {printing ? printStatus || "Printing..." : "Print"}
          </button>
        </div>
      </div>
    </div>
  );
}
