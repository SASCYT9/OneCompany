import { redirect } from "next/navigation";

/** New customers are created in a side panel over the list. */
export default function AdminNewCustomerPage() {
  redirect("/admin/shop/customers?new=1");
}
