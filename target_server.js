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

var zetta = require('zetta');
var StatsClient = require('stats-client');
var MemoryPeerRegistry = require('./memory_peer_registry');
var MemoryRegistry = require('./memory_registry');
var DeviceDataSqs = require('zetta-device-data-sqs');
var DeviceDataInflux = require('./influx_collector');
var UsageApp = require('zetta-usage-addon');
var UsageCollector = require('./sqs_collector');
var port = process.env.MAPPED_PORT || 3001;
var version = process.env.VERSION || '0';
var RestartResource = require('./restart_resource');
var PingResource = require('./ping_resource');
var ServiceRegistryClient = require('./service_registry_client');
var MetaUsageCollector = require('./meta_usage_collector');

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

if(process.env.INFLUX_DATABASE) {
  instance.use(DeviceDataInflux);
}

/*
if (process.env.INFLUXDB_HOST) {
  console.log('Starting Meta Usage Collector');
  
  var opts = {
    host: process.env.COREOS_PRIVATE_IPV4
  };
  // allow a list of peers to be passed, overides COREOS_PRIVATE_IPV4
  if (process.env.ETCD_PEER_HOSTS) {
    opts.host = process.env.ETCD_PEER_HOSTS.split(',');
  }
  var serviceRegistryClient = new ServiceRegistryClient(opts);
  var statsdHost = process.env.COREOS_PRIVATE_IPV4 || 'localhost';
  var statsClient = new StatsClient(statsdHost + ':8125', { }, { telegraf: true });
  var serverUrl = ((process.env.COREOS_PRIVATE_IPV4) ? process.env.COREOS_PRIVATE_IPV4 : 'localhost') + ':' + port;
  instance.use(MetaUsageCollector({ client: statsClient, serviceRegistryClient: serviceRegistryClient, serverUrl: serverUrl }));
}
*/


instance.listen(port);


