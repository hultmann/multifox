/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


"use strict";

function initContext(win, doc, sentByChrome, sentByContent) {
  function sendCmd(obj) {
    var evt = doc.createEvent("MessageEvent");
    evt.initMessageEvent(sentByContent, true, true, JSON.stringify(obj), null, null, null);
    doc.dispatchEvent(evt);
  }

  function sendCmdRv(obj) {
    var rv = null;
    var hasReply = false;
    function chromeListener(evt) {
      hasReply = true;
      rv = evt.data;
      evt.stopPropagation();
    };
    win.addEventListener(sentByChrome, chromeListener, true);
    sendCmd(obj); // set rv
    win.removeEventListener(sentByChrome, chromeListener, true);
    if (hasReply) {
      return rv;
    } else {
      throw "Return value not received.";
    }
  }

  Object.defineProperty(doc, "cookie", {
    configurable: true,
    enumerable: true,
    set: function(jsCookie) {
      sendCmd({from:"cookie", cmd:"set", value:jsCookie});
    },
    get: function() {
      return sendCmdRv({from:"cookie", cmd:"get"});
    }
  });


  Object.defineProperty(win, "localStorage", {
    configurable: true,
    enumerable: true,
    get: function() {

      function setItemCore(k, v) {
        sendCmd({from:"localStorage", cmd:"setItem", key:k, val:v});
      }

      const Storage = {
        setItem: function(k, v) {setItemCore(k, v);},
        removeItem: function(k) {sendCmd({from:"localStorage", cmd:"removeItem", key:k});},
        clear: function() {      sendCmd({from:"localStorage", cmd:"clear"});},
        getItem: function(k) {return sendCmdRv({from:"localStorage", cmd:"getItem", key:k});},
        key: function(idx) {  return sendCmdRv({from:"localStorage", cmd:"key", index:idx});},
        get length() {        return sendCmdRv({from:"localStorage", cmd:"length"});},

        toString: function() { return "[object Storage]"; }
      };

      var proxy = Proxy.create({

        enumerate: function() { // for (var k in localStorage) {}
          return this.getOwnPropertyNames();
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
          var rv = new Array(Storage.length);
          for (var idx = rv.length - 1; idx > -1; idx--) {
            rv[idx] = Storage.key(idx);
          }
          return rv;
        },

        get: function(receiver, key) { // var a = localStorage.foo
          return Storage.hasOwnProperty(key)
            ? Storage[key]
            : sendCmdRv({from:"localStorage", cmd:"getItem", key:key});
        },

        set: function(receiver, key, val) { // localStorage.foo = 1
          setItemCore(key, val);
          return true;
        },

        delete: function(key) { // delete localStorage.foo
          Storage.removeItem(key);
          return true;
        }
      });

      Object.defineProperty(win, "localStorage", {
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

  if (win.globalStorage) {
    delete win.globalStorage; // globalStorage will be removed by bug 687579
  }

  if (win.mozIndexedDB) {     // TODO
    delete win.mozIndexedDB;
  } else if (win.indexedDB) {
    delete win.indexedDB;
  }

}
