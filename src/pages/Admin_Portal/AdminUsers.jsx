import { useEffect, useState } from "react";
import { createAdminUser, getAdminUsers, updateAdminUserRole } from "../../services/api";
import { useCognitoAuth } from "../../auth/useCognitoAuth";

const emptyUserForm = { full_name: "", email: "", role: "parent", password: "" };

export default function AdminUsers({ setNotice }) {
  const { session } = useCognitoAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState(emptyUserForm);

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

  async function createUser(event) {
    event.preventDefault();
    try {
      const created = await createAdminUser(session.accessToken, newUser);
      setUsers((current) => [created, ...current]);
      setNewUser(emptyUserForm);
      setShowCreateForm(false);
      const passwordNotice = created.temporary_password ? ` Temporary password: ${created.temporary_password}` : "";
      setNotice(`${created.full_name} was added to ${created.role}.${passwordNotice}`);
    } catch (reason) {
      setError(reason.message);
    }
  }

  return <>
    <header className="admin-feature-heading"><div><p>ACCESS CONTROL</p><h1>Users &amp; Roles</h1><small>Manage database users and their portal roles.</small></div><button className="admin-feature-button" type="button" onClick={() => setShowCreateForm((value) => !value)}>＋ New user</button></header>
    <section className="admin-feature-card role-table">
      <header><div><p>DATABASE USERS</p><h2>User role assignments</h2></div><span>{users.length} loaded</span></header>
      {showCreateForm && <form className="admin-user-create" onSubmit={createUser}><input value={newUser.full_name} onChange={(event) => setNewUser((current) => ({ ...current, full_name: event.target.value }))} placeholder="Full name" required /><input type="email" value={newUser.email} onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))} placeholder="Email address" required /><select value={newUser.role} onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value }))}><option value="parent">Parent</option><option value="teacher">Teacher</option><option value="student">Student</option><option value="admin">Admin</option><option value="admission">Admission</option></select><input type="password" value={newUser.password} onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))} placeholder="Optional password (8+ chars)" minLength={8} /><div className="admin-user-actions"><button type="submit">Create user</button><button type="button" className="outline" onClick={() => setShowCreateForm(false)}>Cancel</button></div></form>}
      {error && <p className="admin-inline-error">{error}</p>}
      {loading ? <p className="admin-inline-loading">Loading users...</p> : users.length === 0 ? <p className="admin-inline-loading">No database users found.</p> : users.map((user) => <article key={user.id}>
        <i>{user.full_name?.slice(0, 1) || "U"}</i>
        <div className="admin-user-fields"><small>ID: {user.id}</small><input value={user.full_name || ""} onChange={(event) => editUser(user.id, "full_name", event.target.value)} aria-label={`Edit name for ${user.full_name}`} /><input type="email" value={user.email || ""} onChange={(event) => editUser(user.id, "email", event.target.value)} aria-label={`Edit email for ${user.full_name}`} /><span>{user.status || (user.cognito_subject ? "Cognito linked" : "Database account")}</span></div>
        <em>{user.role}</em>
        <div className="admin-user-actions"><select value={user.role} onChange={(event) => editUser(user.id, "role", event.target.value)} aria-label={`Change role for ${user.full_name}`}><option value="parent">Parent</option><option value="teacher">Teacher</option><option value="student">Student</option><option value="admin">Admin</option><option value="admission">Admission</option><option value="vendor">Vendor</option></select><button type="button" onClick={() => saveUser(user)}>Save</button></div>
      </article>)}
    </section>
  </>;
}
