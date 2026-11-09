import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import routes from "./routes";
import { RequireAccess } from "./RequireAccess";

export function Navigation() {
  return (
    <BrowserRouter>
      <Routes>
        {routes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <route.layout>
                <RequireAccess route={route}>
                  <route.component />
                </RequireAccess>
              </route.layout>
            }
          />
        ))}
      </Routes>
    </BrowserRouter>
  );
}
