import ParentDashboard from "./Parent_Dashboard/Parent_Dashboard";

export default function AdmissionDetails({ user, signOut }) {
  return <ParentDashboard user={user} signOut={signOut} />;
}
