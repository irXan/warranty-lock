import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_SLUG = "warranty-flow";

/** Any signed-in user: reports whether the workshop still needs its first owner. */
export const getWorkshopBootstrapState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("workshop_members")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return { hasOwner: (count ?? 0) > 0 };
  });

/** Members of the caller's workshop can see the team roster. */
export const listWorkshopMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: mine, error: mineErr } = await supabaseAdmin
      .from("workshop_members")
      .select("workshop_id, role")
      .eq("user_id", context.userId);
    if (mineErr) throw mineErr;
    const own = (mine ?? []).find((m) => m.role === "owner") ?? (mine ?? [])[0];
    if (!own) return { role: null as "owner" | "staff" | null, members: [] };

    const { data: rows, error: rowsErr } = await supabaseAdmin
      .from("workshop_members")
      .select("user_id, role, created_at")
      .eq("workshop_id", own.workshop_id)
      .order("created_at", { ascending: true });
    if (rowsErr) throw rowsErr;

    const members = await Promise.all(
      (rows ?? []).map(async (r) => {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
        return {
          userId: r.user_id,
          email: u?.user?.email ?? "(unknown)",
          role: r.role as "owner" | "staff",
          createdAt: r.created_at,
        };
      }),
    );

    return { role: own.role as "owner" | "staff", members };
  });

/** Owner-only: remove a staff member's workshop access and admin role. */
export const revokeWorkshopStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: membership, error: memErr } = await supabaseAdmin
      .from("workshop_members")
      .select("workshop_id")
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .maybeSingle();
    if (memErr) throw memErr;
    if (!membership) throw new Error("Only the workshop owner can revoke access.");
    if (data.userId === context.userId) throw new Error("You can't revoke your own access.");

    const { data: target, error: tErr } = await supabaseAdmin
      .from("workshop_members")
      .select("id, role")
      .eq("workshop_id", membership.workshop_id)
      .eq("user_id", data.userId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!target) throw new Error("That person isn't a member of your workshop.");
    if (target.role === "owner") throw new Error("The workshop owner can't be removed.");

    const { error: delErr } = await supabaseAdmin
      .from("workshop_members")
      .delete()
      .eq("id", target.id);
    if (delErr) throw delErr;

    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "admin");

    return { revoked: data.userId };
  });

/**
 * One-time bootstrap: if no workshop member exists yet, the caller becomes the
 * owner of the default workshop and is granted the admin role.
 */
export const claimWorkshopOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { count, error: countErr } = await supabaseAdmin
      .from("workshop_members")
      .select("id", { count: "exact", head: true });
    if (countErr) throw countErr;
    if ((count ?? 0) > 0) {
      throw new Error("This workshop already has an owner. Ask them to grant you access.");
    }

    const { data: workshop, error: wErr } = await supabaseAdmin
      .from("workshops")
      .select("id")
      .eq("slug", DEFAULT_SLUG)
      .maybeSingle();
    if (wErr) throw wErr;
    if (!workshop) throw new Error("Default workshop is missing.");

    const { error: mErr } = await supabaseAdmin
      .from("workshop_members")
      .insert({ workshop_id: workshop.id, user_id: userId, role: "owner" });
    if (mErr) throw mErr;

    await supabaseAdmin.from("workshops").update({ owner_id: userId }).eq("id", workshop.id);

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (rErr) throw rErr;

    return { workshopId: workshop.id };
  });

/** Owner-only: grant an existing account admin + staff membership by email. */
export const grantWorkshopAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: membership, error: memErr } = await supabaseAdmin
      .from("workshop_members")
      .select("workshop_id, role")
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .maybeSingle();
    if (memErr) throw memErr;
    if (!membership) throw new Error("Only the workshop owner can grant admin access.");

    const email = data.email.trim().toLowerCase();
    let target: { id: string } | undefined;
    for (let page = 1; page <= 20 && !target; page++) {
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (listErr) throw listErr;
      target = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
      if (list.users.length < 200) break;
    }
    if (!target) {
      return {
        granted: null as string | null,
        error: `No account exists for ${email}. Ask them to register with this email first, then grant access.`,
      };
    }

    const { error: insErr } = await supabaseAdmin
      .from("workshop_members")
      .upsert(
        { workshop_id: membership.workshop_id, user_id: target.id, role: "staff" },
        { onConflict: "workshop_id,user_id" },
      );
    if (insErr) throw insErr;

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: target.id, role: "admin" }, { onConflict: "user_id,role" });
    if (roleErr) throw roleErr;

    return { granted: email, error: null as string | null };
  });

const legacyReceiptSchema = z.object({
  trackId: z.string().min(1),
  customerName: z.string().min(1),
  customerPhone: z.string().default(""),
  deviceModel: z.string().default(""),
  serialNumber: z.string().default(""),
  issueDescription: z.string().default(""),
  warrantyDays: z.number().int().positive().default(90),
  createdAt: z.string(),
  currentStatus: z.string(),
  statusHistory: z
    .array(z.object({ status: z.string(), updatedAt: z.string() }))
    .default([]),
});

type StatusName = "Received" | "Diagnosing" | "In Repair" | "Ready for Pickup" | "Delivered";

/** Admin-only one-time import of receipts saved in the browser before the migration. */
export const importLegacyReceipts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ receipts: z.array(legacyReceiptSchema) }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: membership, error: memErr } = await supabaseAdmin
      .from("workshop_members")
      .select("workshop_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (memErr) throw memErr;
    if (!membership) throw new Error("Your account isn't linked to a workshop yet.");

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Only workshop admins can import legacy receipts.");

    let imported = 0;
    let skipped = 0;

    for (const r of data.receipts) {
      const { data: existing } = await supabaseAdmin
        .from("receipts")
        .select("id")
        .eq("track_id", r.trackId)
        .maybeSingle();
      if (existing) {
        skipped++;
        continue;
      }

      const delivered = r.statusHistory.find((s) => s.status === "Delivered");
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("receipts")
        .insert({
          track_id: r.trackId,
          workshop_id: membership.workshop_id,
          customer_name: r.customerName,
          customer_phone: r.customerPhone,
          device_model: r.deviceModel,
          serial_number: r.serialNumber,
          issue_description: r.issueDescription,
          warranty_days: r.warrantyDays,
          current_status: r.currentStatus as StatusName,
          delivered_at: delivered?.updatedAt ?? null,
          created_at: r.createdAt,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      // Replace the trigger-seeded event with the original history.
      await supabaseAdmin.from("status_events").delete().eq("receipt_id", inserted.id);
      const history = r.statusHistory.length
        ? r.statusHistory
        : [{ status: "Received", updatedAt: r.createdAt }];
      const { error: evErr } = await supabaseAdmin.from("status_events").insert(
        history.map((h) => ({
          receipt_id: inserted.id,
          status: h.status as StatusName,
          created_at: h.updatedAt,
          created_by: context.userId,
        })),
      );
      if (evErr) throw evErr;

      // The sync trigger overwrote current_status with the last inserted event;
      // restore the authoritative legacy values.
      await supabaseAdmin
        .from("receipts")
        .update({
          current_status: r.currentStatus as StatusName,
          delivered_at: delivered?.updatedAt ?? null,
        })
        .eq("id", inserted.id);

      imported++;
    }

    return { imported, skipped };
  });
