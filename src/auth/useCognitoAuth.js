import { useContext } from "react";
import { CognitoAuthContext } from "./CognitoAuthContext";

export function useCognitoAuth() {
  const context = useContext(CognitoAuthContext);
  if (!context) throw new Error("useCognitoAuth must be used inside CognitoAuthProvider.");
  return context;
}
