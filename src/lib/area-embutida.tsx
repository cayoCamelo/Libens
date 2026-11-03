import { createContext, useContext, type ReactNode } from "react";
const AreaContext = createContext(false);
export function AreaEmbutida({ children }: { children: ReactNode }) {
  return <AreaContext.Provider value={true}>{children}</AreaContext.Provider>;
}
export function useAreaEmbutida() {
  return useContext(AreaContext);
}
