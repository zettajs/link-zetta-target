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

var util = require('util');
var Scout = require('zetta').Scout;
var mqtt = require('mqtt');
var MqttClient = require('./client');
var MqttDriver = require('./device');
var DiscoverResource = require('./discover_resource');

var MqttScout = module.exports = function(options) {

  this.client = new MqttClient(mqtt.connect(options.url, {
    clientId: options.clientId,
    username: options.username,
    password: options.password
  }));

  options.destroyTimeout = options.destroyTimeout || 300000 //5m
  
  this.options = options;

  Scout.call(this);
};
util.inherits(MqttScout, Scout);

MqttScout.prototype.init = function(callback) {
  this.client.on('connect', function() {
    console.log('mqtt started');
  });

  this.server.httpServer.cloud.add(DiscoverResource, this);
  callback();
};

MqttScout.prototype.startCommunicatingWithDevice = function(deviceId) {
  var self = this;
  this.client.subscribe('device/' + deviceId + '/$init');
  this.client.once('device/' + deviceId + '/$init', function(message, packet) {
    try {
      var deviceModel = JSON.parse(message);
    } catch(err) {
      console.error('Failed to parse device definition', err);
      return;
    }
    self.initDevice(deviceId, deviceModel);
    self.client.unsubscribe('device/' + deviceId + '/$init');
    self.client.publish('device/' + deviceId + '/$init/ack', JSON.stringify({}));
  });
};

MqttScout.prototype.initDevice = function(deviceId, deviceModel) {
  var self = this;
  var query = this.server.where({ id: deviceId });
  this.server.find(query, function(err, results) {
    if (results.length > 0) {
      var device = self.provision(results[0], MqttDriver, deviceId, deviceModel, self.client, self.options);
      if (!device) {
        device = self.server._jsDevices[deviceId];
        device.state = deviceModel.state;
        if(deviceModel.properties) {
          Object.keys(deviceModel.properties).forEach(function(key) {
            device[key] = deviceModel.properties[key];
          });
        }

        clearTimeout(device._destroyTimer);
        device.log('device reconnected.');
      }
    } else {
      self.discover(MqttDriver, deviceId, deviceModel, self.client, self.options);
    }
  });
};
