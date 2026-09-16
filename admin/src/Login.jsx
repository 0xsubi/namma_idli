import { useState } from "react";
import { api } from "./api.js";

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setChecking(true);
    try {
      const user = await api.login(username, password);
      onSuccess(user);
    } catch (err) {
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
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
        </div>
        {error && <div className="msg msg--error">{error}</div>}
        <button type="submit" className="btn btn--primary" disabled={checking}>
          {checking ? "Checking..." : "Log in"}
        </button>
      </form>
    </div>
  );
}
