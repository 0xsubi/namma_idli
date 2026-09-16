import { useEffect, useState } from "react";
import OrdersPage from "./pages/OrdersPage.jsx";
import BillsPage from "./pages/BillsPage.jsx";
import SalesPage from "./pages/SalesPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import ItemsPage from "./pages/ItemsPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import Login from "./Login.jsx";
import ChangePasswordModal from "./ChangePasswordModal.jsx";
import { fetchMe, isAdmin, logout, setUser } from "./auth.js";
import { setUnauthorizedHandler } from "./api.js";

const TABS = [
  { id: "orders", label: "Orders", component: OrdersPage },
  { id: "bills", label: "Bills", component: BillsPage },
  { id: "items", label: "Items", component: ItemsPage },
  { id: "sales", label: "Sales", component: SalesPage },
  { id: "analytics", label: "Analytics", component: AnalyticsPage },
  { id: "team", label: "Team", component: UsersPage, adminOnly: true },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("bills");
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => setAuthed(false));
    fetchMe().then((user) => {
      setAuthed(!!user);
      setChecking(false);
    });
  }, []);

  if (checking) {
    return null;
  }

  if (!authed) {
    return (
      <Login
        onSuccess={(user) => {
          setUser(user);
          setAuthed(true);
        }}
      />
    );
  }

  const tabs = TABS.filter((tab) => !tab.adminOnly || isAdmin());
  const Active = (tabs.find((t) => t.id === activeTab) || tabs[0]).component;

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
            onClick={() => setShowChangePassword(true)}
          >
            Change Password
          </button>
          <button
            className="btn btn--sm site-header__logout"
            onClick={async () => {
              await logout();
              setAuthed(false);
            }}
          >
            Log out
          </button>
        </div>
      </header>

      <nav className="admin-nav">
        <div className="admin-nav__inner">
          {tabs.map((tab) => (
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

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}
