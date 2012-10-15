/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


"use strict";

(function(win, doc) {

  Object.defineProperty(doc, "cookie", {
    configurable: true,
    enumerable: true,
    set: function(jsCookie) {
      new XPCNativeWrapper(doc).cookie = jsCookie;
    },
    get: function() {
      return new XPCNativeWrapper(doc).cookie;
    }
  });

  Object.defineProperty(win, "localStorage", {
    configurable: true,
    enumerable: true,
    get: function() {
      return new XPCNativeWrapper(win).localStorage;
    }
  });

  if ("mozIndexedDB" in win) {
    Object.defineProperty(win, "mozIndexedDB", {
      configurable: true,
      enumerable: true,
      get: function() {
        return new XPCNativeWrapper(win).mozIndexedDB;
      }
    });
  }

  if ("indexedDB" in win) {
    Object.defineProperty(win, "indexedDB", {
      configurable: true,
      enumerable: true,
      get: function() {
        return new XPCNativeWrapper(win).indexedDB;
      }
    });

  }

})(window, document)
