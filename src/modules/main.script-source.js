function contentScriptSource() {
  "use strict";

  window.addEventListener("storage", function(evt) {
    // storageArea=>initStorageEvent(storageAreaArg)
    if ((evt.storageArea !== null) && (evt.storageArea.toString() === "[object Storage]")) {
      // do not leak storage events from default profile to Multifox documents
      evt.stopImmediatePropagation();
    }
  }, true);


  Object.defineProperty(document, "cookie", {
    configurable: true,
    enumerable: true,
    set: function(jsCookie) {
      sendCmd({from:"cookie", cmd:"set", value:jsCookie});
    },
    get: function() {
      return sendCmd({from:"cookie", cmd:"get"});
    }
  });


  Object.defineProperty(window, "localStorage", {
    configurable: true,
    enumerable: true,
    get: function() {

      var proxy = new Proxy({
        // target
        setItem: function(k, v) {sendCmd({from:"localStorage", cmd:"setItem", key:k, val:v});},
        removeItem: function(k) {sendCmd({from:"localStorage", cmd:"removeItem", key:k});},
        clear: function() {      sendCmd({from:"localStorage", cmd:"clear"});},
        getItem: function(k) {return sendCmd({from:"localStorage", cmd:"getItem", key:k});},
        key: function(idx) {  return sendCmd({from:"localStorage", cmd:"key", index:idx});},
        get length() {        return sendCmd({from:"localStorage", cmd:"length"});},

        toString: function() { return "[object Storage]"; }

      }, {
        // handler

        // Object.keys(localStorage)
        getOwnPropertyDescriptor: function(target, key) {
          var val = target.getItem(key);
          return val === null ? undefined : {
            value:        val,
            writable:     true,
            enumerable:   true,
            configurable: true
          };
        },

        // for (var k in localStorage) console.log(k)
        getPrototypeOf: function(target) {
          return target;
        },

        // Object.getOwnPropertyNames(localStorage)
        ownKeys: function(target) {
          var rv = new Array(target.length);
          for (var idx = rv.length - 1; idx > -1; idx--) {
            rv[idx] = target.key(idx);
          }
          return rv;
        },

        has: function(target, key) {
          return target.getItem(key) !== null;
        },

        // var a = localStorage.foo
        get: function(target, key, receiver) {
          return target.hasOwnProperty(key) ? target[key]
                                            : target.getItem(key);
        },

        // localStorage.foo = 1
        set: function(target, key, val, receiver) {
          target.setItem(key, val);
          return true;
        },

        // delete localStorage.foo
        deleteProperty: function(target, key) {
          target.removeItem(key);
          return true;
        }
      });

      Object.defineProperty(window, "localStorage", {
        configurable: true,
        enumerable: true,
        get: function() {
          return proxy;
        }
      });

      return proxy;
    }
  });


  // remove unsupported features
  var idb = {
    configurable: true,
    enumerable: true,
    get: function() {
      sendCmd({from:"error", cmd:"indexedDB"});
      return {
        open: function() {
          return {
            onblocked: null,
            onupgradeneeded: null,
            onsuccess: null,
            onerror: null,
            source: null,
            transaction: null,
            readyState: "pending"
          };
      }};
    }
  };
  Object.defineProperty(window, "indexedDB", idb);
  Object.defineProperty(window, "mozIndexedDB", idb);
};
