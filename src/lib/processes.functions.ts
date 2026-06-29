import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// New flow: criador → (quarto opcional) → adjunta → diretor_geral → presidente → pagamento
const FLOW_ORDER = ["criador", "quarto", "adjunta", "diretor_geral", "presidente", "pagamento"] as const;
type StepKind =
  | "criador"
  | "quarto"
  | "adjunta"
  | "diretor_geral"
  | "presidente"
  | "pagamento"
  // legacy values still present in DB
  | "chefe"
  | "diretor"
  | "arquivo";

type ProcStatus =
  | "pendente"
  | "em_analise"
  | "aprovado"
  | "rejeitado"
  | "devolvido"
  | "concluido"
  | "em_pagamento";

function advance(current: StepKind, hasQuarto: boolean): StepKind {
  switch (current) {
    case "criador":
      return hasQuarto ? "quarto" : "adjunta";
    case "quarto":
      return "adjunta";
    case "adjunta":
      return "diretor_geral";
    case "diretor_geral":
      return "presidente";
    case "presidente":
      return "pagamento";
    default:
      // legacy fallback
      return "adjunta";
  }
}

// ---------- Create
const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  type: z.enum(["pagamento", "patrimonio", "rh", "outros"]),
  department: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(["baixa", "media", "alta"]),
  recipient_id: z.string().uuid(), // primeiro responsável (4º parecer ou Adjunta)
  quarto_user_id: z.string().uuid().optional(), // se presente, fluxo inicia no 4º parecer
  attachments: z
    .array(z.object({ file_path: z.string(), file_name: z.string(), mime_type: z.string().optional(), size_bytes: z.number().optional() }))
    .optional(),
});

export const createProcess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const hasQuarto = !!data.quarto_user_id;
    const firstStep: StepKind = hasQuarto ? "quarto" : "adjunta";

    const { data: proc, error } = await supabase
      .from("processes")
      .insert({
        title: data.title,
        type: data.type,
        department: data.department,
        description: data.description ?? null,
        priority: data.priority,
        status: "em_analise",
        current_step: firstStep,
        current_user_id: data.recipient_id,
        quarto_user_id: data.quarto_user_id ?? null,
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
    action: z.enum(["favoravel", "nao_favoravel", "devolver", "reenviar"]),
    comment: z.string().trim().max(2000).optional(),
    next_user_id: z.string().uuid().optional(),
  })
  .refine(
    (d) => d.action === "favoravel" || d.action === "reenviar" || (d.comment && d.comment.length >= 3),
    { message: "Comentário obrigatório para parecer não favorável ou devolução", path: ["comment"] },
  );

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
    if (proc.status === "concluido" || proc.status === "rejeitado" || proc.status === "em_pagamento") {
      throw new Error("Processo já encerrado");
    }
    if (proc.current_user_id !== userId) {
      throw new Error("Apenas o responsável atual pode tomar decisões");
    }

    const currentStep = proc.current_step as StepKind;
    const hasQuarto = !!proc.quarto_user_id;

    let newStatus: ProcStatus = proc.status as ProcStatus;
    let newStep: StepKind = currentStep;
    let newCurrent: string | null = proc.current_user_id;
    let action: "favoravel" | "nao_favoravel" | "devolvido" | "reenviado" | "concluido" | "rejeitado" = "favoravel";
    let notifyMsg = "";

    const isDirector = currentStep === "quarto" || currentStep === "adjunta" || currentStep === "diretor_geral";
    const isPresident = currentStep === "presidente";
    const isCreatorResubmitting = proc.status === "devolvido" && currentStep === "criador";

    if (data.action === "reenviar") {
      // Criador reenvia processo devolvido: continua para Adjunta (ou 4º se ainda não passou)
      if (!isCreatorResubmitting) throw new Error("Só é possível reenviar um processo devolvido");
      if (!data.next_user_id) throw new Error("Selecione o próximo responsável");
      action = "reenviado";
      newStep = hasQuarto ? "quarto" : "adjunta";
      newStatus = "em_analise";
      newCurrent = data.next_user_id;
      notifyMsg = `Processo ${proc.numero} reenviado após correcções`;
    } else if (data.action === "favoravel") {
      if (isPresident) {
        // Presidente favorável → concluído, vai para pagamento
        action = "concluido";
        newStep = "pagamento";
        newStatus = "em_pagamento";
        newCurrent = null;
        notifyMsg = `Processo ${proc.numero} aprovado pelo Presidente — em pagamento`;
      } else {
        if (!data.next_user_id) throw new Error("Selecione o próximo responsável");
        action = "favoravel";
        newStep = advance(currentStep, hasQuarto);
        newStatus = "em_analise";
        newCurrent = data.next_user_id;
        notifyMsg = `Processo ${proc.numero} encaminhado com parecer favorável`;
      }
    } else if (data.action === "nao_favoravel") {
      if (isPresident) {
        // Presidente não favorável → rejeitado
        action = "rejeitado";
        newStatus = "rejeitado";
        newCurrent = proc.created_by;
        newStep = currentStep;
        notifyMsg = `Processo ${proc.numero} rejeitado pelo Presidente`;
      } else if (isDirector) {
        // Directores podem dar não favorável, mas processo segue até o Presidente
        if (!data.next_user_id) throw new Error("Selecione o próximo responsável");
        action = "nao_favoravel";
        newStep = advance(currentStep, hasQuarto);
        newStatus = "em_analise";
        newCurrent = data.next_user_id;
        notifyMsg = `Processo ${proc.numero}: parecer não favorável registado, segue para próxima etapa`;
      } else {
        throw new Error("Acção não permitida nesta etapa");
      }
    } else {
      // devolver: directores podem devolver para criador corrigir
      if (!isDirector && !isPresident) throw new Error("Acção não permitida nesta etapa");
      action = "devolvido";
      newStatus = "devolvido";
      newCurrent = proc.created_by;
      newStep = "criador";
      notifyMsg = `Processo ${proc.numero} devolvido para correcção`;
    }

    await supabase.from("process_steps").insert({
      process_id: proc.id,
      from_user: userId,
      to_user: newCurrent,
      action,
      comment: data.comment ?? null,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("processes")
      .update({
        status: newStatus,
        current_step: newStep,
        current_user_id: newCurrent,
      })
      .eq("id", proc.id);
    
    if (updateError) throw new Error("Erro ao atualizar o processo: " + updateError.message);

    if (newCurrent) {
      await supabase.from("notifications").insert({
        user_id: newCurrent,
        process_id: proc.id,
        message: notifyMsg,
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
      .not("status", "in", "(concluido,rejeitado,em_pagamento)")
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
      .in("status", ["concluido", "rejeitado", "em_pagamento"])
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
      supabase.from("processes").select("id", { count: "exact", head: true }).eq("current_user_id", userId).not("status", "in", "(concluido,rejeitado,em_pagamento)"),
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
