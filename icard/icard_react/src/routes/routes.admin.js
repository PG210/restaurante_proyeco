import { AdminLayout } from "../layouts";
import {
  AvailabilityAdmin,
  BillTicket,
  CategoriesAdmin,
  KitchenAdmin,
  LabelsAdmin,
  ModifiersAdmin,
  OrdersAdmin,
  PaymentsHistory,
  PermissionsAdmin,
  ProductAdmin,
  SettingsAdmin,
  TableDetailsAdmin,
  TablesAdmin,
  TablesQrPrint,
  UsersAdmin,
} from "../pages/Admin";
import { ADMIN_SECTIONS } from "../utils/adminSections";

const routesAdmin = [
  { ...ADMIN_SECTIONS.orders, layout: AdminLayout, component: OrdersAdmin },
  { ...ADMIN_SECTIONS.tableDetail, layout: AdminLayout, component: TableDetailsAdmin },
  { ...ADMIN_SECTIONS.kitchen, layout: AdminLayout, component: KitchenAdmin },
  { ...ADMIN_SECTIONS.paymentsHistory, layout: AdminLayout, component: PaymentsHistory },
  { ...ADMIN_SECTIONS.billTicket, layout: AdminLayout, component: BillTicket },
  { ...ADMIN_SECTIONS.availability, layout: AdminLayout, component: AvailabilityAdmin },
  { ...ADMIN_SECTIONS.tables, layout: AdminLayout, component: TablesAdmin },
  { ...ADMIN_SECTIONS.tablesQr, layout: AdminLayout, component: TablesQrPrint },
  { ...ADMIN_SECTIONS.categories, layout: AdminLayout, component: CategoriesAdmin },
  { ...ADMIN_SECTIONS.products, layout: AdminLayout, component: ProductAdmin },
  { ...ADMIN_SECTIONS.modifiers, layout: AdminLayout, component: ModifiersAdmin },
  { ...ADMIN_SECTIONS.labels, layout: AdminLayout, component: LabelsAdmin },
  { ...ADMIN_SECTIONS.users, layout: AdminLayout, component: UsersAdmin },
  { ...ADMIN_SECTIONS.permissions, layout: AdminLayout, component: PermissionsAdmin },
  { ...ADMIN_SECTIONS.settings, layout: AdminLayout, component: SettingsAdmin },
];

export default routesAdmin;
