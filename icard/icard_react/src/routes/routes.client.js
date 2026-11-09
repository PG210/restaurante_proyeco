import { ClientLayout } from "../layouts";
import { Error404 } from "../pages";
import { Home } from "../pages/Client";

const routesClient = [
  {
    path: "/",
    layout: ClientLayout,
    component: Home,
  },
  {
    path: "*",
    layout: ClientLayout,
    component: Error404,
  },
];

export default routesClient;
