/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Multifox.
 *
 * The Initial Developer of the Original Code is
 * Jeferson Hultmann <hultmann@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
    set: function(jsCookie) {
      sendCmd({from:"cookie", cmd:"set", value:jsCookie});
    },
    get: function() {
      return sendCmdRv({from:"cookie", cmd:"get"});
    }
  });

  var realLocalStorage = win.localStorage;

  Object.defineProperty(win, "localStorage", {
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
