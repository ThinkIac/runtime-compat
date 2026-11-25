# Runtime Compat

Ponte temporária de compatibilidade entre o kernel Lógos e capacidades legadas.
Implementada em LógosType (`src/*.type`), distribuída com CommonJS compilado.
Não é um novo runtime, barramento ou sandbox e não instala capacidades sozinha.

## Para que serve

- Cria o host usado pelas fábricas antigas, com portas para eventos, autoridade,
  scanners de annotations, HTTP, WebSocket, ferramentas, comandos e armazenamento.
- Encaminha ciclo de vida, escopos de processos e recuperação ao kernel/provedor.
- Valida ferramentas e hooks antes da ligação de um pacote, incluindo autorização.
- Resolve imports antigos para implementações nos pacotes proprietários por meio
  de `legacy-modules.json`, sem copiá-las para dentro do Lógos.

```text
Lógos fornece container + primitivas + registro de subscriptions
  → createHost
  → módulo legado usa portas do host
  → kernel/provedor executa a operação com a autoridade existente

import legado
  → createLegacyLibrary
  → mapa de compatibilidade
  → módulo proprietário/compat/*.cjs
```

## Instalação

```sh
npm install ThinkIac/runtime-compat#main
```

Para builds reproduzíveis, substitua `main` por um commit. A dependência de
annotations e o compilador LogosType estão fixados por commit no manifest.
O JavaScript gerado é versionado; importar o pacote não compila `.type`.
Uma instalação Git executa `prepare` para conferir/regenerar os artefatos.

## API

```js
const { createHost, validatePackageWiring } = require('@thinkiac/module-runtime-compat');
const { createLegacyLibrary } = require('@thinkiac/module-runtime-compat/legacy-library.cjs');

// APIs internas de integração; as primitivas são fornecidas pelo host Lógos.
const subscriptions = new Set();
const host = createHost(container, kernel, subscriptions);
const unsubscribe = host.on('package:ready', payload => console.log(payload));
unsubscribe();
const summary = await validatePackageWiring(container, kernel, pkg);
const loadLegacy = createLegacyLibrary(kernel, resolveCapabilityDirectory);
const legacyCommands = loadLegacy('modules/commands');
```

Este exemplo não é uma API para aplicação comum: exige o kernel e o container
reais. Pacotes de aplicação devem preferir declarações e contratos de capacidades.
Não há `@register module runtime-compat`: o kernel precisa desta biblioteca para
adaptar provedores antigos durante a montagem do catálogo.

## Desenvolvimento

```sh
npm ci
npm test
npm run test:isolated
```

Node >=18. CI cobre Node 18, 20 e 22. Consulte [contratos](docs/contracts.md) e
[migração](docs/migration.md). Licença MIT.
