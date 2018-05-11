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
var MemoryRegistries = require('zetta-memory-registry')(zetta);
var PeerRegistry = MemoryRegistries.PeerRegistry;
var DeviceRegistry = MemoryRegistries.DeviceRegistry;
var DeviceDataSqs = require('zetta-device-data-sqs');
var UsageApp = require('zetta-usage-addon');
var UsageCollector = require('./sqs_collector');
var MqttScout = require('./mqtt/scout');

var port = process.env.MAPPED_PORT || 3001;
var version = process.env.VERSION || '0';

var instance = zetta({
  registry: new DeviceRegistry(),
  peerRegistry: new PeerRegistry()
});

instance.name('cloud-devices');

// MQTT is enabled only if there is a broker URL
if (process.env.MQTT_BROKER_URL && process.env.MQTT_BROKER_URL.indexOf('@@') !== 0) {
  console.log('Enabling MQTT scout to broker ', process.env.MQTT_BROKER_URL);
  instance.use(MqttScout, { clientId: (process.env.COREOS_PRIVATE_IPV4 || 'localhost') + ':' + port,
                            url: process.env.MQTT_BROKER_URL,
                            destroyTimeout: process.env.MQTT_DESTROY_TIMEOUT || 300000
                          });
}

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

instance.listen(port);


