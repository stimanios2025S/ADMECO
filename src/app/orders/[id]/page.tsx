import { redirect } from "next/navigation";
export default function LegacyOrderRedirect({ params }: { params: { id: string } }) {
  redirect("/admin/orders");
}
