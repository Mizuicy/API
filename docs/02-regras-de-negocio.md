# Regras de Negócio — Sistema Kairos Biblioteca

Este documento descreve as regras de negócio (RN) do sistema, com foco
detalhado na regra de **prazo de empréstimo e controle de devolução**.

## 1. Prazo de Empréstimo (Regra Central)

- **RN01 — Prazo padrão de 14 dias.** Todo empréstimo criado no sistema recebe
  automaticamente um prazo de devolução de **14 dias corridos** (não úteis),
  contados a partir da data de saída (retirada) do exemplar. Essa contagem é
  feita pelo backend no momento da criação do empréstimo, tanto quando ele é
  criado diretamente pelo administrador (`POST /emprestimo`) quanto quando é
  criado a partir da aprovação de uma solicitação de empréstimo
  (`POST /solicitacao/:id/aprovar`).
  - Fórmula: `DataPrevista = DataSaida + 14 dias`.
  - Constante centralizada no backend: `PRAZO_EMPRESTIMO_DIAS = 14`
    (arquivo `backend/src/server.js`), reutilizada em todos os pontos do
    sistema que dependem dessa regra (criação de empréstimo, mensagens de
    notificação e emails), evitando divergência de valores entre as
    funcionalidades.
  - Exceção: um administrador pode, manualmente, definir uma `DataPrevista`
    diferente da regra padrão ao cadastrar ou editar um empréstimo
    (necessidade operacional, ex.: reserva especial); quando isso ocorre, o
    prazo de 14 dias não é aplicado e a data informada prevalece.

- **RN02 — Armazenamento do prazo.** A data prevista de devolução é persistida
  no campo `DataPrevista` da tabela `Emprestimo` e nunca é recalculada após a
  criação do empréstimo (a menos que editada manualmente pelo administrador).

- **RN03 — Exibição do prazo.** O prazo de devolução deve estar sempre visível
  para o usuário na tela "Meus Empréstimos" e para o administrador na tela de
  gestão de empréstimos, junto com um indicador textual de quantos dias
  faltam para o vencimento ou há quantos dias o empréstimo está em atraso.

## 2. Contagem do Prazo e Detecção de Atraso

- **RN04 — Cálculo da contagem regressiva.** A quantidade de dias restantes
  (ou de dias em atraso) é calculada comparando a data atual com
  `DataPrevista`, sempre à meia-noite (sem efeito de fuso horário), tanto no
  backend (para notificações e emails) quanto no frontend (para exibição).
  - Se `DataPrevista - hoje > 0`: dias restantes até o vencimento.
  - Se `DataPrevista - hoje == 0`: o empréstimo vence hoje.
  - Se `DataPrevista - hoje < 0`: o empréstimo está em atraso, e o módulo do
    resultado representa a quantidade de dias de atraso.

- **RN05 — Transição automática para "atrasado".** Um empréstimo com status
  `ativo` cuja `DataPrevista` já passou é automaticamente marcado com status
  `atrasado` pelo backend. Essa verificação ocorre:
  1. A cada consulta à lista de empréstimos (`GET /emprestimo`);
  2. Diariamente, às 07h, por meio de uma rotina agendada (cron job) interna
     do servidor;
  3. Sob demanda, por meio da rota administrativa
     `POST /emprestimo/atrasado/notificar`.
  - Um empréstimo permanece com status `atrasado` até que a devolução seja
    efetivamente registrada pelo administrador, mesmo que o atraso se
    prolongue por muitos dias.

## 3. Notificações de Prazo

- **RN06 — Notificação de vencimento próximo.** Quando faltarem **2 dias ou
  menos** para o vencimento do prazo (incluindo o próprio dia do vencimento),
  o sistema deve gerar uma notificação persistida no banco de dados (tipo
  `vencimento`) e enviar um email ao usuário. A mensagem deve deixar claro:
  - O título do livro emprestado;
  - Que o prazo total do empréstimo é de 14 dias;
  - A data limite (`DataPrevista`) para devolução.
  - Essa verificação é repetida diariamente pela rotina agendada, mas o
    sistema evita o envio de notificações duplicadas no mesmo dia para o
    mesmo empréstimo.

- **RN07 — Notificação de atraso.** Quando o empréstimo estiver com status
  `atrasado`, o sistema deve gerar uma notificação persistida no banco de
  dados (tipo `atraso`) e enviar um email ao usuário. A mensagem deve deixar
  claro:
  - O título do livro emprestado;
  - Que o prazo de empréstimo **era** de 14 dias;
  - Qual era a data prevista de devolução;
  - Há quantos dias a devolução está pendente;
  - Que a devolução ainda está pendente e deve ser realizada o quanto antes.
  - Assim como a notificação de vencimento, o sistema envia no máximo uma
    notificação de atraso por empréstimo por dia, evitando duplicidade mesmo
    que a rotina seja disparada mais de uma vez no mesmo dia.

- **RN08 — Persistência e leitura das notificações.** Toda notificação gerada
  pelas regras RN06 e RN07 fica disponível na central de notificações do
  usuário (sino de notificações), podendo ser marcada como lida
  individualmente ou em lote.

## 4. Regras Gerais de Empréstimo (contexto)

- **RN09 — Disponibilidade de exemplar.** Um empréstimo só pode ser criado se
  existir ao menos um exemplar do livro com status `Disponivel`. Ao criar o
  empréstimo, o exemplar selecionado passa para o status `Emprestado`; ao
  registrar a devolução, o exemplar volta a `Disponivel`.
- **RN10 — Empréstimo duplicado.** Um usuário não pode possuir mais de um
  empréstimo `ativo` ou `atrasado` do mesmo livro simultaneamente.
- **RN11 — Avaliação pós-devolução.** Após a devolução de um empréstimo, o
  usuário é notificado (tipo `avaliacao_pendente`) e pode avaliar o livro uma
  única vez por empréstimo elegível.

## 5. Regras de Acesso

- **RN12 — Perfis de acesso.** Existem dois perfis: usuário comum (acesso ao
  catálogo, empréstimos e avaliações próprias) e administrador (acesso total,
  incluindo gestão de acervo, empréstimos, solicitações e usuários).
- **RN13 — Confirmação de email.** Ações sensíveis (cadastro, redefinição de
  senha) exigem confirmação por código enviado ao email do usuário.
