# Casos de Uso — Sistema Kairos Biblioteca

Este documento descreve os principais casos de uso (UC) do sistema, com
destaque para o controle de devolução de livros com prazo de 14 dias.

---

## UC01 — Realizar Empréstimo (via aprovação de solicitação)

**Ator principal:** Administrador
**Atores secundários:** Usuário (solicitante)
**Pré-condições:** Existe uma solicitação de empréstimo com status `pendente`
e ao menos um exemplar do livro disponível.

**Fluxo principal:**
1. O administrador acessa a lista de solicitações pendentes.
2. O administrador seleciona uma solicitação e escolhe "Aprovar".
3. O sistema localiza um exemplar disponível do livro solicitado.
4. **O sistema calcula automaticamente a data prevista de devolução somando
   14 dias à data atual (data de saída) e grava o empréstimo com status
   `ativo`, associando o usuário, o exemplar e a `DataPrevista` calculada.**
5. O sistema atualiza o status do exemplar para `Emprestado`.
6. O sistema atualiza o status da solicitação para `aprovada`.
7. O sistema registra uma notificação para o usuário informando a aprovação e
   a data de devolução.
8. O sistema exibe a confirmação ao administrador.

**Fluxos alternativos:**
- 3a. Não há exemplar disponível → o sistema informa o erro e não cria o
  empréstimo.
- 4a. O administrador informa manualmente uma data prevista diferente →
  o sistema utiliza a data informada em vez do prazo padrão de 14 dias.

**Pós-condições:** Empréstimo criado com prazo de devolução definido e
visível tanto para o usuário quanto para o administrador.

---

## UC02 — Registrar Empréstimo Direto (administrador)

**Ator principal:** Administrador

**Fluxo principal:**
1. O administrador acessa a tela de gestão de empréstimos e escolhe "Novo
   Empréstimo".
2. O administrador seleciona o usuário e o livro.
3. **O sistema sugere automaticamente o prazo de devolução de 14 dias a
   partir da data atual** (pré-preenchendo o campo de data prevista), podendo
   o administrador ajustar essa data manualmente se necessário.
4. O administrador confirma o cadastro.
5. O sistema grava o empréstimo com status `ativo`, vincula um exemplar
   disponível e persiste a `DataPrevista`.
6. Caso a data prevista resultante esteja a 2 dias ou menos da data atual, o
   sistema já dispara imediatamente a notificação de vencimento próximo
   (ver UC04).

**Pós-condições:** Empréstimo criado e exibido na lista de empréstimos ativos.

---

## UC03 — Consultar Meus Empréstimos (usuário)

**Ator principal:** Usuário

**Fluxo principal:**
1. O usuário acessa a página "Meus Empréstimos".
2. O sistema lista todos os empréstimos do usuário, exibindo para cada um:
   - Nome e capa do livro;
   - Data de retirada;
   - **Data prevista de devolução (prazo de 14 dias);**
   - **Indicador textual de dias restantes para o vencimento ou de dias em
     atraso, deixando explícito que o prazo total do empréstimo é de 14
     dias;**
   - Status (`ativo`, `atrasado` ou `devolvido`).
3. Caso o empréstimo esteja com status `atrasado`, o sistema destaca
   visualmente o item (cor de alerta) e exibe a mensagem de atraso.

**Pós-condições:** Usuário visualiza claramente seus prazos de devolução.

---

## UC04 — Notificar Vencimento Próximo do Prazo

**Ator principal:** Sistema (rotina automática) / Administrador (disparo
manual)

**Pré-condições:** Existe ao menos um empréstimo `ativo` cuja `DataPrevista`
está a 2 dias ou menos da data atual (incluindo o dia do vencimento).

**Fluxo principal:**
1. A rotina diária (às 07h) ou a rota administrativa
   `POST /emprestimo/vencendo/notificar` é executada.
2. O sistema identifica os empréstimos ativos que atendem à condição de
   vencimento próximo.
3. Para cada empréstimo identificado, o sistema:
   a. Envia um email ao usuário informando o título do livro, a data limite
      de devolução e que **o prazo de empréstimo é de 14 dias**;
   b. Persiste uma notificação (tipo `vencimento`) com a mesma informação na
      central de notificações do usuário, caso ainda não exista uma
      notificação desse tipo criada no mesmo dia para aquele empréstimo.
4. O usuário visualiza a notificação ao acessar o sistema (sino de
   notificações) e/ou recebe o email.

**Pós-condições:** Usuário informado sobre o vencimento iminente do prazo.

---

## UC05 — Notificar Empréstimo em Atraso

**Ator principal:** Sistema (rotina automática) / Administrador (disparo
manual)

**Pré-condições:** Existe ao menos um empréstimo com status `atrasado`
(prazo de 14 dias já ultrapassado e devolução não realizada).

**Fluxo principal:**
1. A rotina diária (às 07h) primeiro atualiza o status de empréstimos
   vencidos para `atrasado` (RN05) e, em seguida, executa a verificação de
   atraso; ou o administrador dispara manualmente a rota
   `POST /emprestimo/atrasado/notificar`.
2. O sistema identifica todos os empréstimos com status `atrasado`.
3. Para cada empréstimo identificado, o sistema:
   a. Calcula há quantos dias o prazo está vencido;
   b. Envia um email ao usuário deixando claro que **o prazo de empréstimo
      era de 14 dias**, qual era a data prevista de devolução e que a
      devolução está pendente;
   c. Persiste uma notificação (tipo `atraso`) com a mesma informação, caso
      ainda não exista uma notificação desse tipo criada no mesmo dia para
      aquele empréstimo.
4. O usuário visualiza a notificação (destacada visualmente com ícone de
   alerta) e/ou recebe o email.

**Pós-condições:** Usuário informado de forma inequívoca sobre a pendência de
devolução e o prazo original de 14 dias.

---

## UC06 — Registrar Devolução de Livro

**Ator principal:** Administrador

**Pré-condições:** Existe um empréstimo com status `ativo` ou `atrasado`.

**Fluxo principal:**
1. O administrador localiza o empréstimo na tela de gestão de empréstimos.
2. O administrador seleciona "Registrar Devolução".
3. O sistema atualiza o status do empréstimo para `devolvido` e grava a
   `DataDevolucao` com a data atual.
4. O sistema atualiza o status do exemplar correspondente para `Disponivel`.
5. O sistema gera uma notificação ao usuário informando que ele já pode
   avaliar o livro.

**Pós-condições:** Empréstimo concluído; caso estivesse em atraso, deixa de
gerar novas notificações de atraso.

---

## UC07 — Consultar Painel Administrativo de Empréstimos

**Ator principal:** Administrador

**Fluxo principal:**
1. O administrador acessa a tela de gestão de empréstimos.
2. O sistema lista todos os empréstimos com filtros por status (`ativo`,
   `atrasado`, `devolvido`) e busca por usuário/livro.
3. Empréstimos com status `atrasado` são destacados visualmente na listagem,
   junto com a data prevista de devolução (prazo de 14 dias) e a quantidade
   de dias em atraso.

**Pós-condições:** Administrador consegue identificar rapidamente pendências
de devolução.
