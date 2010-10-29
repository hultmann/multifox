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

const EXPORTED_SYMBOLS = ["Cc", "Ci", "console", "util", "onOverlay", "newPendingWindow"];

const Cc = Components.classes;
const Ci = Components.interfaces;

var m_pendingNewWindows = 0;

function newPendingWindow() {
  m_pendingNewWindows++;
}

function onOverlay(win) {
  console.log("browser.xul - overlay");
  win.addEventListener("DOMContentLoaded", onDOMContentLoaded, false);
}

function onDOMContentLoaded(evt) {
  console.log("browser.xul - DOMContentLoaded");
  var win = evt.currentTarget;
  win.removeEventListener("DOMContentLoaded", onDOMContentLoaded, false);
  win.addEventListener("unload", onUnload, false);

  setWindowProfile(win)

  var doc = win.document;
  //if ((doc instanceof Ci.nsIDOMDocument) === false) {

  // detect session restore
  doc.addEventListener("SSTabRestoring", onTabRestoring, false);
  doc.addEventListener("SSTabRestored", onTabRestored, false);

  // key
  var key = doc.getElementById("key_${BASE_DOM_ID}-new-identity");
  key.addEventListener("command", onKey, false);

  // menus
  addMenuListeners(doc);

  //
  console.log("/browser.xul - DOMContentLoaded");
}


function onUnload(evt) {
  var win = evt.currentTarget;
  win.removeEventListener("unload", onUnload, false);
  removeMenuListeners(win.document);

  // key
  var key = win.document.getElementById("key_${BASE_DOM_ID}-new-identity");
  key.removeEventListener("command", onKey, false);
  //key.parentNode.removeChild(key);
}


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
    Components.utils.import("${URI_JS_MODULE}/main.js");
    NewWindow.newId(newWin);

  } else {
    // inherit identity profile
    if (util.networkListeners.active) {
      Components.utils.import("${URI_JS_MODULE}/main.js");
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
  Components.utils.import("${URI_JS_MODULE}/main.js");
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
  var tabbrowser = doc.getElementById("content");
  var menupopup = doc.getAnonymousElementByAttribute(tabbrowser, "anonid", "tabContextMenu");
  if (!menupopup) {
    menupopup = doc.getElementById("tabContextMenu"); // Firefox 4
  }
  menupopup.addEventListener("popupshowing", onMenuPopupShowing, false);
}


function removeMenuListeners(doc) {
  var ids = ["contentAreaContextMenu", "placesContext", "menu_FilePopup"];
  for (var idx = ids.length - 1; idx > -1; idx--) {
    doc.getElementById(ids[idx]).removeEventListener("popupshowing", onMenuPopupShowing, false);
  }
  var tabbrowser = doc.getElementById("content");
  var menupopup = doc.getAnonymousElementByAttribute(tabbrowser, "anonid", "tabContextMenu");
  if (!menupopup) {
    menupopup = doc.getElementById("tabContextMenu"); // Firefox 4
  }
  menupopup.removeEventListener("popupshowing", onMenuPopupShowing, false);
  //doc.getAnonymousElementByAttribute(doc.getElementById("content"), "anonid", "tabContextMenu").removeEventListener("popupshowing", onMenuPopupShowing, false);
}


function onMenuPopupShowing(evt) {
  Components.utils.import("${URI_JS_MODULE}/menus.js");
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
    var p = "${PACKAGENAME}[" + now.toLocaleFormat("%H:%M:%S") + "." + ms2 + "] ";
    Cc["@mozilla.org/consoleservice;1"]
      .getService(Ci.nsIConsoleService)
      .logStringMessage(p + msg);
  }
};


const util = {
  log: function(msg) {//status stat
    var now = new Date();
    var p = "${PACKAGENAME}[" + now.toLocaleFormat("%H:%M:%S") + "." + now.getMilliseconds() + "] ";
    //dump("\n------------------------------------------------------------------\n" + p + msg);
    Cc["@mozilla.org/consoleservice;1"]
      .getService(Ci.nsIConsoleService)
      .logStringMessage(p + msg);
  },

  getText: function(msg) {
    var len = arguments.length - 1;
    var args = new Array(len);
    for (var idx = 0; idx < len; idx++) {
      args[idx] = arguments[idx + 1];
    }
    return Cc["@mozilla.org/intl/stringbundle;1"]
            .getService(Ci.nsIStringBundleService)
            .createBundle("${URI_PACKAGENAME}/locale/general.properties")
            .formatStringFromName(msg, args, args.length);
  },

  networkListeners: {
    _observers: null,

    get active() {
      return this._observers !== null;
    },

    _cookieRejectedListener: {
      observe: function(aSubject, aTopic, aData) {
        Components.utils.import("${URI_JS_MODULE}/main.js");
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
