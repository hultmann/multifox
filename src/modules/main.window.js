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


var WindowWatcher = {
  start: function() {
    Services.ww.registerNotification(this);
  },

  stop: function() {
    Services.ww.unregisterNotification(this);
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
  observe: function(win, topic, data) {
    if (topic === "domwindowopened") {
      win.addEventListener("DOMContentLoaded", WindowWatcher._onLoad, false);
    }
  },

  _onLoad: function(evt) {
    var win = evt.currentTarget;
    var doc = win.document;
    if (doc !== evt.target) {
      return; // avoid bubbled DOMContentLoaded events
    }
    win.removeEventListener("DOMContentLoaded", WindowWatcher._onLoad, false);

    switch (doc.location.href) {
      case "chrome://browser/content/browser.xul":
        //if ((win.document instanceof Ci.nsIDOMDocument) === false) {
        BrowserWindow.register(win);
        break;
      case "chrome://mozapps/content/extensions/about.xul":
        // make "About" menuitem open about:multifox tab
        var ns = util.loadSubScript("${PATH_CONTENT}/overlays.js");
        ns.AboutOverlay.add(win);
        break;
    }
  }
};


var BrowserWindow = {
  register: function(win) {
    console.log("BrowserWindow.register");

    // some MultifoxContentEvent_* listeners are not called when
    // there are "unload" listeners with useCapture=true. o_O
    // But they are called if event listener is an anonymous function.
    win.addEventListener("unload", ChromeWindowEvents, false);
    win.addEventListener("activate", ChromeWindowEvents, false);
    win.addEventListener("mousedown", RedirDetector.onMouseDown, false); // command/click listeners can be called after network request
    win.addEventListener("keydown", RedirDetector.onKeyDown, false);

    var tabbrowser = win.getBrowser();
    tabbrowser.addEventListener("pageshow", updateNonNetworkDocuments, false);

    var mm = win.messageManager;
    mm.loadFrameScript("${PATH_MODULE}/remote-browser.js", true);
    mm.addMessageListener("multifox-remote-msg", onRemoteBrowserMessage);

    var container = tabbrowser.tabContainer;
    container.addEventListener("TabSelect", TabContainerEvents, false);
    container.addEventListener("TabClose", TabContainerEvents, false);
    container.addEventListener("SSTabRestoring", TabContainerEvents, false);

    // hide icon during toolbar customization
    win.addEventListener("beforecustomization", beforeCustomization, false);
    win.addEventListener("aftercustomization", afterCustomization, false);

    win.document.documentElement.setAttribute("multifox-window-uninitialized", "true");

    // show icon
    updateUI(tabbrowser.selectedTab, true); // BUG at startup(), LoginDB is still empty
  },


  unregister: function(win) {
    console.log("BrowserWindow.unregister");

    win.removeEventListener("unload", ChromeWindowEvents, false);
    win.removeEventListener("activate", ChromeWindowEvents, false);
    win.removeEventListener("mousedown", RedirDetector.onMouseDown, false);
    win.removeEventListener("keydown", RedirDetector.onKeyDown, false);

    var tabbrowser = win.getBrowser();
    tabbrowser.removeEventListener("pageshow", updateNonNetworkDocuments, false);

    var container = tabbrowser.tabContainer;
    container.removeEventListener("TabSelect", TabContainerEvents, false);
    container.removeEventListener("TabClose", TabContainerEvents, false);
    container.removeEventListener("SSTabRestoring", TabContainerEvents, false);

    win.removeEventListener("beforecustomization", beforeCustomization, false);
    win.removeEventListener("aftercustomization", afterCustomization, false);

    var mm = win.messageManager;
    mm.removeMessageListener("multifox-remote-msg", onRemoteBrowserMessage);
    mm.removeDelayedFrameScript("${PATH_MODULE}/remote-browser.js");
    mm.sendAsyncMessage("multifox-parent-msg", {msg: "shutdown"}); // no effect when closing the window

    // remove icon - TODO skip when closing the window
    var container = getIconContainer(win.document);
    if (container !== null) {
      container.parentNode.removeChild(container);
    }
  }
};


var ChromeWindowEvents = {
  handleEvent: function(evt) {
    try {
      this[evt.type](evt);
    } catch (ex) {
      Cu.reportError(ex);
      throw new Error("ChromeWindowEvents exception " + ex);
    }
  },

  unload: function(evt) {
    var win = evt.currentTarget;
    BrowserWindow.unregister(win);
  },

  activate: function(evt) {
    var win = evt.currentTarget;
    var tab = win.getBrowser().selectedTab;
    LoginDB.setTabAsDefaultLogin(tab); // BUG init m_welcomeMode, attr current-tld missing

    LoginDB._ensureValid(); // BUG workaround to display welcome icon
    if (m_welcomeMode) {
      updateUI(tab, true);
    }
  }
};


var TabContainerEvents = {
  handleEvent: function(evt) {
    try {
      this[evt.type](evt);
    } catch (ex) {
      Cu.reportError(ex);
      throw new Error("TabContainerEvents exception " + ex);
    }
  },

  TabClose: function(evt) {
    var tab = evt.originalTarget;
    MoveTabWindows.tabCloseSaveId(tab);
  },

  TabSelect: function(evt) {
    var tab = evt.originalTarget;
    MoveTabWindows.tabSelectDetectMove(tab); // moved tab: set id
    updateUI(tab, true);
  },

  SSTabRestoring: function(evt) {
    var tab = evt.originalTarget;
    updateUI(tab, true);
  }
};


function beforeCustomization(evt) {
  var toolbox = evt.target;
  var container = getIconContainer(toolbox.ownerDocument);
  if (container !== null) {
    // remove icon - BUG changing tabs will make it appear again
    container.parentNode.removeChild(container);
  }
}


function afterCustomization(evt) {
  var toolbox = evt.target;
  var tab = toolbox.ownerDocument.defaultView.getBrowser().selectedTab;
  updateUI(tab, true);
}
