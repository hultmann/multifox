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

      var Storage = {
        setItem: function(k, v) {sendCmd({from:"localStorage", cmd:"setItem", key:k, val:v});},
        removeItem: function(k) {sendCmd({from:"localStorage", cmd:"removeItem", key:k});},
        clear: function() {      sendCmd({from:"localStorage", cmd:"clear"});},
        getItem: function(k) {return sendCmd({from:"localStorage", cmd:"getItem", key:k});},
        key: function(idx) {  return sendCmd({from:"localStorage", cmd:"key", index:idx});},
        get length() {        return sendCmd({from:"localStorage", cmd:"length"});},

        toString: function() { return "[object Storage]"; }
      };

      var proxy = Proxy.create({

        enumerate: function() { // for (var k in localStorage) {}
          return this.keys();
        },

        getPropertyDescriptor: function(key) { // "foo" in localStorage
          var val = this.get(null, key);
          return val === null ? undefined : {
            value:        val,
            writable:     true,
            enumerable:   true,
            configurable: true
          };
        },

        getOwnPropertyDescriptor: function(key) { // "unknownkey" in localStorage
          return undefined;
        },

        getOwnPropertyNames: function() { // Object.getOwnPropertyNames(localStorage);
          return this.keys();
        },

        keys: function() { // Object.keys(localStorage);
          var rv = new Array(Storage.length);
          for (var idx = rv.length - 1; idx > -1; idx--) {
            rv[idx] = Storage.key(idx);
          }
          return rv;
        },

        get: function(receiver, key) { // var a = localStorage.foo
          return Storage.hasOwnProperty(key) ? Storage[key] : Storage.getItem(key);
        },

        set: function(receiver, key, val) { // localStorage.foo = 1
          Storage.setItem(key, val);
          return true;
        },

        delete: function(key) { // delete localStorage.foo
          Storage.removeItem(key);
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
