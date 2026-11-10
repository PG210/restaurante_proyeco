import React from "react";
import { Route, Routes } from "react-router-dom";
import { Message } from "semantic-ui-react";
import { CustomerCart } from "./CustomerCart";
import { CustomerCategory } from "./CustomerCategory";
import { CustomerMenu } from "./CustomerMenu";
import { CustomerOrders } from "./CustomerOrders";

export function CustomerApp() {
  return (
    <Routes>
      <Route index element={<CustomerMenu />} />
      <Route path="category/:categoryId" element={<CustomerCategory />} />
      <Route path="cart" element={<CustomerCart />} />
      <Route path="orders" element={<CustomerOrders />} />
      <Route path="*" element={<Message warning content="Esta página no existe." />} />
    </Routes>
  );
}
