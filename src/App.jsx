import { useEffect, useState } from "react";
import logo from "./assets/namma-idli-new.svg";
import placeholderImg from "./assets/generic_dish_placeholder.svg";
import { isOpenNow, formatNextOpen } from "./hours.js";

const MAPS_URL = "https://maps.app.goo.gl/iW5BRkHxcUBG67yt7";
const API_BASE =
  import.meta.env.RUNNING_LOCALLY === "true"
    ? "http://localhost:8080"
    : "https://namma-idli-api.0xlab.in";

const STATUS_LABEL = {
  sold_out: "Sold Out",
  unavailable: "Not Available",
  coming_soon: "Coming Soon",
};

export default function App() {
  const [now, setNow] = useState(() => new Date());
  const [flippedCard, setFlippedCard] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [menu, setMenu] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMenu() {
      try {
        const res = await fetch(`${API_BASE}/api/menu`);
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || "Could not load the menu.");
        if (!cancelled) setMenu(body || []);
      } catch (err) {
        if (!cancelled) setMenuError(err.message);
      } finally {
        if (!cancelled) setMenuLoading(false);
      }
    }
    loadMenu();
    return () => {
      cancelled = true;
    };
  }, []);

  const open = isOpenNow(now);

  const updateQty = (name, delta) => {
    setQuantities((current) => {
      const next = Math.max(0, (current[name] || 0) + delta);
      return { ...current, [name]: next };
    });
  };

  const cartItems = menu.filter(
    (item) => item.status === "available" && quantities[item.name] > 0
  );
  const totalItems = cartItems.reduce((sum, item) => sum + quantities[item.name], 0);
  const totalPrice = cartItems.reduce(
    (sum, item) => sum + quantities[item.name] * item.price,
    0
  );

  useEffect(() => {
    if (!orderPlaced) return;
    const id = setTimeout(() => setOrderPlaced(false), 6000);
    return () => clearTimeout(id);
  }, [orderPlaced]);

  async function handlePlaceOrder(e) {
    e.preventDefault();
    setOrderError("");

    if (!customerName.trim()) {
      setOrderError("Please enter your name so we know who to call out.");
      return;
    }

    setPlacing(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          items: cartItems.map((item) => ({
            item_name: item.name,
            quantity: quantities[item.name],
          })),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error || "Could not place order. Please try again.");
      }
      setOrderPlaced(true);
      setQuantities({});
      setCustomerName("");
      setCustomerPhone("");
    } catch (err) {
      setOrderError(err.message);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className={totalItems > 0 || orderPlaced ? "app app--cart-open" : "app"}>
      <header className="site-header">
        <div className="site-header__inner">
          <div className="site-header__logo">
            <img src={logo} alt="Namma Idli logo" />
          </div>
          <h1 className="site-header__title">Namma Idli</h1>
          <div className="site-header__status">
            <span
              className={
                open
                  ? "site-header__tag"
                  : "site-header__tag site-header__tag--closed"
              }
            >
              {open ? "Open Now" : "We are closed now"}
            </span>
            {!open && (
              <span className="site-header__next">{formatNextOpen(now)}</span>
            )}
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero__inner">
          <span className="hero__badge">Fresh &middot; Steaming &middot; Local</span>
          <h1>Namma Idli</h1>
          <p>
            Soft idlis, tangy rice, and hot tea served the way namma ooru
            likes it. No fuss, just good food.
          </p>
          <a
            className="btn btn--maps"
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Take me there
          </a>
        </div>
      </section>

      <main className="menu">
        <div className="menu__heading">
          <h2>Menu</h2>
          <span>Prices in ₹</span>
        </div>
        <p className="menu__sub">Everything made fresh, every single day.</p>

        {menuLoading && <p className="menu__sub">Loading menu…</p>}
        {menuError && <p className="menu__sub">{menuError}</p>}

        <div className="menu__grid">
          {menu.map((item) => {
            const unavailable = item.status !== "available";
            return (
              <div
                className={unavailable ? "card card--unavailable" : "card"}
                key={item.name}
              >
                <div
                  className="card__art"
                  onClick={() =>
                    setFlippedCard((current) =>
                      current === item.name ? null : item.name
                    )
                  }
                >
                  <div
                    className={
                      flippedCard === item.name
                        ? "card__art-inner is-flipped"
                        : "card__art-inner"
                    }
                  >
                    <div className="card__art-face card__art-face--front">
                      <img
                        src={item.image_url ? `${API_BASE}${item.image_url}` : placeholderImg}
                        alt={`${item.name} illustration`}
                      />
                    </div>
                    <div className="card__art-face card__art-face--back">
                      <p>{item.description}</p>
                    </div>
                  </div>
                  {unavailable && (
                    <span className="card__status-tag">
                      {STATUS_LABEL[item.status] || "Unavailable"}
                    </span>
                  )}
                </div>
                <div className="card__body">
                  <div className="card__info">
                    <h3 className="card__name">{item.name}</h3>
                    <span className="card__price">₹{item.price}</span>
                  </div>
                  {unavailable ? (
                    <div className="card__unavailable-label">
                      {STATUS_LABEL[item.status] || "Unavailable"}
                    </div>
                  ) : (
                    <div className="card__qty">
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => updateQty(item.name, -1)}
                        aria-label={`Remove one ${item.name}`}
                      >
                        −
                      </button>
                      <span className="qty-count">{quantities[item.name] || 0}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => updateQty(item.name, 1)}
                        aria-label={`Add one ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="site-footer">
        <p>
          <strong>Namma Idli</strong> — made with love, served with pride.
        </p>
      </footer>

      {orderPlaced && (
        <div className="cart-bar">
          <div className="cart-bar__inner">
            <div className="cart-bar__summary">
              <strong>Order placed!</strong>
              <span>We'll have it ready soon.</span>
            </div>
          </div>
        </div>
      )}

      {!orderPlaced && totalItems > 0 && (
        <div className="cart-bar">
          <form className="cart-bar__inner" onSubmit={handlePlaceOrder}>
            <div className="cart-bar__summary">
              <strong>
                {totalItems} item{totalItems > 1 ? "s" : ""}
              </strong>
              <span>₹{totalPrice}</span>
            </div>
            <div className="cart-bar__fields">
              <input
                className="cart-bar__input"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your name"
                aria-label="Your name"
              />
              <input
                className="cart-bar__input"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone (optional)"
                aria-label="Phone number"
                type="tel"
              />
            </div>
            {orderError && <p className="cart-bar__error">{orderError}</p>}
            <button className="btn btn--whatsapp" type="submit" disabled={placing}>
              {placing ? "Placing Order..." : "Place Order"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
