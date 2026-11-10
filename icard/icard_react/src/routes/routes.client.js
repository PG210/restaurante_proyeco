import { ClientLayout, CustomerLayout } from "../layouts";
import { Error404 } from "../pages";
import { Home } from "../pages/Client";
import { CustomerApp } from "../pages/Customer";

export const CUSTOMER_APP_PATH = "/client/:token/*";

const routesClient = [
  {
    path: "/",
    layout: ClientLayout,
    component: Home,
  },
  {
    path: CUSTOMER_APP_PATH,
    layout: CustomerLayout,
    component: CustomerApp,
  },
  {
    path: "*",
    layout: ClientLayout,
    component: Error404,
  },
];

export default routesClient;
