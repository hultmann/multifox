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
 * Portions created by the Initial Developer are Copyright (C) 2009
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

var EXPORTED_SYMBOLS = ["Cc", "Ci", "Cu", "console", "util", "init"];

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

var m_docObserver = null;

function init() {
  console.assert(m_docObserver === null, "m_docObserver should be null");
  m_docObserver = new DocObserver();
  var ss = Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
  ss.persistTabAttribute("multifox-tab-id-provider-tld-enc");
  ss.persistTabAttribute("multifox-tab-id-provider-user-enc");
  ss.persistTabAttribute("multifox-tab-current-tld"); // detect TLD change
  ss.persistTabAttribute("multifox-tab-previous-tld");
}


function DocObserver() {
  Services.ww.registerNotification(this);
}


DocObserver.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
  observe: function(win, topic, data) {
    if (topic === "domwindowopened") {
      win.addEventListener("DOMContentLoaded", onDOMContentLoaded, false);
    }
  }
};


function onDOMContentLoaded(evt) {
  var win = evt.currentTarget;

  if (win.document !== evt.target) {
    return; // avoid bubbled DOMContentLoaded events
  }

  win.removeEventListener("DOMContentLoaded", onDOMContentLoaded, false);
  switch (win.document.location.href) {
    case "chrome://browser/content/browser.xul":
      BrowserOverlay.add(win);
      break;
    case "chrome://mozapps/content/extensions/about.xul":
      // make "About" menuitem open about:multifox tab
      var ns = {};
      Services.scriptloader.loadSubScript("${PATH_CONTENT}/overlays.js", ns);
      ns.AboutOverlay.add(win);
      break;
  }
}



var BrowserOverlay = {
  add: function(win) {
    win.addEventListener("unload", BrowserOverlay._unload, false);

    var doc = win.document;
    //if ((doc instanceof Ci.nsIDOMDocument) === false) {

    Cu.import("${PATH_MODULE}/main.js");
    BrowserWindow.register(win);
  },

  _unload: function(evt) {
    var win = evt.currentTarget;
    win.removeEventListener("unload", BrowserOverlay._unload, false);
    BrowserOverlay.remove(win);

    Cu.import("${PATH_MODULE}/main.js");
    BrowserWindow.unregister(win);
  },

  remove: function(win) {
  }
};


var console = {
  log: function(msg) {
    var now = new Date();
    var ms = now.getMilliseconds();
    var ms2;
    if (ms < 100) {
      ms2 = ms < 10 ? "00" + ms : "0" + ms;
    } else {
      ms2 = ms.toString();
    }
    var p = "${CHROME_NAME}[" + now.toLocaleFormat("%H:%M:%S") + "." + ms2 + "] ";

    var len = arguments.length;
    var msg = len > 1 ? Array.prototype.slice.call(arguments, 0, len).join(" ")
                      : arguments[0];
    Services.console.logStringMessage(p + msg);
  },

  warn: function(msg) {
    var message = Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
    message.init(msg,
                 null, // sourceName
                 null, // sourceLine
                 0, 0, // line, col
                 Ci.nsIScriptError.warningFlag,
                 "component javascript");
    Services.console.logMessage(message);
    this.trace(msg);
  },

  error: function(msg) {
    var ex = new Error(msg);
    Cu.reportError(ex);
    this.trace(msg);
  },

  assert: function(test, msg) {
    if (test !== true) {
      var ex =  new Error("console.assert - " + msg + " - " + test);
      Cu.reportError(ex); // workaround - sometimes exception doesn't show up in console
      console.trace("console.assert()");
      throw ex;
    }
  },

  trace: function console_trace(desc) {
    var b = [];
    for (var s = Components.stack; s; s = s.caller) {
      b.push(s);
    }

    var padding = "";
    var t = new Array(b.length);
    for (var idx = b.length - 1; idx > -1; idx--) {
      var s = b[idx];
      var name = s.name === null ? "(anonymous)" : s.name;
      t[idx] = s.languageName + " " + padding + s.filename + "\t\t" + name + "\t" + s.lineNumber;
      padding += " ";
    }
    if (!desc) {
      desc = "console.trace()";
    }
    console.log(desc, "\n" + t.reverse().join("\n"));
  }
};


var util = {
  getText: function(name) {
    return this._getTextCore("general.properties", name, arguments, 1);
  },

  getTextFrom: function(filename, name) {
    return this._getTextCore(filename, name, arguments, 2);
  },

  _getTextCore: function(filename, name, args, startAt) {
    var bundle = Services.strings.createBundle("${PATH_LOCALE}/" + filename);

    if (args.length === startAt) {
      return bundle.GetStringFromName(name);
    } else {
      var args2 = Array.prototype.slice.call(args, startAt, args.length);
      console.assert(args2.length > 0, "_getTextCore");
      return bundle.formatStringFromName(name, args2, args2.length)
    }
  },

  networkListeners: {
    _observers: null,

    get active() {
      return this._observers !== null;
    },

    enable: function(onRequest, onResponse) {
      console.log("networkListeners enable");
      if (this._observers !== null) {
        throw new Error("networkListeners.enable ==> this._observers=true");
      }
      this._observers = [onRequest, onResponse];

      var obs = Services.obs;
      obs.addObserver(this._observers[0], "http-on-modify-request", false);
      obs.addObserver(this._observers[1], "http-on-examine-response", false);
    },

    disable: function() {
      console.log("networkListeners disable");
      var obs = Services.obs;
      obs.removeObserver(this._observers[0], "http-on-modify-request");
      obs.removeObserver(this._observers[1], "http-on-examine-response");
      this._observers = null;
    }
  }
};
