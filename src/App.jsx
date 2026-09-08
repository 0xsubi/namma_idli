import { useEffect, useState } from "react";
import logo from "./assets/namma-idli-new.svg";
import idliImg from "./assets/idli_plate_flat_illustration.svg";
import lemonRiceImg from "./assets/lemon_rice_flat_illustration_grainy.svg";
import puliogareImg from "./assets/puliogare_flat_illustration_grainy.svg";
import teaImg from "./assets/tea_tumbler_davara_flat_illustration.svg";
import { isOpenNow, formatNextOpen } from "./hours.js";

const MAPS_URL = "https://maps.app.goo.gl/iW5BRkHxcUBG67yt7";

const MENU = [
  {
    name: "Idli",
    price: 40,
    img: idliImg,
    desc: "Steamed rice cakes, soft as a cloud. Served hot with chutney and sambar.",
  },
  {
    name: "Lemon Rice",
    price: 50,
    img: lemonRiceImg,
    desc: "Tangy, turmeric-gold rice tempered with mustard seeds, curry leaves, peanuts and a zest of lemon.",
  },
  {
    name: "Puliogare",
    price: 50,
    img: puliogareImg,
    desc: "Tamarind rice packed with a punch — spicy, sour and roasted to perfection.",
  },
  {
    name: "Tea",
    price: 12,
    img: teaImg,
    desc: "Strong, milky filter tea brewed the traditional way. Just the right amount of sweet.",
  },
];

export default function App() {
  const [now, setNow] = useState(() => new Date());
  const [flippedCard, setFlippedCard] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const open = isOpenNow(now);

  const updateQty = (name, delta) => {
    setQuantities((current) => {
      const next = Math.max(0, (current[name] || 0) + delta);
      return { ...current, [name]: next };
    });
  };

  const cartItems = MENU.filter((item) => quantities[item.name] > 0);
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
      const res = await fetch("/api/orders", {
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

        <div className="menu__grid">
          {MENU.map((item) => (
            <div className="card" key={item.name}>
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
                    <img src={item.img} alt={`${item.name} illustration`} />
                  </div>
                  <div className="card__art-face card__art-face--back">
                    <p>{item.desc}</p>
                  </div>
                </div>
              </div>
              <div className="card__body">
                <div className="card__info">
                  <h3 className="card__name">{item.name}</h3>
                  <span className="card__price">₹{item.price}</span>
                </div>
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
              </div>
            </div>
          ))}
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
