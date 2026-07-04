A execução continua igual:

npm start (do root) roda o servidor em server.js

## Documentacao do Projeto

A documentacao completa do projeto (requisitos funcionais, regras de negocio,
casos de uso e manual do usuario) esta disponivel na pasta `docs/`:

- `docs/01-requisitos-funcionais.md`
- `docs/02-regras-de-negocio.md`
- `docs/03-casos-de-uso.md`
- `docs/04-manual-do-usuario.md`

## Controle de Devolucao de Livros (prazo de 14 dias)

Todo emprestimo criado no sistema recebe automaticamente um prazo de
devolucao de 14 dias corridos, contado a partir da data de retirada do
livro. Esse prazo fica salvo no banco de dados (campo `DataPrevista` da
tabela `Emprestimo`) e e exibido tanto na tela "Meus Emprestimos" do usuario
quanto no painel administrativo de gestao de emprestimos.

O sistema envia notificacoes (persistidas no banco e por email) em dois
momentos:

1. **Vencimento proximo**: quando faltam 2 dias ou menos para o fim do
   prazo, informando que o prazo total do emprestimo e de 14 dias e a data
   limite de devolucao.
2. **Atraso**: quando o prazo de 14 dias ja foi ultrapassado e a devolucao
   ainda nao ocorreu, deixando claro que o prazo era de 14 dias, a data
   prevista original e ha quantos dias a devolucao esta pendente.

Essa verificacao roda automaticamente todos os dias (rotina agendada as
07h) e tambem pode ser disparada manualmente pelas rotas administrativas
`POST /emprestimo/vencendo/notificar` e `POST /emprestimo/atrasado/notificar`.

Detalhes completos da regra de negocio estao em
`docs/02-regras-de-negocio.md`.
