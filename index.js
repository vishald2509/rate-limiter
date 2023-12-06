const Database = require("./service/connectDatabase");

const bunyan = require('./config/logger');
const logger = bunyan('rateLimiter.js');

const initRateLimit = async (config, { onError, onReconnect, onExit }) => {
  logger.info({functionName: "initRateLimit", message: "initializing rate limit middleware", config});
  const { databaseConfig, rateLimitConfig, appName, isRateLimitEnabled=false } = config;
  try {

    if (!JSON.parse(isRateLimitEnabled)) {
      logger.info({functionName: "initRateLimit", message:"In app rate limiting is not enabled"});
      // returning a empty middleware if rate limit is not enabled
      return (req, res, next) => next();
    }

    if (!appName) throw new Error("rate-limit requried option appName Invalid");

    const db = new Database(databaseConfig);
    if (databaseConfig?.database === "redis") {
      if (onError) db.onError(onError);
      if (onReconnect) db.onReconnect(onReconnect);
      await db.checkReadyState(true);
    }
    const dbClient = db.getDbConnection();
    logger.info({functionName: "initRateLimit", message: "Rate limit middleware initialized succesfuly"});

    return async (req, res, next) => {
      try {
        logger.debug({functionName: "rateLimit", message: "running rate limit middleware"});

        // window - In seconds
        const {
          maxHits = 1000,
          window = 1,
          message = "Too many request from this IP",
          headerEnabled = false,
          ipBasedRateLimiting = true,
          originatingIpHeader = "x-forwarded-for",
          isBehindAProxy = false
        } = rateLimitConfig || {};

        /*
       * if an requested is forwarded through multiple proxies, it will contain an array of IP's
       * X-Forwarded-For: <client>, <proxy1>, <proxy2>, ...
       * Ref: https://serverfault.com/questions/846489/can-x-forwarded-for-contain-multiple-ips
       *
       */

        let key = `${appName}`;

        let ip;
        const xForwaredFor = req.headers[originatingIpHeader] || false;
        if (JSON.parse(isBehindAProxy) && xForwaredFor) {
          ip = xForwaredFor.split(',')[0]; // client ip
        } else {
          ip = req?.socket?.remoteAddress || req?.connection?.remoteAddress || req.ip || '';
        }

        if(JSON.parse(ipBasedRateLimiting) && ip)
          key = `${appName}-${ip}`;

        await db.checkReadyState();
        //#TODO: need to combine incr and expire into single redis request. multiple redis request could effect rate-limit.
        // using app level rate-limiting with key as appName + ipAddress
        const requestCount = await dbClient.incr(key);  // incr the key if already present
        let keyTtl = await dbClient.ttl(key);
        if (keyTtl === -1) 
          keyTtl = await dbClient.expire(key, window) ? window : -1;  // expire(key,value)
        logger.debug({functionName: "rateLimit", message: "Rate Limit Log", requestCount, key, keyTtl, maxHits});

        if(JSON.parse(headerEnabled))
        {
          res.header('Access-Control-Expose-Headers', ['x-ratelimit-reset', 'x-ratelimit-remaining', 'x-ratelimit-limit']);
          res.setHeader('x-ratelimit-limit', maxHits);
          let rateLimitRemaining = maxHits-requestCount;
          if(rateLimitRemaining<0)
            rateLimitRemaining = 0;
          res.setHeader('x-ratelimit-remaining', rateLimitRemaining);
          res.setHeader('x-ratelimit-reset', keyTtl);
        }

        if (requestCount > maxHits) res.status(429).send(message);
        else next();

      } catch (error) {
        if (onExit) {
          logger.error({functionName: "rateLimit", error: error.message || "Uncaught error"});
          onExit(error);
        }
        else
          logger.error({functionName: "rateLimit", error: error.message || "Uncaught error"});
      }
    };
  } catch (error) {
    if (onExit) {
      logger.debug({functionName: "initRateLimit", error: `Failed to attach rate-limit middleware. ${error.message || "Uncaught error"}`});
      onExit(error);
    }
    else
      logger.error({functionName: "initRateLimit", error: `Failed to attach rate-limit middleware. ${error.message || "Uncaught error"}`});
  }
};

module.exports = initRateLimit;
