import RequireCognitoAuth from "../auth/RequireCognitoAuth";

export function Protected({ children, roles }) {
  return <RequireCognitoAuth roles={roles}>{children}</RequireCognitoAuth>;
}
