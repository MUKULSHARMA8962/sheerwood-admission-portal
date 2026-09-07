import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useLocation, useNavigate } from "react-router-dom";
import { getDefaultRouteForRole } from "../auth/cognito";
import { useCognitoAuth } from "../auth/useCognitoAuth";
import { ROUTES } from "../constants/routes";
import { canRoleOpenPath } from "./routeAccess";

export default function OidcReturnRedirect() {
  const auth = useAuth();
  const { user } = useCognitoAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = auth.user?.state?.returnTo;
  const hasSigninState = Boolean(auth.user?.state);

  useEffect(() => {
    if (!auth.isAuthenticated || !hasSigninState || location.pathname !== ROUTES.home) return;

    const destination = typeof returnTo === "string" && canRoleOpenPath(user?.role, returnTo)
      ? returnTo
      : getDefaultRouteForRole(user?.role);
    navigate(destination, { replace: true });
  }, [auth.isAuthenticated, hasSigninState, location.pathname, navigate, returnTo, user?.role]);

  return null;
}
