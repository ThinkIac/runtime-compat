# Contratos preservados

## createHost(container, kernel, subscriptions)

Retorna um objeto congelado. As portas agrupadas também são congeladas, mas
configuração, estados e objetos retornados continuam vivos e mutáveis como antes.
Não transforma objetos nativos em mensagens serializáveis.

| Porta | Comportamento |
| --- | --- |
| on / once | Encaminham opções ao bus; registram o disposer no Set recebido |
| emit / pipeline / veto | Encaminham payload e contexto sem mudar semântica |
| registry / state / config | Consultam a instância recebida, sem singleton global |
| authority | Preservam runAsPackage/runAsSystem e a autoridade ativa |
| http | App/server, scanners, middlewares, isolamento e montagem de rotas |
| ws | Consulta o provedor ws no estado external-api |
| tools / commands | Scanners, condições, middlewares, manifest e contexto |
| storage | Configuração de storage e workspace |
| process / scopes | Escopos, supervisor, recuperação e remoção de owners |
| repo | Compatibilidade antiga, incluindo um handle direto ao container |

Acesso a capacidade não publicada em `external-api` lança
`[logos] external capability unavailable: <nome>`.
Express é carregado apenas ao acessar `host.http.express`. O host que usa essa
porta deve instalar Express em um caminho resolvível pelo Node. Importar esta
biblioteca e criar o host não exigem Express.

Scanners pedidos para a raiz do workspace percorrem os pacotes do registro,
inclusive pacotes aninhados; outros caminhos são resolvidos relativamente ao
workspace. O Set de subscriptions é propriedade do chamador: no encerramento ele
deve executar os disposers restantes. `once` preserva a semântica do bus, inclusive
o comportamento anterior de retenção do disposer no Set até limpeza explícita.

## validatePackageWiring(container, kernel, pkg)

Retorna Promise com `{ contract, tools, hooks }`. Normaliza o contrato do pacote,
usa superfícies do runner quando disponíveis ou scanners de annotations, exige
runner para pacote isolado e valida schema JSON objeto das ferramentas. Verifica
`tools/provide` para cada ferramenta e `events/transform` para cada hook.
Erros de schema e autoridade propagam; não concede permissões automaticamente.

## createLegacyLibrary(kernel, resolveModule)

O resolver retorna o diretório absoluto de um pacote de capacidade. O carregador
usa `legacy-modules.json` para localizar `compat/*.cjs`; cada arquivo exporta uma
função que recebe require, module, exports, dirname, filename e portas auxiliares.
Imports não relativos usam o resolver Node do proprietário. Imports relativos
precisam estar no mapa ou em `kernel.ports`. Imports desconhecidos falham.

O cache é por `kernel.scan` via WeakMap e mantém a identidade de exports e ciclos.
Falha remove a entrada parcial do cache de compatibilidade, permitindo nova
execução. O cache CommonJS do Node mantém seu comportamento independente.

## Limites de portabilidade

Esta é uma biblioteca de host Node: usa `node:path`, `node:module`, `process` e
CommonJS. Não oferece a portabilidade desejada para QuickJS/ESP32 por si só.
Preservar estas portas nesta migração evita quebrar os consumidores atuais. Um
host embarcado precisará fornecer seus próprios contratos/adaptadores. A ponte
não é uma fronteira de segurança: repo ainda recebe o container e outras portas
entregam referências vivas. A autoridade continua sendo aplicada pelo runtime.
