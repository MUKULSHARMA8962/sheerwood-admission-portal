import { useEffect, useState } from "react";
import { getAdminUsers, updateAdminUserRole } from "../../services/api";
import { useCognitoAuth } from "../../auth/useCognitoAuth";

export default function AdminUsers({ setNotice }) {
  const { session } = useCognitoAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminUsers(session?.accessToken)
      .then(setUsers)
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [session?.accessToken]);

  async function changeRole(userId, role) {
    try {
      const updated = await updateAdminUserRole(session.accessToken, userId, role);
      setUsers((current) => current.map((user) => user.id === userId ? updated : user));
      setNotice(`${updated.full_name}'s role changed to ${role}.`);
    } catch (reason) {
      setError(reason.message);
    }
  }

  return <>
    <header className="admin-feature-heading"><div><p>ACCESS CONTROL</p><h1>Users &amp; Roles</h1><small>Manage database users and their portal roles.</small></div></header>
    <section className="admin-feature-card role-table">
      <header><div><p>DATABASE USERS</p><h2>User role assignments</h2></div><span>{users.length} loaded</span></header>
      {error && <p className="admin-inline-error">{error}</p>}
      {loading ? <p className="admin-inline-loading">Loading users...</p> : users.length === 0 ? <p className="admin-inline-loading">No database users found.</p> : users.map((user) => <article key={user.id}>
        <i>{user.full_name?.slice(0, 1) || "U"}</i>
        <div><b>{user.full_name}<small>{user.email}</small></b><span>{user.cognito_subject ? "Cognito linked" : "Database account"}</span></div>
        <em>{user.role}</em>
        <select value={user.role} onChange={(event) => changeRole(user.id, event.target.value)} aria-label={`Change role for ${user.full_name}`}>
          <option value="parent">Parent</option><option value="teacher">Teacher</option><option value="admin">Admin</option>
        </select>
      </article>)}
    </section>
  </>;
}
