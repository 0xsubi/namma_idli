import { useState } from "react";
import OrdersPage from "./pages/OrdersPage.jsx";
import BillsPage from "./pages/BillsPage.jsx";
import SalesPage from "./pages/SalesPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import ItemsPage from "./pages/ItemsPage.jsx";
import Login from "./Login.jsx";
import { isAuthed, logout } from "./auth.js";

const TABS = [
  { id: "orders", label: "Orders", component: OrdersPage },
  { id: "bills", label: "Bills", component: BillsPage },
  { id: "items", label: "Items", component: ItemsPage },
  { id: "sales", label: "Sales", component: SalesPage },
  { id: "analytics", label: "Analytics", component: AnalyticsPage },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("bills");
  const [authed, setAuthed] = useState(isAuthed());
  const Active = TABS.find((t) => t.id === activeTab).component;

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="app">
      <header className="site-header">
        <div className="site-header__inner">
          <div className="site-header__logo">
            <img src="/namma-idli-new.svg" alt="Namma Idli" />
          </div>
          <span className="site-header__title">Namma Idli Admin</span>
          <span className="site-header__badge">Staff Only</span>
          <button
            className="btn btn--sm site-header__logout"
            onClick={() => {
              logout();
              setAuthed(false);
            }}
          >
            Log out
          </button>
        </div>
      </header>

      <nav className="admin-nav">
        <div className="admin-nav__inner">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn${activeTab === tab.id ? " is-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="main">
        <Active />
      </main>
    </div>
  );
}
