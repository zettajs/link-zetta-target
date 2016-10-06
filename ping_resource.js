var PingResource = module.exports = function() { };

PingResource.prototype.init = function(config) {
  config
    .path('/ping')
    .get('/', this.ping);
};

PingResource.prototype.ping = function(env, next) {
  env.response.statusCode = 200;
  return next(env);
};