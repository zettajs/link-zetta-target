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

var AWS = require('aws-sdk');
var zetta = require('zetta');
var StatsClient = require('stats-client');
var MemoryPeerRegistry = require('./memory_peer_registry');
var MemoryRegistry = require('./memory_registry');
var DeviceDataSqs = require('zetta-device-data-sqs');
var UsageApp = require('zetta-usage-addon');
var UsageCollector = require('./sqs_collector');
var RestartResource = require('./restart_resource');
var PingResource = require('./ping_resource');
var RouterUpdater = require('./routing_updater');
var RouterClient = require('./clients/router_client');
var ServiceRegistryClient = require('./clients/service_registry_client');
var JWTVerify = require('./jwt_verify');

var port = process.env.MAPPED_PORT || 3001;
var version = process.env.VERSION || '0';
var hostnames = [];
if (process.env.COREOS_PUBLIC_IPV4) {
  hostnames.push(process.env.COREOS_PUBLIC_IPV4);
}
if (process.env.COREOS_PRIVATE_IPV4) {
  hostnames.push(process.env.COREOS_PRIVATE_IPV4);
}
if (hostnames.length === 0) {
  hostnames.push('localhost');
}

var serverUrl = ((process.env.COREOS_PRIVATE_IPV4) ? process.env.COREOS_PRIVATE_IPV4 : 'localhost') + ':' + port;

var jwtPlaintextKeys = null;

var opts = {
  host: process.env.COREOS_PRIVATE_IPV4
};

// allow a list of peers to be passed, overides COREOS_PRIVATE_IPV4
if (process.env.ETCD_PEER_HOSTS) {
  opts.host = process.env.ETCD_PEER_HOSTS.split(',');
}

var serviceRegistryClient = new ServiceRegistryClient(opts);
var routerClient = new RouterClient(opts);
var statsdHost = process.env.COREOS_PRIVATE_IPV4 || 'localhost';
var statsClient = new StatsClient(statsdHost + ':8125', { }, { telegraf: true });

if (!process.env.JWT_CIPHER_TEXT) {
  if (process.env.JWT_PLAIN_TEXT) {
    var keys = process.env.JWT_PLAIN_TEXT.split(',');
    if (keys.length !== 2) {
      throw new Error('Expecting two comma seperated keys');
    }
    jwtPlaintextKeys = { internal: keys[0], external: keys[1] };
  }
  
  startServer();
} else {
  console.log('Decrypting jwt key');

  AWS.config.update({ region: process.env.AWS_REGION });
  var kms = new AWS.KMS();
  
  var reqOpts = {
    CiphertextBlob: new Buffer(process.env.JWT_CIPHER_TEXT, 'hex'),
    EncryptionContext: {
      stackName: process.env.ZETTA_STACK
    }
  };
  kms.decrypt(reqOpts, function(err, data) {
    if (err) {
      console.error(err);
      process.exit(1);
      return;
    }

    var keys = data.Plaintext.toString().split(',');
    if (keys.length !== 2) {
      throw new Error('Expecting two comma seperated keys.');
    }
    jwtPlaintextKeys = { internal: keys[0], external: keys[1] };
    startServer();
  });
}

function startServer() {
  var instance = zetta({
    registry: new MemoryRegistry(), // no device registry is needed
    peerRegistry: new MemoryPeerRegistry()
  });

  instance.name('cloud-' + port);
  instance.use(function(server) {
    server.httpServer.cloud.add(RestartResource);
    server.httpServer.cloud.add(PingResource);
  });

  instance.logger(function(log) {
    log.on('message', function(level, event, msg, data) {
      console.log(level, event, msg);
    });
  });

  if (process.env.DEVICE_DATA_QUEUE) {
    var sqs = new DeviceDataSqs({
      queueUrl: process.env.DEVICE_DATA_QUEUE,
      accessKeyId: process.env.AWS_ACCESSKEY,
      secretAccessKey: process.env.AWS_SECRET
    });
    instance.use(sqs.collect());
  }

  if (process.env.USAGE_QUEUE) {
    var app = new UsageApp()
    instance.use(app.collect());
    var opts = {
      queueUrl: process.env.USAGE_QUEUE,
      accessKeyId: process.env.AWS_ACCESSKEY,
      secretAccessKey: process.env.AWS_SECRET,
      emitter: app
    }
    UsageCollector(opts);
  }

  instance.use(RouterUpdater(serverUrl, routerClient, serviceRegistryClient, statsClient));

  if (jwtPlaintextKeys) {
    console.log('JWT Verification enabled');
    instance.use(JWTVerify(jwtPlaintextKeys, hostnames, port));
  }
  
  instance.listen(port);
}

