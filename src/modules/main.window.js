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

var m_runner = null;

const BrowserWindow = {

  register: function(win) {
    console.log("BrowserWindow.register");

    if (m_runner === null) {
      // first multifox tab!
      m_runner = new MultifoxRunner();
    }

    win.addEventListener(m_runner.eventSentByContent, onContentEvent, false, true);

    // some MultifoxContentEvent_* listeners are not called when
    // there are "unload" listeners with useCapture=true. o_O
    // But they are called if event listener is an anonymous function.
    win.addEventListener("unload", onUnloadChromeWindow, false);

    var container = win.getBrowser().tabContainer;
    container.addEventListener("TabSelect", TabContainerEvents, false);
    container.addEventListener("TabOpen", TabContainerEvents, false);
    container.addEventListener("TabClose", TabContainerEvents, false);
    container.addEventListener("SSTabRestoring", TabContainerEvents, false);

    // tab identity=undefined ==> flag to Profile.find
    var tabs = getTabs(win.getBrowser());
    for (var idx = tabs.length - 1; idx > -1; idx--) {
      Profile.defineIdentity(tabs[idx], Profile.UnknownIdentity);
    }

    // restore icon after toolbar customization
    var toolbox = win.document.getElementById("navigator-toolbox");
    toolbox.addEventListener("DOMNodeInserted", customizeToolbar, false);
  },


  unregister: function(win) {
    console.log("BrowserWindow.unregister");

    win.removeEventListener(m_runner.eventSentByContent, onContentEvent, false);

    var toolbox = win.document.getElementById("navigator-toolbox");
    toolbox.removeEventListener("DOMNodeInserted", customizeToolbar, false);

    var container = win.getBrowser().tabContainer;
    container.removeEventListener("TabSelect", TabContainerEvents, false);
    container.removeEventListener("TabOpen", TabContainerEvents, false);
    container.removeEventListener("TabClose", TabContainerEvents, false);
    container.removeEventListener("SSTabRestoring", TabContainerEvents, false);

    var sessions = Profile.activeIdentities(win);
    var onlyDefault = (sessions.length === 1) && (sessions[0] === Profile.DefaultIdentity);
    if (onlyDefault) {
      // no more multifox tabs
      m_runner.shutdown();
      m_runner = null;
    }
    win.removeEventListener("unload", onUnloadChromeWindow, false);
  }
};


function onUnloadChromeWindow(evt) {
  var win = evt.currentTarget;
  BrowserWindow.unregister(win);
}


const TabContainerEvents = {
  handleEvent: function(evt) {
    try {
      this[evt.type](evt);
    } catch (ex) {
      Components.utils.reportError(ex);
      throw new Error("TabContainerEvents exception " + ex);
    }
  },

  TabOpen: function(evt) {
    var tab = evt.originalTarget;
    if (NewTabId.tabOpenInheritId(tab) === false) {
      // SSTabRestoring may overwrite it
      Profile.defineIdentity(tab, Profile.UnknownIdentity);
    }
  },

  TabClose: function(evt) {
    MoveTabWindows.tabCloseSaveId(evt.originalTarget);
  },

  TabSelect: function(evt) {
    var tab = evt.originalTarget;
    NewTabId.tabSelectSetAsLastTab(tab);     // new tab (in current window): save id
    MoveTabWindows.tabSelectDetectMove(tab); // moved tab: set id
    updateUI(tab);
  },

  SSTabRestoring: function(evt) {
    var tab = evt.originalTarget;
    console.assert(tab.localName === "tab", "SSTabRestoring - tag=" + tab.localName);
    if (migrating(tab)) {
      return;
    }
    // "multifox-tab-profile" restored ==> show badge (selected tab)
    updateUI(tab);
  }
};


// migrating? load profileId from window (Multifox 1.x)
function migrating(tab) {
  var win = tab.ownerDocument.defaultView;
  var tabbrowser = win.getBrowser();
  var attr = "multifox-tabbrowser-previous-version";

  if (tabbrowser.hasAttribute(attr)) {
    console.log("SSTabRestoring - previous version!");
    Profile.defineIdentity(tab, tabbrowser.getAttribute(attr));
    return true;
  }

  var ss = Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
  var profileId = ss.getWindowValue(win, "${BASE_DOM_ID}-identity-id");
  if (profileId.length === 0) {
    return false;
  }

  console.log("SSTabRestoring - previous version! id=" + profileId);
  tabbrowser.setAttribute(attr, profileId);
  ss.deleteWindowValue(win, "${BASE_DOM_ID}-identity-id");
  Profile.defineIdentity(tab, profileId);
  return true;
}


function customizeToolbar(evt) {
  var node = evt.target;
  if ((node.id === "urlbar-container") && (node.parentNode.tagName === "toolbar")) {
    updateUI(node.ownerDocument.defaultView.getBrowser().selectedTab);
  }
}


function onContentEvent(evt) {
  evt.stopPropagation();

  var obj = JSON.parse(evt.data);
  var contentDoc = evt.target;
  var rv;

  switch (obj.from) {
    case "cookie":
      rv = documentCookie(obj, contentDoc);
      break;
    case "localStorage":
      rv = windowLocalStorage(obj, contentDoc);
      break;
    case "error":
      showError(contentDoc.defaultView, obj.cmd, "-");
      break;
    default:
      throw new Error(obj.from);
  }

  if (rv === undefined) {
    // no response
    return;
  }

  // send data to content
  var evt2 = contentDoc.createEvent("MessageEvent");
  evt2.initMessageEvent(m_runner.eventSentByChrome, false, false, rv, null, null, null);
  var success = contentDoc.dispatchEvent(evt2);
}


function MultifoxRunner() {
  console.log("MultifoxRunner");
  this._sentByChrome  = "multifox-chrome_event-"  + Math.random().toString(36).substr(2);
  this._sentByContent = "multifox-content_event-" + Math.random().toString(36).substr(2);
  this._inject = new DocStartScriptInjection();
  Cookies.start();
  util.networkListeners.enable(httpListeners.request, httpListeners.response);
}

MultifoxRunner.prototype = {
  get eventSentByChrome() {
    return this._sentByChrome;
  },

  get eventSentByContent() {
    return this._sentByContent;
  },

  shutdown: function() {
    console.log("MultifoxRunner.shutdown");
    util.networkListeners.disable();
    this._inject.stop();
    Cookies.stop();
  }
};


function showError(contentWin, notSupportedFeature, details) {
  var msg = [];
  msg.push("ERROR=" + notSupportedFeature);
  msg.push(details);
  if (contentWin.document) {
    msg.push("location=" + contentWin.document.location);
    if (contentWin.document.documentURIObject) {
      msg.push("uri=     " + contentWin.document.documentURIObject.spec);
    }
  }
  msg.push("title=[" + contentWin.document.title + "]");
  console.log(msg.join("\n"));

  var tab = WindowParents.getContainerElement(contentWin);
  tab.setAttribute("multifox-tab-error", notSupportedFeature);
  updateUI(tab);
}
