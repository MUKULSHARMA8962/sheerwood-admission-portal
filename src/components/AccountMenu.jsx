import { useState } from "react";
import { useCognitoAuth } from "../auth/useCognitoAuth";
import "./AccountMenu.css";

export default function AccountMenu() {
  const { user, signOut } = useCognitoAuth();
  const [open, setOpen] = useState(false);
  const initials = user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "SP";

  return <div className="account-menu">
    <span className="account-session">Academic session <b>2027–28</b></span>
    <button className="account-avatar" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label="Open account menu">{initials}</button>
    {open && <div className="account-dropdown">
      <strong>{user?.name || "School account"}</strong>
      <small>{user?.email || "Authenticated with Cognito"}</small>
      <span className="account-role">{user?.role || "user"}</span>
      <button type="button" onClick={signOut}>Logout</button>
    </div>}
  </div>;
}
