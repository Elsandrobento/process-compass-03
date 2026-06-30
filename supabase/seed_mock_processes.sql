-- Script para gerar 20 processos fictícios para o Dashboard

DO $$
DECLARE
  v_user_id UUID;
  v_i INT;
  v_type public.process_type;
  v_prio public.process_priority;
  v_status public.process_status;
  v_step public.process_step_kind;
  v_title TEXT;
  v_desc TEXT;
BEGIN
  -- Escolher o primeiro utilizador registado para ser o dono dos processos
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum utilizador encontrado no sistema. Por favor, regista-te primeiro.';
  END IF;

  FOR v_i IN 1..20 LOOP
    -- Alternar os tipos e prioridades de forma pseudo-aleatória
    v_type := CASE (v_i % 4) 
      WHEN 0 THEN 'pagamento'::public.process_type 
      WHEN 1 THEN 'patrimonio'::public.process_type 
      WHEN 2 THEN 'rh'::public.process_type 
      ELSE 'outros'::public.process_type 
    END;
    
    v_prio := CASE (v_i % 3) 
      WHEN 0 THEN 'alta'::public.process_priority 
      WHEN 1 THEN 'media'::public.process_priority 
      ELSE 'baixa'::public.process_priority 
    END;

    -- Alternar o status e passo do processo
    IF v_i <= 5 THEN
      v_status := 'pendente'; v_step := 'criador';
      v_title := 'Aquisição de material informático (Fase ' || v_i || ')';
      v_desc := 'Processo para aquisição de novos computadores para o departamento.';
    ELSIF v_i <= 10 THEN
      v_status := 'em_analise'; v_step := 'adjunta';
      v_title := 'Pagamento de Fornecedores ' || v_i;
      v_desc := 'Fatura referente a serviços de limpeza do mês anterior.';
    ELSIF v_i <= 14 THEN
      v_status := 'em_analise'; v_step := 'presidente';
      v_title := 'Aprovação de Orçamento Anual - ' || v_i;
      v_desc := 'Orçamento destinado à formação de quadros.';
    ELSIF v_i <= 17 THEN
      v_status := 'em_pagamento'; v_step := 'pagamento';
      v_title := 'Transferência Bancária - ' || v_i;
      v_desc := 'Ordem de saque para pagamento ao fornecedor XPTO.';
    ELSIF v_i <= 19 THEN
      v_status := 'concluido'; v_step := 'assinatura_carta';
      v_title := 'Processo Finalizado ' || v_i;
      v_desc := 'Este processo já passou por todos os passos e encontra-se concluído.';
    ELSE
      v_status := 'devolvido'; v_step := 'criador';
      v_title := 'Processo Rejeitado e Devolvido';
      v_desc := 'Faltavam documentos de suporte na candidatura.';
    END IF;

    -- Inserir o processo na base de dados
    INSERT INTO public.processes (
      title, type, department, description, priority, 
      status, current_step, created_by, current_user_id
    ) VALUES (
      v_title, v_type, 'Geral', v_desc, v_prio,
      v_status, v_step, v_user_id, v_user_id
    );

  END LOOP;
END $$;
