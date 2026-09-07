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

  function editUser(userId, field, value) {
    setUsers((current) => current.map((user) => user.id === userId ? { ...user, [field]: value } : user));
  }

  async function saveUser(user) {
    try {
      const updated = await updateAdminUserRole(session.accessToken, user.id, user);
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, ...updated } : item));
      setNotice(`${updated.full_name}'s details and role were saved.`);
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
        <div className="admin-user-fields"><small>ID: {user.id}</small><input value={user.full_name || ""} onChange={(event) => editUser(user.id, "full_name", event.target.value)} aria-label={`Edit name for ${user.full_name}`} /><input type="email" value={user.email || ""} onChange={(event) => editUser(user.id, "email", event.target.value)} aria-label={`Edit email for ${user.full_name}`} /><span>{user.status || (user.cognito_subject ? "Cognito linked" : "Database account")}</span></div>
        <em>{user.role}</em>
        <div className="admin-user-actions"><select value={user.role} onChange={(event) => editUser(user.id, "role", event.target.value)} aria-label={`Change role for ${user.full_name}`}><option value="parent">Parent</option><option value="teacher">Teacher</option><option value="student">Student</option><option value="admin">Admin</option><option value="admission">Admission</option></select><button type="button" onClick={() => saveUser(user)}>Save</button></div>
      </article>)}
    </section>
  </>;
}
