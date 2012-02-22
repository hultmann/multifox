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


var BrowserWindow = {

  register: function(win) {
    console.log("BrowserWindow.register");

    if (m_runner === null) {
      // first multifox tab!
      m_runner = new MultifoxRunner();
    }

    // some MultifoxContentEvent_* listeners are not called when
    // there are "unload" listeners with useCapture=true. o_O
    // But they are called if event listener is an anonymous function.
    win.addEventListener("unload", ChromeWindowEvents, false);
    win.addEventListener("activate", ChromeWindowEvents, false);
    win.addEventListener(DocStartScriptInjection.eventNameSentByContent, onContentEvent, false, true);
    win.addEventListener("mousedown", RedirDetector.onMouseDown, false); // command/click listeners can be called after network request
    win.addEventListener("keydown", RedirDetector.onKeyDown, false);

    var tabbrowser = win.getBrowser();
    tabbrowser.addEventListener("pageshow", updateNonNetworkDocuments, false);

    var container = tabbrowser.tabContainer;
    container.addEventListener("TabSelect", TabContainerEvents, false);
    container.addEventListener("TabClose", TabContainerEvents, false);
    container.addEventListener("SSTabRestoring", TabContainerEvents, false);

    // restore icon after toolbar customization
    var toolbox = win.document.getElementById("navigator-toolbox");
    toolbox.addEventListener("DOMNodeInserted", customizeToolbar, false);


    win.document.documentElement.setAttribute("multifox-window-uninitialized", "true");
  },


  unregister: function(win) {
    console.log("BrowserWindow.unregister");

    win.removeEventListener("unload", ChromeWindowEvents, false);
    win.removeEventListener("activate", ChromeWindowEvents, false);
    win.removeEventListener(DocStartScriptInjection.eventNameSentByContent, onContentEvent, false);
    win.removeEventListener("mousedown", RedirDetector.onMouseDown, false);
    win.removeEventListener("keydown", RedirDetector.onKeyDown, false);

    var tabbrowser = win.getBrowser();
    tabbrowser.removeEventListener("pageshow", updateNonNetworkDocuments, false);

    var container = tabbrowser.tabContainer;
    container.removeEventListener("TabSelect", TabContainerEvents, false);
    container.removeEventListener("TabClose", TabContainerEvents, false);
    container.removeEventListener("SSTabRestoring", TabContainerEvents, false);

    var toolbox = win.document.getElementById("navigator-toolbox");
    toolbox.removeEventListener("DOMNodeInserted", customizeToolbar, false);

    // TODO last window?
    /*
    if () {
      m_runner.shutdown();
      m_runner = null;
      Cu.unload("${PATH_MODULE}/main.js");
    }
    */
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
}


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


// first run?
function onStart() {
  var prefName = "extensions.${EXT_ID}.currentVersion";
  var prefs = Services.prefs;
  var ver = prefs.prefHasUserValue(prefName) ? prefs.getCharPref(prefName) : "";
  if (ver === "${EXT_VERSION}") {
    return;
  }
  prefs.setCharPref(prefName, "${EXT_VERSION}");


  // TODO ss.deleteWindowValue(doc.defaultView, "${BASE_DOM_ID}-identity-id");

  // remove Multifox 1.x cookies
  var profileId = 2;
  var all;
  do {
    all = removeTldData_cookies("multifox-profile-" + profileId);
    console.log("Migrating: removing cookies 1.x", profileId, ":", all.length);
    profileId++;
  } while ((profileId < 20) || (all.length > 0));


  // remove Multifox 2.x beta 1 cookies
  all = removeTldData_cookies("x-content.x-namespace");
  console.log("Migrating: removing cookies 2.0b1", all.length);

  // remove Multifox 2.x beta 2 cookies
  all = removeTldData_cookies("-.x-namespace");
  console.log("Migrating: removing cookies 2.0b2", all.length);

  // remove Multifox 2.x beta 3 cookies
  //all = removeTldData_cookies("multifox-auth-1");
  //var all2 = removeTldData_cookies("multifox-anon-1");
  //console.log("Migrating: removing cookies 2.0b3", all.length + all2.length);
}


function customizeToolbar(evt) {
  var node = evt.target;
  if ((node.id === "urlbar-container") && (node.parentNode.tagName === "toolbar")) {
    var tab = node.ownerDocument.defaultView.getBrowser().selectedTab;
    updateUI(tab, true);
  }
}
