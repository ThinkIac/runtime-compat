var createLegacyLibrary, createRequire, libraries, mapping, path;

path = require('node:path');

({createRequire} = require('node:module'));

mapping = require('../legacy-modules.json');

libraries = new WeakMap();

// Cache is scoped to the kernel scanner, preserving cycles and retry on failure.
createLegacyLibrary = function(kernel, resolveModule) {
  var cache, load;
  if (libraries.has(kernel.scan)) {
    return libraries.get(kernel.scan);
  }
  cache = new Map();
  load = function(name) {
    var entry, error, filename, ownerRequire, requireScoped, target;
    if (cache.has(name)) {
      return cache.get(name).exports;
    }
    target = mapping[name];
    if (!target) {
      throw new Error(`Unknown legacy capability import: ${name}`);
    }
    filename = path.join(resolveModule(target[0]), 'compat', target[1]);
    entry = {
      exports: {}
    };
    cache.set(name, entry);
    ownerRequire = createRequire(filename);
    requireScoped = function(id) {
      var dependency;
      if (!id.startsWith('.')) {
        return ownerRequire(id);
      }
      dependency = path.posix.normalize(path.posix.join(path.posix.dirname(name), id));
      if (mapping[dependency]) {
        return load(dependency);
      }
      if (kernel.ports[dependency]) {
        return kernel.ports[dependency];
      }
      if (path.isAbsolute(id)) {
        return require(id);
      }
      throw new Error(`Undeclared legacy capability dependency: ${name} -> ${id}`);
    };
    try {
      require(filename)(requireScoped, entry, entry.exports, path.dirname(filename), filename, {
        resolveModule: function(name) {
          return require(resolveModule(name));
        }
      });
    } catch (error1) {
      error = error1;
      cache.delete(name);
      throw error;
    }
    return entry.exports;
  };
  libraries.set(kernel.scan, load);
  return load;
};

module.exports = {createLegacyLibrary};
