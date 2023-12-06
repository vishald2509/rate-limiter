const nodeCache = require("node-cache");
const bunyan = require('../config/logger');
const logger = bunyan('nodeCache.js');

 function NodeCache() {
    try {
        const cache = new nodeCache();
        const wrapper = {}

        wrapper.set = function(key, val, ex, ttl){
            try {
                cache.set(key, val, ttl);
                return 'ok'
            } catch (error) {
                logger.debug({functionName: "set", message: error.message || "Nodecache set function failed"});
                throw error;
            }
        }

        wrapper.ttl = function(key){
            try {
                const ttl = cache.getTtl( key );
                if(ttl){
                    return Math.round((ttl-Date.now()) / 1000);
                }
                else if(ttl == 0){
                    return -1
                }else{
                    return -2
                }
            } catch (error) {
                logger.debug({functionName: "ttl", message: error.message || "Nodecache ttl function failed"});
                throw error;
            }
        }

        wrapper.get = function(key){
            return cache.get(key);
        }

        wrapper.incr = function (key) {
            try {
                const keyTtl = cache.getTtl( key );
                let {count, expireAt} = cache.take(key) || {};
                count = count ? count + 1 : 1;
    
                const newObject = {count};
    
                let seconds = 0;
    
                if(!expireAt){
                    expireAt = keyTtl;
                }
                if(expireAt){
                    seconds = Math.round((expireAt-Date.now()) / 1000);
                    newObject.expireAt = expireAt;
                }
                if((expireAt && seconds>0) || !expireAt)
                    cache.set(key, newObject, seconds);
                return count;
            } catch (error) {
                logger.debug({functionName: "incr", message: error.message || "Nodecache incr function failed"});
                throw error;
            }
        }

        wrapper.expire = function (key, seconds) {
            return cache.ttl( key, seconds)
        }
        wrapper.status = "ready";
        return wrapper;
    } catch (error) {
        logger.debug({functionName: "NodeCache", message: error.message || "Nodecache initialization failed"});
        throw error;
    }
}

module.exports = NodeCache;
