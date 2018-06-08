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

var DiscoverResource = module.exports = function(scout) {
  this.scout = scout;
}

DiscoverResource.prototype.init = function(config) {
  config
    .path('/mqtt')
    .consumes('application/json')
    .produces('application/vnd.siren+json')
    .post('/', this.create)
    .get('/', this.root);
};

DiscoverResource.prototype.root = function(env, next) {
  var body = {
    class: ['scout', 'mqtt-device-scout'],
    actions: [
      {
        name: 'init-device',
        method: 'POST',
        href: env.helpers.url.current(),
        type: 'application/json',
        fields: [
          {
            name: 'id',
            type: 'text'  
          }
        ]  
      }
    ],
    links: [
      { rel: ['self'], href: env.helpers.url.current() }
    ]  
  }
  env.response.statusCode = 200;
  env.response.body = body;
  return next(env);  
}

DiscoverResource.prototype.create = function(env, next) {
  var self = this;
  env.request.getBody(function(err, body) {
    if(err) {
      env.response.statusCode = 500;
      return next(env);  
    }
    body = body.toString();
    var bodyObject = JSON.parse(body);

    if (!bodyObject.id) {
      env.response.statusCode = 400;
      return next(env);        
    }
    
    self.scout.startCommunicatingWithDevice(bodyObject.id);
    env.response.statusCode = 201;
    return next(env);
  });  
};
