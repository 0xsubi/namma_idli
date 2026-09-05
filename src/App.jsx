import logo from "./assets/namma-idli-new.svg";
import idliImg from "./assets/idli_plate_flat_illustration.svg";
import lemonRiceImg from "./assets/lemon_rice_flat_illustration_grainy.svg";
import puliogareImg from "./assets/puliogare_flat_illustration_grainy.svg";
import teaImg from "./assets/tea_tumbler_davara_flat_illustration.svg";

const MENU = [
  { name: "Idli", price: 40, img: idliImg },
  { name: "Lemon Rice", price: 50, img: lemonRiceImg },
  { name: "Puliogare", price: 50, img: puliogareImg },
  { name: "Tea", price: 12, img: teaImg },
];

export default function App() {
  return (
    <div className="app">
      <header className="site-header">
        <div className="site-header__inner">
          <div className="site-header__logo">
            <img src={logo} alt="Namma Idli logo" />
          </div>
          <h1 className="site-header__title">Namma Idli</h1>
          <span className="site-header__tag">Open Now</span>
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
              <div className="card__art">
                <img src={item.img} alt={`${item.name} illustration`} />
              </div>
              <div className="card__body">
                <h3 className="card__name">{item.name}</h3>
                <span className="card__price">₹{item.price}</span>
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
    </div>
  );
}
