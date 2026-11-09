import { AdminLayout } from "../layouts";
import {
  CategoriesAdmin,
  KitchenAdmin,
  OrdersAdmin,
  PermissionsAdmin,
  ProductAdmin,
  TableDetailsAdmin,
  TablesAdmin,
  UsersAdmin,
} from "../pages/Admin";
import { ADMIN_SECTIONS } from "../utils/adminSections";

const routesAdmin = [
  { ...ADMIN_SECTIONS.orders, layout: AdminLayout, component: OrdersAdmin },
  { ...ADMIN_SECTIONS.tableDetail, layout: AdminLayout, component: TableDetailsAdmin },
  { ...ADMIN_SECTIONS.kitchen, layout: AdminLayout, component: KitchenAdmin },
  { ...ADMIN_SECTIONS.tables, layout: AdminLayout, component: TablesAdmin },
  { ...ADMIN_SECTIONS.categories, layout: AdminLayout, component: CategoriesAdmin },
  { ...ADMIN_SECTIONS.products, layout: AdminLayout, component: ProductAdmin },
  { ...ADMIN_SECTIONS.users, layout: AdminLayout, component: UsersAdmin },
  { ...ADMIN_SECTIONS.permissions, layout: AdminLayout, component: PermissionsAdmin },
];

export default routesAdmin;
