import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FLOW_ORDER = ["chefe", "diretor", "diretor_geral", "arquivo"] as const;
type StepKind = (typeof FLOW_ORDER)[number] | "criador";

function nextStep(current: StepKind): StepKind {
  const idx = FLOW_ORDER.indexOf(current as Exclude<StepKind, "criador">);
  if (idx === -1) return "chefe";
  return FLOW_ORDER[idx + 1] ?? "arquivo";
}

// ---------- Create
const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  type: z.enum(["pagamento", "patrimonio", "rh", "outros"]),
  department: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(["baixa", "media", "alta"]),
  recipient_id: z.string().uuid(),
  attachments: z
    .array(z.object({ file_path: z.string(), file_name: z.string(), mime_type: z.string().optional(), size_bytes: z.number().optional() }))
    .optional(),
});

export const createProcess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: proc, error } = await supabase
      .from("processes")
      .insert({
        title: data.title,
        type: data.type,
        department: data.department,
        description: data.description ?? null,
        priority: data.priority,
        status: "pendente",
        current_step: "chefe",
        current_user_id: data.recipient_id,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("process_steps").insert({
      process_id: proc.id,
      from_user: userId,
      to_user: data.recipient_id,
      action: "criado",
      comment: null,
    });

    if (data.attachments?.length) {
      await supabase.from("attachments").insert(
        data.attachments.map((a) => ({
          process_id: proc.id,
          file_path: a.file_path,
          file_name: a.file_name,
          mime_type: a.mime_type ?? null,
          size_bytes: a.size_bytes ?? null,
          uploaded_by: userId,
        })),
      );
    }

    await supabase.from("notifications").insert({
      user_id: data.recipient_id,
      process_id: proc.id,
      message: `Novo processo ${proc.numero}: ${proc.title}`,
    });

    return proc;
  });

// ---------- Decision
const decisionSchema = z
  .object({
    process_id: z.string().uuid(),
    action: z.enum(["favoravel", "nao_favoravel", "devolver"]),
    comment: z.string().trim().max(2000).optional(),
    next_user_id: z.string().uuid().optional(),
  })
  .refine((d) => d.action === "favoravel" || (d.comment && d.comment.length >= 3), {
    message: "Comentário obrigatório para rejeição ou devolução",
    path: ["comment"],
  });

export const submitDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => decisionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: proc, error: pErr } = await supabase
      .from("processes")
      .select("*")
      .eq("id", data.process_id)
      .single();
    if (pErr || !proc) throw new Error("Processo não encontrado");
    if (proc.status === "concluido" || proc.status === "rejeitado") {
      throw new Error("Processo já encerrado");
    }
    if (proc.current_user_id !== userId) {
      throw new Error("Apenas o responsável atual pode tomar decisões");
    }

    let newStatus: "pendente" | "em_analise" | "aprovado" | "rejeitado" | "devolvido" | "concluido" = proc.status;
    let newStep = proc.current_step as StepKind;
    let newCurrent: string | null = proc.current_user_id;
    let action: "favoravel" | "nao_favoravel" | "devolvido" | "arquivado" = "favoravel";


    if (data.action === "favoravel") {
      action = "favoravel";
      const next = nextStep(proc.current_step as StepKind);
      if (next === "arquivo") {
        newStep = "arquivo";
        newStatus = "concluido";
        newCurrent = null;
      } else {
        if (!data.next_user_id) throw new Error("Selecione o próximo responsável");
        newStep = next;
        newStatus = "em_analise";
        newCurrent = data.next_user_id;
      }
    } else if (data.action === "nao_favoravel") {
      action = "nao_favoravel";
      newStatus = "rejeitado";
      newCurrent = proc.created_by;
    } else {
      action = "devolvido";
      newStatus = "devolvido";
      // return to previous from_user
      const { data: lastStep } = await supabase
        .from("process_steps")
        .select("from_user")
        .eq("process_id", proc.id)
        .neq("from_user", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      newCurrent = lastStep?.from_user ?? proc.created_by;
    }

    await supabase.from("process_steps").insert({
      process_id: proc.id,
      from_user: userId,
      to_user: newCurrent,
      action,
      comment: data.comment ?? null,
    });

    await supabase
      .from("processes")
      .update({
        status: newStatus,
        current_step: newStep,
        current_user_id: newCurrent,
      })
      .eq("id", proc.id);

    if (newCurrent) {
      await supabase.from("notifications").insert({
        user_id: newCurrent,
        process_id: proc.id,
        message: `Processo ${proc.numero} requer a sua atenção (${action})`,
      });
    }

    return { ok: true };
  });

// ---------- Lists
export const listMyInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("processes")
      .select("*")
      .eq("current_user_id", userId)
      .not("status", "in", "(concluido,rejeitado)")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const listCreatedByMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("processes")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const listArchive = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("processes")
      .select("*")
      .in("status", ["concluido", "rejeitado"])
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data;
  });

export const dashboardCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [pending, created, done, returned] = await Promise.all([
      supabase.from("processes").select("id", { count: "exact", head: true }).eq("current_user_id", userId).not("status", "in", "(concluido,rejeitado)"),
      supabase.from("processes").select("id", { count: "exact", head: true }).eq("created_by", userId),
      supabase.from("processes").select("id", { count: "exact", head: true }).eq("created_by", userId).eq("status", "concluido"),
      supabase.from("processes").select("id", { count: "exact", head: true }).eq("created_by", userId).eq("status", "devolvido"),
    ]);
    return {
      pending: pending.count ?? 0,
      created: created.count ?? 0,
      done: done.count ?? 0,
      returned: returned.count ?? 0,
    };
  });

export const searchProcesses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const q = data.q;
    let query = supabase.from("processes").select("*").order("created_at", { ascending: false }).limit(100);
    if (q) {
      query = query.or(`title.ilike.%${q}%,numero.ilike.%${q}%,department.ilike.%${q}%`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows;
  });

// ---------- Process detail
export const getProcessDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: proc, error: e1 }, { data: steps }, { data: attachments }] = await Promise.all([
      supabase.from("processes").select("*").eq("id", data.id).single(),
      supabase.from("process_steps").select("*").eq("process_id", data.id).order("created_at", { ascending: true }),
      supabase.from("attachments").select("*").eq("process_id", data.id).order("created_at", { ascending: true }),
    ]);
    if (e1 || !proc) throw new Error("Processo não encontrado");

    const userIds = Array.from(
      new Set(
        [proc.created_by, proc.current_user_id, ...(steps ?? []).flatMap((s) => [s.from_user, s.to_user])].filter(
          (x): x is string => !!x,
        ),
      ),
    );
    const { data: profiles } = await supabase.from("profiles").select("id, nome, email").in("id", userIds);
    const profMap: Record<string, { nome: string; email: string }> = {};
    (profiles ?? []).forEach((p) => (profMap[p.id] = { nome: p.nome, email: p.email }));

    // sign download urls
    const signed: Record<string, string> = {};
    for (const a of attachments ?? []) {
      const { data: s } = await supabase.storage.from("process-attachments").createSignedUrl(a.file_path, 3600);
      if (s?.signedUrl) signed[a.id] = s.signedUrl;
    }

    return { process: proc, steps: steps ?? [], attachments: attachments ?? [], profiles: profMap, signedUrls: signed };
  });

// ---------- Users list (for picking recipients)
export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, email, departamento")
      .neq("id", userId)
      .order("nome");
    if (error) throw new Error(error.message);
    return data;
  });

// ---------- Notifications
export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data;
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    return { ok: true };
  });

// ---------- Upload signed URL
export const createUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ file_name: z.string().min(1).max(255) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const safe = data.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${Date.now()}_${safe}`;
    const { data: signed, error } = await supabase.storage
      .from("process-attachments")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Falha ao gerar URL de upload");
    return { path: signed.path, token: signed.token, url: signed.signedUrl };
  });

// ---------- Admin: list roles + assign
export const listAllUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" as never });
    if (!isAdmin) throw new Error("Apenas administradores");
    const { data: profs } = await supabase.from("profiles").select("id, nome, email, departamento").order("nome");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    return { profiles: profs ?? [], roles: roles ?? [] };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum(["admin", "criador", "validador", "diretor", "diretor_geral", "presidente", "leitura"]),
        grant: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" as never });
    if (!isAdmin) throw new Error("Apenas administradores");
    if (data.grant) {
      await supabase.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    } else {
      await supabase.from("user_roles").delete().eq("user_id", data.user_id).eq("role", data.role);
    }
    return { ok: true };
  });
