/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

function initContext(win, doc, sentByChrome, sentByContent) {
  function sendCmd(msgData) {
    var evt = doc.createEvent("CustomEvent");
    evt.initCustomEvent(sentByContent, true, true, msgData);
    doc.dispatchEvent(evt);
  }

  function sendCmdRv(msgData) {
    var rv = null;
    var hasReply = false;
    function chromeListener(evt) {
      hasReply = true;
      rv = evt.detail;
      evt.stopPropagation();
    };
    win.addEventListener(sentByChrome, chromeListener, true);
    sendCmd(msgData); // set rv
    win.removeEventListener(sentByChrome, chromeListener, true);
    if (hasReply) {
      return rv;
    } else {
      // this seems to happen when a tab is closed. the event handler is never called.
      throw new Error("${EXT_NAME} - Return value not received.\n" + sentByContent + "\n" + rv + "\n" + doc.location + "\n" + JSON.stringify(msgData));
    }
  }

  Object.defineProperty(doc, "cookie", {
    configurable: true,
    enumerable: true,
    set: function(jsCookie) {
      sendCmd({msg:"cookie", cmdMethod:"set", cmdValue:jsCookie});
    },
    get: function() {
      return sendCmdRv({msg:"cookie", cmdMethod:"get"});
    }
  });

  Object.defineProperty(win, "localStorage", {
    configurable: true,
    enumerable: true,
    get: function() {

      function setItemCore(k, v) {
        sendCmd({msg:"localStorage", cmdMethod:"setItem", cmdKey:k, cmdVal:v});
      }

      var Storage = {
        setItem: function(k, v) {setItemCore(k, v);},
        removeItem: function(k) {sendCmd({msg:"localStorage", cmdMethod:"removeItem", cmdKey:k});},
        clear:      function()  {sendCmd({msg:"localStorage", cmdMethod:"clear"});},
        getItem: function(k) {return sendCmdRv({msg:"localStorage", cmdMethod:"getItem", cmdKey:k});},
        key: function(idx)   {return sendCmdRv({msg:"localStorage", cmdMethod:"key", cmdIndex:idx});},
        get length()         {return sendCmdRv({msg:"localStorage", cmdMethod:"length"});},

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
            : sendCmdRv({msg:"localStorage", cmdMethod:"getItem", cmdKey:key});
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
  if (win.mozIndexedDB) {     // TODO
    delete win.mozIndexedDB;
  } else if (win.indexedDB) {
    delete win.indexedDB;
  }
}
