// Compatibility ports for existing capability factories. No global container.
var createHost, createScanners, requireCapabilityDependency, resolveConditions, validatePackageWiring, validateToolSchema;

requireCapabilityDependency = function(name) {
  return require(name);
};

({createScanners} = requireCapabilityDependency('@thinkiac/module-annotations'));

({resolveConditions} = requireCapabilityDependency('@thinkiac/module-annotations/conditions.cjs'));

createHost = function(container, kernel, subscriptions) {
  var appendLog, createRuntimeContext, currentAuthority, externalApi, generateManifest, getErrors, getIsolatedRunner, http, loadMiddlewareSnapshot, path, registerCommands, registerHooks, registerRoutes, registerTools, requestReboot, resolveMiddlewares, routeMountPath, runAsPackage, runAsSystem, runMiddlewares, scans, scopedScan, stabilizationPorts, subscribe;
  ({currentAuthority, runAsPackage, runAsSystem} = kernel.authority);
  ({createRuntimeContext} = kernel.context);
  ({appendLog, getErrors} = kernel.debug);
  ({getIsolatedRunner} = kernel.isolation);
  path = require('node:path');
  scopedScan = async function(folder, ...args) {
    var absolute, groups;
    absolute = path.isAbsolute(folder) ? folder : path.join(container.workspace, folder);
    if (path.resolve(absolute) === path.resolve(container.workspace)) {
      groups = (await Promise.all(container.registry.discover().map(function(pkg) {
        return kernel.scan.registerGeneric(pkg.dir, ...args);
      })));
      return groups.flat();
    }
    return (await kernel.scan.registerGeneric(absolute, ...args));
  };
  scans = {
    ...createScanners(scopedScan),
    resolveAgentFolder: kernel.scan.resolveAgentFolder
  };
  ({registerRoutes, registerHooks, registerTools, registerCommands} = scans);
  ({loadMiddlewareSnapshot, resolveMiddlewares, runMiddlewares} = requireCapabilityDependency('@thinkiac/module-annotations/middleware.cjs').create(scans));
  ({generateManifest} = requireCapabilityDependency('@thinkiac/module-annotations/manifest.cjs').create(scans));
  routeMountPath = function(pkg, route) {
    if (route.startsWith('/')) {
      return route;
    } else {
      return '/' + pkg + '/' + route;
    }
  };
  stabilizationPorts = function() {
    return kernel.lifecycle;
  };
  requestReboot = function(c, options) {
    return kernel.ports['stabilizer/isolation'].requestReboot(c, options);
  };
  externalApi = function(c, name) {
    var api;
    api = c.state('external-api').get(name);
    if (!api) {
      throw new Error('[logos] external capability unavailable: ' + name);
    }
    return api;
  };
  subscribe = function(once, event, handler, options) {
    var unsubscribe;
    unsubscribe = once ? container.bus.once(event, handler, options) : container.bus.on(event, handler, options);
    subscriptions.add(unsubscribe);
    return function() {
      subscriptions.delete(unsubscribe);
      return unsubscribe();
    };
  };
  http = {
    app: function() {
      return container.app;
    },
    setApp: function(app) {
      container.app = app;
    },
    setServer: function(server) {
      container.server = server;
    },
    server: function() {
      return externalApi(container, 'http').createServer();
    },
    getErrors: getErrors,
    packageSnapshot: function() {
      return container.registry.snapshot();
    },
    getPackageMount: function() {
      return externalApi(container, 'http').getPackageMount();
    },
    scanRoutes: registerRoutes,
    isolatedRunner: function(pkg) {
      return getIsolatedRunner(container, pkg);
    },
    createContext: createRuntimeContext,
    loadMiddlewareSnapshot: loadMiddlewareSnapshot,
    resolveMiddlewares: resolveMiddlewares,
    runMiddlewares: runMiddlewares,
    routeMountPath: routeMountPath,
    recordOfflineRoutes: function(pkg, routes) {
      return container.bus.emit('views:offline_routes', {pkg, routes});
    },
    runAsPackage: function(pkg, work) {
      return runAsPackage(container.authority, pkg, work);
    }
  };
  // Express remains lazy: importing this bridge does not load the HTTP stack.
  Object.defineProperty(http, 'express', {
    enumerable: true,
    configurable: true,
    get: function() {
      return require('express');
    }
  });
  return Object.freeze({
    kernelPrimitives: stabilizationPorts,
    authority: Object.freeze({runAsSystem, runAsPackage}),
    applicationRoot: function() {
      return process.cwd();
    },
    workspace: function() {
      return container.workspace;
    },
    dataDir: function() {
      return process.env.LOGOS_DATA_DIR;
    },
    appendLog: appendLog,
    currentAuthority: currentAuthority,
    log: function(message) {
      return container.log(message);
    },
    createContext: createRuntimeContext,
    resolveConditions: resolveConditions,
    scanHooks: registerHooks,
    loadTools: function(workspace) {
      return externalApi(container, 'tools').loadMcpTools(workspace);
    },
    on: function(event, handler, options) {
      return subscribe(false, event, handler, options);
    },
    once: function(event, handler, options) {
      return subscribe(true, event, handler, options);
    },
    emit: function(event, payload, context) {
      return container.bus.emit(event, payload, context);
    },
    pipeline: function(event, payload, context) {
      return container.bus.pipeline(event, payload, context);
    },
    veto: function(event, payload, context) {
      return container.bus.veto(event, payload, context);
    },
    state: function(namespace) {
      return container.state(namespace);
    },
    registry: Object.freeze({
      getPackage: function(name) {
        return container.registry.getPackage(name);
      },
      discover: function() {
        return container.registry.discover();
      }
    }),
    config: function() {
      return container.config;
    },
    http: Object.freeze(http),
    ws: Object.freeze({
      getHub: function() {
        return externalApi(container, 'ws').getHub();
      }
    }),
    tools: Object.freeze({
      authority: function() {
        return container.authority;
      },
      scan: registerTools,
      resolveMiddlewares: resolveMiddlewares,
      runMiddlewares: runMiddlewares,
      generateManifest: generateManifest,
      getErrors: getErrors,
      requestReboot: function(ignored, options) {
        return requestReboot(container, options);
      },
      currentAuthority: currentAuthority,
      runAsPackage: function(_authority, pkg, work) {
        return runAsPackage(container.authority, pkg, work);
      },
      runAsSystem: function(_authority, work) {
        return runAsSystem(container.authority, work);
      },
      isolatedRunner: function(_ignored, pkg) {
        return getIsolatedRunner(container, pkg);
      }
    }),
    commands: Object.freeze({
      scan: registerCommands,
      resolveConditions: resolveConditions,
      createContext: createRuntimeContext,
      resolveMiddlewares: resolveMiddlewares,
      runMiddlewares: runMiddlewares
    }),
    storage: Object.freeze({
      config: function() {
        return container.config.storage || {};
      },
      workspace: function() {
        return container.workspace;
      }
    }),
    process: Object.freeze({
      getScope: function(pkg) {
        return container.getPackageScope(pkg);
      },
      createScope: function(pkg, version) {
        return container.createPackageScope(pkg, version);
      },
      disposeScope: function(pkg, reason) {
        return container.disposePackageScope(pkg, reason);
      },
      supervisor: function() {
        return container.state('supervisor').get('controller');
      },
      recoverIsolatedPackage: function(folder) {
        return kernel.ports['stabilizer/isolation'].recoverIsolatedPackage(container, folder);
      }
    }),
    // Legacy repo alone still receives a container handle; retained intentionally.
    repo: Object.freeze({
      container: function() {
        return container;
      },
      isBranchInstance: function() {
        return process.env.LOGOS_ROLE === 'branch';
      }
    }),
    scopes: Object.freeze({
      get: function(pkg) {
        return container.getPackageScope(pkg);
      },
      create: function(pkg, version) {
        return container.createPackageScope(pkg, version);
      },
      dispose: function(pkg, reason) {
        return container.disposePackageScope(pkg, reason);
      },
      removeOwner: function(pkg) {
        return container.bus.removeOwner(pkg);
      }
    })
  });
};

validateToolSchema = function(tool) {
  var ref, ref1, schema;
  schema = tool != null ? tool.parameters : void 0;
  if (!(schema && schema.type === 'object' && schema.properties && typeof schema.properties === 'object')) {
    throw new TypeError(`Tool ${(ref = tool != null ? tool.name : void 0) != null ? ref : '<unknown>'} must expose an object JSON schema`);
  }
  if (schema.required !== void 0 && !Array.isArray(schema.required)) {
    throw new TypeError(`Tool ${(ref1 = tool != null ? tool.name : void 0) != null ? ref1 : '<unknown>'} schema.required must be an array`);
  }
};

validatePackageWiring = async function(container, kernel, pkg) {
  var contract, getIsolatedRunner, hook, hooks, i, j, len, len1, normalizePackageContract, principal, registerHooks, registerTools, runner, surfaces, tool, tools;
  ({normalizePackageContract} = kernel.lifecycle['../kernel/package-contract']);
  ({getIsolatedRunner} = kernel.isolation);
  ({registerTools, registerHooks} = createScanners(kernel.scan.registerGeneric));
  contract = normalizePackageContract(pkg);
  principal = {
    kind: 'package',
    id: pkg.folder
  };
  runner = getIsolatedRunner(container, pkg.folder);
  surfaces = runner != null ? runner.surfaces : void 0;
  if (pkg.isolated === true && !surfaces) {
    throw new Error(`Isolated package ${pkg.folder} has no running runner`);
  }
  tools = surfaces ? surfaces.tools.map(function(tool) {
    return {
      ...tool,
      call: function(args, context) {
        return runner.invoke(tool.id, [args], context);
      }
    };
  }) : (await registerTools(pkg.folder));
  hooks = surfaces ? surfaces.hooks.map(function(hook) {
    return {
      ...hook,
      call: function(payload, context) {
        return runner.invoke(hook.id, [payload], context);
      }
    };
  }) : (await registerHooks(pkg.folder));
  for (i = 0, len = tools.length; i < len; i++) {
    tool = tools[i];
    validateToolSchema(tool);
    container.authority.enforce({
      principal,
      surface: 'tools',
      operation: 'provide',
      resource: `${pkg.folder}.${tool.name}`
    });
  }
  for (j = 0, len1 = hooks.length; j < len1; j++) {
    hook = hooks[j];
    container.authority.enforce({
      principal,
      surface: 'events',
      operation: 'transform',
      resource: hook.event
    });
  }
  return {
    contract,
    tools: tools.length,
    hooks: hooks.length
  };
};

module.exports = {createHost, validatePackageWiring};
