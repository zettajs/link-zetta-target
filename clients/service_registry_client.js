// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var Etcd = require('node-etcd');
var url = require('url');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var http = require('http');

var ServiceRegistry = module.exports = function(options) {
  EventEmitter.call(this);
  var self = this;
  this._etcDirectory = '/services/zetta';

  if(!options.client) {
    this._client = new Etcd(options.host);
  } else {
    this._client = options.client;
  }
};
util.inherits(ServiceRegistry, EventEmitter);

ServiceRegistry.prototype.findAll = function(cb) {
  var query = 'select type, url, created from servers';

  var self = this;
  this._client.get(this._etcDirectory, { consistent: true }, function(err, results) {
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


ServiceRegistry.prototype.get = function(serverUrl, cb) {
  this._client.get(this._etcDirectory + '/' + serverUrl, { consistent: true }, function(err, results) {
    if (err) {
      cb(err);
      return;
    }

    if (results.node) {
      var json = null;
      try {
        json = JSON.parse(results.node.value);
      } catch(err) {
        return cb(err);
      }
      cb(null, json);
    } else {
      cb();
    }
  });
};


ServiceRegistry.prototype.find = function(type, cb) {

  var self = this;
  this._client.get(this._etcDirectory, { consistent: true }, function(err, results) {
    if (err) {
      cb(err);
      return;
    }

    if(results.node.nodes) {
      var item = results.node.nodes.filter(function(item) {
        item = JSON.parse(item.value);
        return item.type === type;  
      });

      cb(null, item.map(self._buildServer));
    } else {
      cb(null, []);
    }
  });
};

ServiceRegistry.prototype.add = function(type, serverUrl, version, cb) {
  var data = { type: type, url: serverUrl, created: new Date(), version: version };

  var key = url.parse(serverUrl);
  this._client.set(this._etcDirectory + '/' + key.host, JSON.stringify(data), function(err, results) {
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

ServiceRegistry.prototype.allocate = function(type, oldRecord, newRecord, cb) {
  var oldRecord = {
    type: type,
    tenantId: oldRecord.tenantId,
    url: oldRecord.url,
    created: oldRecord.created,
    version: oldRecord.version
  };

  var newRecord = {
    type: type,
    tenantId: newRecord.tenantId,
    url: newRecord.url,
    created: newRecord.created,
    version: newRecord.version
  };

  var key = url.parse(oldRecord.url);
  this._client.compareAndSwap(this._etcDirectory + '/' + key.host, JSON.stringify(newRecord),
        JSON.stringify(oldRecord), function(err, results) {
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

ServiceRegistry.prototype.restart = function(serverUrl, cb) {
  var parsedServerUrl = url.parse(serverUrl);

  var opts = {
    hostname: parsedServerUrl.hostname,
    port: parsedServerUrl.port,
    path: '/restart',
    method: 'DELETE'
  };


  var req = http.request(opts, function(response) {
    if(response.statusCode !== 204) {
      return cb(new Error('Non sucessful status code: ' + response.statusCode));
    }

    return cb();
  });

  req.on('error', function(err) {
    cb(err);
  });

  req.end();
}

ServiceRegistry.prototype._buildServer = function(data) {
  data = JSON.parse(data.value);
  return data;
};
