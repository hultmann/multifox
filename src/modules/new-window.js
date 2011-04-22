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

const EXPORTED_SYMBOLS = ["Cc", "Ci", "console", "util", "init", "newPendingWindow"];

const Cc = Components.classes;
const Ci = Components.interfaces;

var m_pendingNewWindows = 0;

function newPendingWindow() {
  m_pendingNewWindows++;
}

var m_docObserver = null;

function init() {
  console.assert(m_docObserver === null, "m_docObserver should be null");
  m_docObserver = new DocObserver();
}


Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function DocObserver() {
  Cc["@mozilla.org/observer-service;1"]
    .getService(Ci.nsIObserverService)
    .addObserver(this, "chrome-document-global-created", false);

  // workaround for top windows until chrome-document-global-created works again in Fx4
  Cc["@mozilla.org/embedcomp/window-watcher;1"]
    .getService(Ci.nsIWindowWatcher)
    .registerNotification(this);
}


DocObserver.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
  observe: function(win, topic, data) {
    switch (topic) {
      case "domwindowclosed":
        return;
      case "domwindowopened":
        break;
      default:
        if (win.top === win) {
          if (win.document.location.href === "chrome://mozapps/content/extensions/about.xul") {
            console.log("OK overlay via " + topic + " / " + win.document.location.href);
            var ns = {};
            Cc["@mozilla.org/moz/jssubscript-loader;1"]
              .getService(Ci.mozIJSSubScriptLoader)
              .loadSubScript("${PATH_CONTENT}/overlays.js", ns);
            ns.AboutOverlay.add(win);
          }
          return;
        }
        break; // chrome-document-global-created works for history-panel.xul etc
    }

    switch (win.document.location.href) {
      case "chrome://mozapps/content/extensions/about.xul":
        console.log("OK overlay via " + topic + " / " + win.document.location.href);
        var ns = {};
        Cc["@mozilla.org/moz/jssubscript-loader;1"]
          .getService(Ci.mozIJSSubScriptLoader)
          .loadSubScript("${PATH_CONTENT}/overlays.js", ns);
        ns.AboutOverlay.add(win);
        break;

      default:
        win.addEventListener("DOMContentLoaded", onDOMContentLoaded, false);
        break;
    }
  }
};


function onDOMContentLoaded(evt) {
  var chromeWin = evt.currentTarget;
  var doc = chromeWin.document;
  if (doc !== evt.target) {
    return; // avoid bubbled DOMContentLoaded events
  }

  chromeWin.removeEventListener("DOMContentLoaded", onDOMContentLoaded, false);

  switch (doc.location.href) {
    case "chrome://browser/content/browser.xul":
      console.log("OK overlay DOMContentLoaded " + doc.location.href);
      BrowserOverlay.add(chromeWin);
      break;
    case "chrome://browser/content/history/history-panel.xul":
    case "chrome://browser/content/bookmarks/bookmarksPanel.xul":
    case "chrome://browser/content/places/places.xul":
      console.log("OK overlay DOMContentLoaded " + doc.location.href);
      var ns = {};
      Cc["@mozilla.org/moz/jssubscript-loader;1"]
        .getService(Ci.mozIJSSubScriptLoader)
        .loadSubScript("${PATH_CONTENT}/overlays.js", ns);
      ns.PlacesOverlay.add(chromeWin);
      break;
  }
}



const BrowserOverlay = {
  add: function(win) {
    win.addEventListener("unload", BrowserOverlay._unload, false);

    setWindowProfile(win)

    var doc = win.document;
    //if ((doc instanceof Ci.nsIDOMDocument) === false) {

    // detect session restore
    doc.addEventListener("SSTabRestoring", onTabRestoring, false);
    doc.addEventListener("SSTabRestored", onTabRestored, false);

    // key
    var key = doc.getElementById("mainKeyset").appendChild(doc.createElement("key"));
    key.setAttribute("id", "key_${BASE_DOM_ID}-new-identity");
    key.setAttribute("modifiers", "accel,shift");
    key.setAttribute("key", "M");
    key.setAttribute("oncommand", "(function dummy(){})()"); // workaround
    key.addEventListener("command", onKey, false);

    // menus
    addMenuListeners(doc);
  },

  _unload: function(evt) {
    var win = evt.currentTarget;
    win.removeEventListener("unload", BrowserOverlay._unload, false);
    BrowserOverlay.remove(win);
  },

  remove: function(win) {
    removeMenuListeners(win.document);

    // key
    var key = win.document.getElementById("key_${BASE_DOM_ID}-new-identity");
    key.removeEventListener("command", onKey, false);
    key.parentNode.removeChild(key);
  }
};


function onKey(evt) {
  var key = evt.target;
  var win = key.ownerDocument.defaultView.top;
  newPendingWindow();
  win.OpenBrowserWindow();
}


function setWindowProfile(newWin) {
  if (m_pendingNewWindows > 0) {
    // new identity profile
    console.log("m_pendingNewWindows=" + m_pendingNewWindows);
    m_pendingNewWindows--;
    Components.utils.import("${PATH_MODULE}/main.js");
    NewWindow.newId(newWin);

  } else {
    // inherit identity profile
    if (util.networkListeners.active) {
      Components.utils.import("${PATH_MODULE}/main.js");
      NewWindow.inheritId(newWin);
    } else {
      // no Multifox window
      console.log("setWindowProfile NOP => util.networkListeners.active=false");
    }
  }
}


function onTabRestoring(evt) {
  var doc = evt.currentTarget;
  var win = doc.defaultView;

  var stringId = Cc["@mozilla.org/browser/sessionstore;1"]
                  .getService(Ci.nsISessionStore)
                  .getWindowValue(win, "${BASE_DOM_ID}-identity-id");

  if (util.networkListeners.active === false && stringId.length === 0) {
    // default scenario
    console.log("first tab restoring NOP");
    return;
  }

  console.log("first tab restoring " + stringId);

  // add icon; sync id — override any previous profile id
  Components.utils.import("${PATH_MODULE}/main.js");
  NewWindow.applyRestore(win);
}


function onTabRestored(evt) {
  var doc = evt.currentTarget;
  var win = doc.defaultView;
  var tab = evt.originalTarget;
  console.log("SSTabRestored " + tab.linkedBrowser.currentURI.spec.substr(0, 80));


  // we need to [re]configure identity window id,
  // only the first restored tab is necessary.
  if (tab.linkedBrowser.currentURI.spec !== "about:sessionrestore") {
    console.log("removeEventListener SSTabRestored+SSTabRestoring");
    doc.removeEventListener("SSTabRestoring", onTabRestoring, false);
    doc.removeEventListener("SSTabRestored", onTabRestored, false);
  }
}


function addMenuListeners(doc) {
  var ids = ["contentAreaContextMenu", "placesContext", "menu_FilePopup"];
  for (var idx = ids.length - 1; idx > -1; idx--) {
    doc.getElementById(ids[idx]).addEventListener("popupshowing", onMenuPopupShowing, false);
  }

  doc.getElementById("tabContextMenu").addEventListener("popupshowing", onMenuPopupShowing, false);

  var newTabPopup = doc.getElementById("appmenu_newNavigator").parentNode;
  newTabPopup.addEventListener("popupshowing", onMenuPopupShowing, false);
  newTabPopup.setAttribute("multifox-id", "app-menu");
}


function removeMenuListeners(doc) {
  var ids = ["contentAreaContextMenu", "placesContext", "menu_FilePopup"];
  for (var idx = ids.length - 1; idx > -1; idx--) {
    doc.getElementById(ids[idx]).removeEventListener("popupshowing", onMenuPopupShowing, false);
  }

  doc.getElementById("tabContextMenu").removeEventListener("popupshowing", onMenuPopupShowing, false);

  var newTabPopup = doc.getElementById("appmenu_newNavigator").parentNode;
  newTabPopup.removeEventListener("popupshowing", onMenuPopupShowing, false);
  newTabPopup.removeAttribute("multifox-id");
}


function onMenuPopupShowing(evt) {
  Components.utils.import("${PATH_MODULE}/menus.js");
  menuShowing(evt);
}


const console = {
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
    Cc["@mozilla.org/consoleservice;1"]
      .getService(Ci.nsIConsoleService)
      .logStringMessage(p + msg);
  },

  assert: function(test, msg) {
    if (test !== true) {
      var ex =  new Error("console.assert - " + msg + " - " + test);
      Components.utils.reportError(ex) // sometimes exception doesn't show up in console
      throw "";
    }
  }
};


const util = {
  getText: function(name) {
    return this._getTextCore(name, "general", arguments, 1);
  },

  getTextFrom: function(name, filename) {
    return this._getTextCore(name, filename, arguments, 2);
  },

  _getTextCore: function(name, filename, args, startAt) {
    var bundle = Cc["@mozilla.org/intl/stringbundle;1"]
                  .getService(Ci.nsIStringBundleService)
                  .createBundle("${PATH_LOCALE}/" + filename + ".properties");

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

    _cookieRejectedListener: {
      observe: function(aSubject, aTopic, aData) {
        Components.utils.import("${PATH_MODULE}/main.js");
        console.log("cookie-rejected\n" + aSubject + "\n" + aTopic + "\n" + aData + "\n" + aSubject.QueryInterface(Ci.nsIURI).spec);
      }
    },

    enable: function(onRequest, onResponse) {
      console.log("networkListeners enable");
      if (this._observers !== null) {
        throw "networkListeners.enable ==> this._observers=true";
      }
      this._observers = [onRequest, onResponse];

      var obs = Cc["@mozilla.org/observer-service;1"]
                  .getService(Ci.nsIObserverService);

      obs.addObserver(this._observers[0], "http-on-modify-request", false);
      obs.addObserver(this._observers[1], "http-on-examine-response", false);
      obs.addObserver(this._cookieRejectedListener, "cookie-rejected", false);
    },

    disable: function() {
      console.log("networkListeners disable");
      var obs = Cc["@mozilla.org/observer-service;1"]
                  .getService(Ci.nsIObserverService);

      obs.removeObserver(this._observers[0], "http-on-modify-request");
      obs.removeObserver(this._observers[1], "http-on-examine-response");
      this._observers = null;
      obs.removeObserver(this._cookieRejectedListener, "cookie-rejected");
    }
  }
};
