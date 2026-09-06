import { useEffect, useState } from "react";
import logo from "./assets/namma-idli-new.svg";
import idliImg from "./assets/idli_plate_flat_illustration.svg";
import lemonRiceImg from "./assets/lemon_rice_flat_illustration_grainy.svg";
import puliogareImg from "./assets/puliogare_flat_illustration_grainy.svg";
import teaImg from "./assets/tea_tumbler_davara_flat_illustration.svg";
import { isOpenNow, formatNextOpen } from "./hours.js";

const MAPS_URL = "https://maps.app.goo.gl/iW5BRkHxcUBG67yt7";
// TODO: replace with the shop's real WhatsApp number, digits only with country code (e.g. "91XXXXXXXXXX").
const WHATSAPP_NUMBER = "917879206341";

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
    desc: "Tangy, turmeric-gold rice tempered with mustard seeds, curry leaves and peanuts.",
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

function WhatsAppIcon(props) {
  return (
    <svg viewBox="0 0 32 32" width="20" height="20" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M16.003 3C9.383 3 4 8.383 4 15.003c0 2.65.86 5.1 2.32 7.09L4.8 28.2a1 1 0 0 0 1.23 1.23l6.24-1.5a12.9 12.9 0 0 0 3.73.55h.003c6.62 0 12-5.383 12-12.003C28.006 8.383 22.623 3 16.003 3Zm0 21.86h-.003a10.8 10.8 0 0 1-3.32-.52l-.475-.15-3.71.9.93-3.62-.16-.49a10.83 10.83 0 0 1-1.61-5.98c0-5.98 4.87-10.85 10.85-10.85 5.98 0 10.85 4.87 10.85 10.85 0 5.98-4.87 10.86-10.85 10.86Zm5.94-8.14c-.32-.16-1.9-.94-2.2-1.05-.29-.11-.51-.16-.72.16-.21.32-.83 1.05-1.02 1.26-.19.21-.38.24-.7.08-.32-.16-1.35-.5-2.57-1.6-.95-.85-1.6-1.9-1.79-2.22-.19-.32-.02-.49.14-.65.14-.14.32-.38.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.74-.99-2.38-.26-.63-.53-.54-.72-.55l-.61-.01c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.65 0 1.56 1.14 3.07 1.3 3.28.16.21 2.24 3.42 5.43 4.8.76.33 1.35.53 1.81.68.76.24 1.45.21 2 .13.61-.09 1.9-.78 2.17-1.53.27-.75.27-1.39.19-1.53-.08-.13-.29-.21-.61-.37Z" />
    </svg>
  );
}

export default function App() {
  const [now, setNow] = useState(() => new Date());
  const [flippedCard, setFlippedCard] = useState(null);
  const [quantities, setQuantities] = useState({});

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

  const whatsappMessage = [
    "Hi! I'd like to order from Namma Idli:",
    "",
    ...cartItems.map(
      (item) =>
        `- ${item.name} x${quantities[item.name]} - ₹${
          item.price * quantities[item.name]
        }`
    ),
    "",
    `Total: ₹${totalPrice}`,
  ].join("\n");

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    whatsappMessage
  )}`;

  return (
    <div className={totalItems > 0 ? "app app--cart-open" : "app"}>
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
              {open ? "Open Now" : "We're Closed"}
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

      {totalItems > 0 && (
        <div className="cart-bar">
          <div className="cart-bar__inner">
            <div className="cart-bar__summary">
              <strong>
                {totalItems} item{totalItems > 1 ? "s" : ""}
              </strong>
              <span>₹{totalPrice}</span>
            </div>
            <a
              className="btn btn--whatsapp"
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon />
              Place Order
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
