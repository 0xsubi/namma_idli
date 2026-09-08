import { useState } from "react";
import { api } from "./api.js";
import { setToken, logout } from "./auth.js";

export default function Login({ onSuccess }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setChecking(true);
    setToken(value);
    try {
      await api.listItems();
      onSuccess();
    } catch (err) {
      logout();
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="panel login-panel" onSubmit={handleSubmit}>
        <div className="site-header__logo login-panel__logo">
          <img src="/namma-idli-new.svg" alt="Namma Idli" />
        </div>
        <h3>Admin Access</h3>
        <div className="field">
          <label htmlFor="admin-token">Token</label>
          <input
            id="admin-token"
            type="password"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter access token"
          />
        </div>
        {error && <div className="msg msg--error">{error}</div>}
        <button type="submit" className="btn btn--primary" disabled={checking}>
          {checking ? "Checking..." : "Enter"}
        </button>
      </form>
    </div>
  );
}
