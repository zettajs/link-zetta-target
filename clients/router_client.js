var Etcd = require('node-etcd');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var RouterClient = module.exports = function(options) {
  EventEmitter.call(this);
  var self = this;
  this._etcDirectory = '/router/zetta';

  if(!options.client) {
    this._client = new Etcd(options.host);
  } else {
    this._client = options.client;
  }  
  
  this._ttl = 120; // seconds
};
util.inherits(RouterClient, EventEmitter);

RouterClient.prototype.findAll = function(tenantId, cb) {
  if (typeof tenantId === 'function') {
    cb = tenantId;
    tenantId = null;
  }

  var dir = tenantId ? this._etcDirectory + '/' + tenantId : this._etcDirectory;
  this._client.get(dir, { recursive: true, consistent: true }, function(err, results) {
    if (err) {
      if(err.errorCode == 100) {
        cb(null, []);
        return; 
      } else {
        cb(err);
        return;
      }
      
    }

    if (results.node && results.node.nodes && results.node.nodes.length > 0) {
      var nodes = results.node.nodes
        .filter(function(item) { return !item.dir; })
        .map(function(item) {
          try {
            item = JSON.parse(item.value);
            return {
              tenantId: item.tenantId,
              name: item.name,
              url: item.url,
              created: item.created
            };
          } catch(err) {
            return null;
          }
        })
        .filter(function(item) {
          return item !== null;
        });      

      results.node.nodes
          .filter(function(item) { return item.dir })
          .forEach(function(item) {
            if (item.nodes) {
              item.nodes
                .filter(function(item) { return !item.dir; })
                .forEach(function(item) {
                  try {
                    item = JSON.parse(item.value);
                    nodes.push({
                      tenantId: item.tenantId,
                      name: item.name,
                      url: item.url,
                      created: item.created
                    });
                  } catch(err) {
                    
                  }
                });
            }
          });
      cb(null, nodes);
    } else {
      cb(null, []);
    }
  });
};

RouterClient.prototype.get = function(tenantId, targetName, cb) {
  if (typeof targetName === 'function') {
    cb = targetName;
    targetName = tenantId;
    tenantId = null;
  }

  var dir = tenantId ? this._etcDirectory + '/' + tenantId : this._etcDirectory;
  this._client.get(dir + '/' + targetName, { consistent: true }, function(err, results) {
    if (err) {
      cb(err);
      return;
    }

    if (results.node) {
      var route = null;
      try {
        route = JSON.parse(results.node.value);
      } catch(err) {
        return cb(err);
      }
      cb(null, route.url);
    } else {
      cb();
    }
  });
};

RouterClient.prototype.add = function(tenantId, targetName, serverUrl, cb) {
  if (typeof serverUrl === 'function') {
    cb = serverUrl;
    serverUrl = targetName;
    targetName = tenantId;
    tenantId = null;
  }

  var dir = tenantId ? this._etcDirectory + '/' + tenantId : this._etcDirectory;
  var params = { name: targetName, tenantId: tenantId, url: serverUrl, created: new Date() };
  this._client.set(dir + '/' + targetName, JSON.stringify(params), { ttl: this._ttl }, function(err, results) {
    if (err) {
      cb(err);
      return;
    }

    cb();
  });
};

RouterClient.prototype.remove = function(tenantId, targetName, cb) {
  if (typeof targetName === 'function') {
    cb = targetName;
    targetName = tenantId;
    tenantId = null;
  }

  var dir = tenantId ? this._etcDirectory + '/' + tenantId : this._etcDirectory;
  this._client.del(dir + '/' + targetName, function(err, results) {
    if (err) {
      cb(err);
      return;
    }

    cb();
  });
};

RouterClient.prototype.removeTenantDirectory = function(tenantId, cb) {
  var dir = this._etcDirectory + '/' + tenantId;
  this._client.rmdir(dir, function(err, results) {
    if(err) {
      if(err.errorCode == 100) {
        cb();
        return; 
      } else {
        cb(err);
        return;
      }
    }

    cb();
  });
}
