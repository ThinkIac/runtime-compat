# Migração de CommonJS para LógosType

Origem: `ThinkIac/ThinkIac`, base `228d3cf2`, pasta
`vendor/packages/modules/runtime-compat`, com a dependência de annotations já
atualizada para seu repositório externo. Os dois `.cjs` originais e o mapa foram
preservados em `test/fixtures` como referência de compatibilidade.

`index.cjs` e `legacy-library.cjs` públicos são fachadas para `dist/*.cjs`.
O fonte mantido fica em `src/*.type`. Nenhuma capacidade nova foi adicionada.
O mapa de imports foi preservado byte a byte. A resolução de annotations usa o
pacote declarado no manifest; não há fallback para um diretório vizinho vendor.

A API antiga permanece. A migração não converte os provedores consumidores para
chamadas exclusivamente por eventos, não remove autoridade e não muda seu ciclo
de vida. A exceção histórica de repo receber o container continua explícita.

Testes diferenciais com o original cobrem estrutura das portas, encaminhamento,
retornos, mutações, scanners recursivos, subscriptions, validação e autorização.
O loader é exercitado com imports circulares, kernel ports, cache e falhas.
A instalação empacotada é testada fora do checkout, sem módulos vendor adjacentes.
Esses cenários não constituem prova de equivalência para toda entrada possível.

Ao integrar em ThinkIac, fixe o commit no manifest/lockfile, substitua as duas
entradas incorporadas por fachadas e execute a suíte Lógos e sua validação de
distribuição independente. Nenhum passo exige reiniciar o runtime ativo.
