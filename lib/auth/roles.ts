import type { Role } from "@/types";

export const rolePermissions: Record<Role, string[]> = {
  admin: ["manage_creators", "manage_deals", "manage_payments", "scan_contracts", "run_ai"],
  creator: ["view_profile", "view_deals", "submit_deliverables"],
  brand: ["view_invited_deals", "fund_deals", "view_freelancers"],
  freelancer: ["view_profile", "manage_portfolio", "view_assigned_projects"]
};
