var Etcd = require('node-etcd');
var url = require('url');

var ServiceRegistry = module.exports = function(options) {
  this._etcDirectory = '/services/zetta';
  this._client = new Etcd(options.host);
  this._ttl = 120; // seconds
};

ServiceRegistry.prototype.findAll = function(cb) {
  var self = this;
  this._client.get(this._etcDirectory, function(err, results) {
    if (err) {
      cb(err);
      return;
    }

    if(results.node.nodes) {
      cb(null, results.node.nodes.map(self._buildServer));
    } else {
      cb(null, []);
    }
  });
};

ServiceRegistry.prototype.find = function(type, cb) {

  var self = this;
  this._client.get(this._etcDirectory, function(err, results) {
    if (err) {
      cb(err);
      return;
    }

    var item = results.node.nodes.filter(function(item) {
      item = JSON.parse(item.value);
      return item.type === type;  
    });

    cb(null, item.map(self._buildServer));
  });
};

ServiceRegistry.prototype.add = function(type, serverUrl, version, cb) {
  var data = { type: type, url: serverUrl, created: new Date(), version: version };
  var key = url.parse(serverUrl);

  this._client.set(this._etcDirectory + '/' + key.host, JSON.stringify(data)/*, { ttl: this._ttl }*/ ,function(err, results) {
    if (err) {
      err.errors.forEach(function(e) {
        console.log(e);
      });
      if (cb) {
        cb(err);
      }
      return;
    }

    if (cb) {
      cb();
    }
  });
};

ServiceRegistry.prototype.remove = function(type, serverUrl, cb) {
  var key = url.parse(serverUrl);
  this._client.del(this._etcDirectory + '/' + key.host, function(err, results) {
    if (err) {
      if (cb) {
        cb(err);
      }
      return;
    }

    if (cb) {
      cb();
    }
  });
};

ServiceRegistry.prototype._buildServer = function(data) {
  data = JSON.parse(data.value);
  return data;
};
